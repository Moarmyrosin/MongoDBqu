import { Survey } from './survey.model.js';
import { createSurvey, getSurveyById, listSurveysByOwner, deleteSurveyById } from './survey.repo.js';
import { badRequest, notFound, forbidden } from '../../common/errors/index.js';
import { isPast } from '../../common/utils/time.js';
import * as LibraryService from '../questions/library.service.js';

const ensureOwner = (survey, userId) => {
  if (survey.createdBy.toString() !== userId.toString())
    throw forbidden('You do not own this survey');
};

const ensureDraft = (survey) => {
  if (survey.status !== 'draft') throw badRequest('Only draft surveys can be modified');
};

const syncFirstQuestion = (survey) => {
  if (survey.questions?.length > 0) {
    const sorted = [...survey.questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    survey.firstQuestionId = sorted[0]._id;
  } else {
    survey.firstQuestionId = undefined;
  }
};

const reindexQuestions = (survey) => {
  const sorted = [...survey.questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  sorted.forEach((q, i) => {
    q.order = i;
  });
  survey.questions = sorted;
};

export const create = async ({ userId, title, description, settings }) => {
  if (!title || !title.trim()) throw badRequest('Survey title is required');
  return await createSurvey({
    title: title.trim(),
    description: description?.trim() || '',
    settings: settings || {},
    createdBy: userId,
    status: 'draft',
    version: 1,
    questions: []
  });
};

export const listMine = async (userId, opts) => listSurveysByOwner(userId, opts);

export const getById = async (id) => {
  const s = await getSurveyById(id);
  if (!s) throw notFound('Survey not found');
  return s;
};

export const updateBasic = async (id, userId, { title, description, settings, deadline }) => {
  const s = await getSurveyById(id);
  if (!s) throw notFound('Survey not found');
  ensureOwner(s, userId);
  ensureDraft(s);
  if (title !== undefined) s.title = title.trim();
  if (description !== undefined) s.description = description.trim();
  if (settings !== undefined) {
    s.settings = { ...(s.settings?.toObject ? s.settings.toObject() : s.settings), ...settings };
  }
  if (deadline !== undefined) s.deadline = deadline ? new Date(deadline) : null;
  syncFirstQuestion(s);
  await s.save();
  return s;
};

/**
 * 添加题目。
 * - body 带 fromQuestionId：从题目库选用的题目，复制该版本内容为快照并记录 sourceQuestionId/sourceVersion；
 *   任何人对该题（拥有者或被共享者）都需有读取权限。之后题库修改不影响此处快照。
 * - 否则按传统方式新建嵌入题目。
 */
export const addQuestion = async (id, userId, q) => {
  const s = await getSurveyById(id);
  if (!s) throw notFound('Survey not found');
  ensureOwner(s, userId);
  ensureDraft(s);

  if (q?.fromQuestionId) {
    const src = await LibraryService.assertAccessible(q.fromQuestionId, userId);
    const content = src.content?.toObject ? src.content.toObject() : src.content;
    const order = s.questions.length;
    s.questions.push({ ...content, order, sourceQuestionId: src._id, sourceVersion: src.version });
  } else {
    const order = q.order !== undefined ? q.order : s.questions.length;
    s.questions.push({ ...q, order });
  }
  reindexQuestions(s);
  syncFirstQuestion(s);
  await s.save();
  return s;
};

/**
 * 修改题目（仅草稿）。
 * - createNewVersion=true 且题目来自题库：将本次修改保存为题库新版本，
 *   并把本问卷的题目指向新版本（旧问卷继续使用旧版本快照）。
 * - 否则仅修改本问卷内的快照（不会影响题库或其他问卷）。
 */
export const updateQuestion = async (id, userId, questionId, updates = {}, { createNewVersion } = {}) => {
  const s = await getSurveyById(id);
  if (!s) throw notFound('Survey not found');
  ensureOwner(s, userId);
  ensureDraft(s);
  const q = s.questions.id(questionId);
  if (!q) throw notFound('Question not found');
  Object.assign(q, updates);

  if (createNewVersion === true && q.sourceQuestionId) {
    const src = await LibraryService.assertAccessible(q.sourceQuestionId, userId);
    const content = {
      title: q.title,
      description: q.description,
      type: q.type,
      required: q.required,
      options: q.options,
      validationRule: q.validationRule,
      jumpRules: q.jumpRules
    };
    const newVersion =
      LibraryService.createNewVersionFrom
        ? await LibraryService.createNewVersionFrom(src, content, userId)
        : await LibraryService.updateQuestion(src._id, userId, { content, forceNewVersion: true });
    q.sourceQuestionId = newVersion._id;
    q.sourceVersion = newVersion.version;
  }

  reindexQuestions(s);
  syncFirstQuestion(s);
  await s.save();
  return s;
};

export const deleteQuestion = async (id, userId, questionId) => {
  const s = await getSurveyById(id);
  if (!s) throw notFound('Survey not found');
  ensureOwner(s, userId);
  ensureDraft(s);
  const q = s.questions.id(questionId);
  if (!q) throw notFound('Question not found');
  q.deleteOne();
  reindexQuestions(s);
  syncFirstQuestion(s);
  await s.save();
  return s;
};

export const reorderQuestions = async (id, userId, orderList = []) => {
  const s = await getSurveyById(id);
  if (!s) throw notFound('Survey not found');
  ensureOwner(s, userId);
  ensureDraft(s);
  const map = new Map(s.questions.map((q) => [q._id.toString(), q]));
  const next = orderList
    .map((qid, i) => {
      const q = map.get(String(qid));
      if (!q) return null;
      const obj = q.toObject ? q.toObject() : q;
      return { ...obj, order: i };
    })
    .filter(Boolean);
  s.questions = next;
  syncFirstQuestion(s);
  await s.save();
  return s;
};

export const publish = async (id, userId) => {
  const s = await getSurveyById(id);
  if (!s) throw notFound('Survey not found');
  ensureOwner(s, userId);
  if (s.status !== 'draft') throw badRequest('Survey is not in draft status');
  if (!s.questions || s.questions.length === 0)
    throw badRequest('Survey must have at least one question to publish');
  syncFirstQuestion(s);
  s.status = 'published';
  s.publishedAt = new Date();
  s.version = (s.version || 1) + 1;
  s.publishedSnapshot = s.toObject();
  await s.save();
  return s;
};

export const close = async (id, userId) => {
  const s = await getSurveyById(id);
  if (!s) throw notFound('Survey not found');
  ensureOwner(s, userId);
  if (s.status === 'closed') return s;
  s.status = 'closed';
  s.closedAt = new Date();
  await s.save();
  return s;
};

export const setDeadline = async (id, userId, deadline) => {
  const s = await getSurveyById(id);
  if (!s) throw notFound('Survey not found');
  ensureOwner(s, userId);
  s.deadline = deadline ? new Date(deadline) : null;
  await s.save();
  return s;
};

export const remove = async (id, userId) => {
  const s = await getSurveyById(id);
  if (!s) throw notFound('Survey not found');
  ensureOwner(s, userId);
  ensureDraft(s);
  await deleteSurveyById(id);
  return { id };
};

export const getPublishedForFill = async (id) => {
  const s = await Survey.findById(id).lean();
  if (!s) throw notFound('Survey not found');
  if (s.status !== 'published') throw badRequest('Survey is not published');
  if (isPast(s.deadline)) throw badRequest('Survey deadline has passed');
  return s;
};
