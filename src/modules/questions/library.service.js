import { Types } from 'mongoose';
import { LibraryQuestion } from './libraryQuestion.model.js';
import { QuestionBank } from './questionBank.model.js';
import { Survey } from '../surveys/survey.model.js';
import { Response } from '../responses/response.model.js';
import { User } from '../users/user.model.js';
import * as repo from './library.repo.js';
import { badRequest, notFound, forbidden } from '../../common/errors/index.js';

const toStr = (v) => (v === undefined || v === null ? '' : String(v));
const oid = (v) => new Types.ObjectId(String(v));
const same = (a, b) => String(a?._id ?? a) === String(b?._id ?? b);

const sanitizeContent = (content = {}) => {
  const out = {
    title: String(content.title || '').trim(),
    description: String(content.description || '').trim(),
    type: content.type || 'radio',
    required: Boolean(content.required),
    options: Array.isArray(content.options)
      ? content.options
          .map((o, i) => ({
            label: String(o?.label || '').trim(),
            value: String(o?.value || '').trim() || `opt${i + 1}`
          }))
          .filter((o) => o.label)
      : [],
    validationRule: content.validationRule && typeof content.validationRule === 'object'
      ? content.validationRule
      : {}
  };
  if (!out.title) throw badRequest('Question title is required');
  if (['radio', 'checkbox'].includes(out.type) && out.options.length < 2)
    throw badRequest('Radio/checkbox questions need at least 2 options');
  if (!['radio', 'checkbox', 'text', 'number'].includes(out.type))
    throw badRequest('Unsupported question type');
  if (['radio', 'checkbox'].includes(out.type)) {
    const values = out.options.map((o) => o.value);
    if (new Set(values).size !== values.length) throw badRequest('Duplicate option values');
  } else if (out.type !== 'number') {
    out.options = [];
  }
  const v = out.validationRule || {};
  if (out.type === 'checkbox') {
    const n = (x) => (x === undefined || x === null || x === '' ? undefined : Number(x));
    const exact = n(v.exactSelected);
    const min = n(v.minSelected);
    const max = n(v.maxSelected);
    if ([exact, min, max].some((x) => x !== undefined && Number.isNaN(x)))
      throw badRequest('Invalid validation rule');
  }
  if (out.type === 'number' || out.type === 'text') {
    for (const key of ['min', 'max', 'minLength', 'maxLength']) {
      if (v[key] !== undefined && v[key] !== null && v[key] !== '' && Number.isNaN(Number(v[key])))
        throw badRequest('Invalid validation rule');
    }
  }
  return out;
};

const ensureReadAccess = (q, userId) => {
  const uid = String(userId);
  const isOwner = String(q.createdBy?._id ?? q.createdBy) === uid;
  const isShared = (q.sharedWith || []).some((u) => String(u?._id ?? u) === uid);
  if (!isOwner && !isShared) throw forbidden('You do not have access to this question');
  return { isOwner, isShared };
};

const ensureOwner = (q, userId) => {
  if (String(q.createdBy?._id ?? q.createdBy) !== String(userId))
    throw forbidden('Only the question owner can do this');
};

const getLatestVersion = async (rootId) =>
  (await repo.getLatestVersion(rootId))?.version || 0;

const nextContentForNewVersion = (source, content) => ({
  ...source,
  ...content,
  title: content.title?.trim() ? content.title.trim() : source.title
});

/** 创建题目（可挂在题库下） */
export const createQuestion = async (userId, { content, bankId }) => {
  const safe = sanitizeContent(content);
  let bank = null;
  if (bankId) {
    bank = await repo.getBankById(bankId);
    if (!bank) throw notFound('Question bank not found');
    ensureOwner(bank, userId);
  }
  const doc = await repo.createQuestion({ content: safe, bankId: bank?._id ?? null, createdBy: userId });
  // 统一版本链：根版本自己的 rootQuestionId 指向自身
  doc.rootQuestionId = doc._id;
  await doc.save();
  return doc;
};

/** 我的题目 */
export const listMine = async (userId, { bankId, search, page = 1, limit = 100 } = {}) => {
  const filter = { status: 'active' };
  if (bankId) filter.bankId = oid(bankId);
  if (search && String(search).trim()) {
    filter['content.title'] = { $regex: String(search).trim(), $options: 'i' };
  }
  return repo.listQuestionsByOwner({ ownerId: userId, filter, page, limit });
};

/** 共享给我的题目 */
export const listSharedWithMe = async (userId, { search, page = 1, limit = 100 } = {}) => {
  const filter = { status: 'active' };
  if (search && String(search).trim()) {
    filter['content.title'] = { $regex: String(search).trim(), $options: 'i' };
  }
  return repo.listQuestionsSharedWith({ userId, filter, page, limit });
};

/** 题目详情（拥有者或被共享者可见） */
export const getById = async (id, userId) => {
  const q = await repo.getQuestionById(id);
  if (!q || q.status !== 'active') throw notFound('Question not found');
  ensureReadAccess(q, userId);
  return q;
};

/** 题目允许被读取（问卷内嵌入使用） */
export const assertAccessible = async (questionId, userId) => {
  const q = await repo.getQuestionById(questionId);
  if (!q || q.status !== 'active') throw notFound('Question not found');
  ensureReadAccess(q, userId);
  return q;
};

/**
 * 修改题目。
 * - createNewVersion=true（或非拥有者修改）：基于旧版本生成新版本，旧版本保持不变，
 *   历史问卷继续使用旧版本快照，互不影响。
 * - createNewVersion=false 且是拥有者：原地修改该版本内容（只影响之后选取该版本的新问卷）。
 */
export const updateQuestion = async (id, userId, { content, createNewVersion }) => {
  const source = await LibraryQuestion.findById(id);
  if (!source || source.status !== 'active') throw notFound('Question not found');
  const { isOwner } = ensureReadAccess(source, userId);
  const safe = sanitizeContent(content || source.toObject().content);

  const shouldBranch = (!isOwner && createNewVersion === undefined) || createNewVersion === true;
  if (!shouldBranch) {
    ensureOwner(source, userId);
    source.content = safe;
    await source.save();
    return source;
  }

  const rootId = source.rootQuestionId || source._id;
  const nextVersion = (await getLatestVersion(rootId)) + 1;
  const doc = new LibraryQuestion({
    content: nextContentForNewVersion(source.toObject().content, safe),
    bankId: source.bankId,
    rootQuestionId: rootId,
    previousVersionId: source._id,
    previousVersion: source.version,
    version: nextVersion,
    createdBy: userId,
    sharedWith: []
  });
  await doc.save();
  return doc;
};

/** 删除题目（软删除，关联版本链保留） */
export const deleteQuestion = async (id, userId) => {
  const q = await LibraryQuestion.findById(id);
  if (!q || q.status !== 'active') throw notFound('Question not found');
  ensureOwner(q, userId);
  q.status = 'deleted';
  await q.save();
  return { id };
};

/** 版本历史（含当前题所在链路） */
export const getVersionHistory = async (id, userId) => {
  const q = await repo.getQuestionById(id);
  if (!q || q.status !== 'active') throw notFound('Question not found');
  ensureReadAccess(q, userId);
  const rootId = q.rootQuestionId || q._id;
  const versions = await repo.listVersionsByRoot(rootId);
  return {
    rootQuestionId: rootId,
    latestVersion: versions[0]?.version ?? q.version,
    versions: versions.map((v) => ({
      _id: v._id,
      version: v.version,
      title: v.content?.title,
      type: v.content?.type,
      previousVersion: v.previousVersion,
      createdBy: v.createdBy?._id ?? v.createdBy,
      creatorName: v.createdBy?.username,
      createdAt: v.createdAt
    }))
  };
};

/** 从某个历史版本“恢复”：= 以该版本内容创建新版本 */
export const restoreVersion = async (id, versionId, userId) => {
  const source = await LibraryQuestion.findById(id);
  if (!source || source.status !== 'active') throw notFound('Question not found');
  ensureReadAccess(source, userId);
  const old = await LibraryQuestion.findById(versionId);
  if (!old) throw notFound('Old version not found');
  const rootId = old.rootQuestionId || old._id;
  if (String(rootId) !== String(source.rootQuestionId || source._id))
    throw badRequest('Version does not belong to the same question chain');
  const nextVersion = (await getLatestVersion(rootId)) + 1;
  const doc = new LibraryQuestion({
    content: old.content,
    bankId: source.bankId,
    rootQuestionId: rootId,
    previousVersionId: old._id,
    previousVersion: old.version,
    version: nextVersion,
    createdBy: userId,
    sharedWith: []
  });
  await doc.save();
  return doc;
};

export const createNewVersionFrom = async (source, contentOverwrite, userId) => {
  const rootId = source.rootQuestionId || source._id;
  const nextVersion = (await getLatestVersion(rootId)) + 1;
  const doc = new LibraryQuestion({
    content: nextContentForNewVersion(source.content.toObject ? source.content.toObject() : source.content, contentOverwrite),
    bankId: source.bankId ?? null,
    rootQuestionId: rootId,
    previousVersionId: source._id,
    previousVersion: source.version,
    version: nextVersion,
    createdBy: userId,
    sharedWith: []
  });
  await doc.save();
  return doc;
};

/** 分享给其他用户 */
export const updateShare = async (id, userId, { addUsernames = [], removeUserIds = [] }) => {
  const q = await LibraryQuestion.findById(id);
  if (!q || q.status !== 'active') throw notFound('Question not found');
  ensureOwner(q, userId);

  const current = new Map((q.sharedWith || []).map((u) => [String(u?._id ?? u), u]));

  for (const name of [].concat(addUsernames || [])) {
    const username = String(name || '').trim();
    if (!username) continue;
    const target = await User.findOne({ username }).select('_id username');
    if (!target) throw notFound(`User "${username}" not found`);
    if (same(target._id, userId)) throw badRequest('Cannot share with yourself');
    current.set(String(target._id), target._id);
  }
  for (const rid of [].concat(removeUserIds || [])) {
    current.delete(String(rid));
  }
  q.sharedWith = [...current.values()];
  await q.save();
  return q;
};

/** 当前共享名单 */
export const listSharedUsers = async (id, userId) => {
  const q = await repo.getQuestionById(id);
  if (!q || q.status !== 'active') throw notFound('Question not found');
  ensureOwner(q, userId);
  const ids = (q.sharedWith || []).map((u) => (u?._id ?? u));
  const users = await User.find({ _id: { $in: ids } }).select('username email createdAt').lean();
  return users;
};

/** 查看题目被哪些问卷使用（当前版本 + 整个版本链） */
export const getUsage = async (id, userId, { includeVersions = true } = {}) => {
  const q = await repo.getQuestionById(id);
  if (!q || q.status !== 'active') throw notFound('Question not found');
  ensureReadAccess(q, userId);
  const rootId = q.rootQuestionId || q._id;
  const versionIds = includeVersions
    ? (await repo.listVersionsByRoot(rootId)).map((v) => v._id)
    : [q._id];

  const surveys = await Survey.find(
    { 'questions.sourceQuestionId': { $in: versionIds } },
    { title: 1, status: 1, version: 1, createdAt: 1, questions: 1 }
  )
    .populate('createdBy', 'username')
    .lean();

  const vidSet = new Set(versionIds.map(String));
  const usage = surveys.map((s) => {
    const matched = (s.questions || []).filter((sq) => sq.sourceQuestionId && vidSet.has(String(sq.sourceQuestionId)));
    return {
      surveyId: s._id,
      surveyTitle: s.title,
      surveyStatus: s.status,
      surveyVersion: s.version,
      owner: s.createdBy?.username ?? s.createdBy,
      isOwnerSurvey: same(s.createdBy?._id ?? s.createdBy, userId),
      questionInstanceId: matched[0]?._id,
      usedVersions: [...new Set(matched.map((m) => String(m.sourceQuestionId).toString()))]
    };
  });
  return {
    questionId: id,
    version: q.version,
    includeVersions,
    totalSurveys: usage.length,
    surveys: usage
  };
};

/**
 * 单题跨问卷统计：汇聚该题（含版本链上所有版本）在
 * 「我拥有且使用了该题」的问卷中的全部答卷作答。
 */
export const getQuestionAnalytics = async (id, userId, { includeVersions = true } = {}) => {
  const q = await repo.getQuestionById(id);
  if (!q || q.status !== 'active') throw notFound('Question not found');
  ensureReadAccess(q, userId);
  const rootId = q.rootQuestionId || q._id;
  const versions = includeVersions
    ? await repo.listVersionsByRoot(rootId)
    : [q].map((v) => ({ ...v }));

  const versionIds = versions.map((v) => v._id);
  const vidSet = new Set(versionIds.map(String));

  const surveys = (await Survey.find(
    { 'questions.sourceQuestionId': { $in: versionIds }, createdBy: userId },
    { title: 1, status: 1, questions: 1, version: 1 }
  ).lean());

  // 问卷-版本 映射：每个问卷里哪些嵌入题目对应哪个库版本
  const surveyVersionMap = new Map(
    surveys.map((s) => {
      const matched = (s.questions || []).filter((sq) => sq.sourceQuestionId && vidSet.has(String(sq.sourceQuestionId)));
      return [
        String(s._id),
        {
          surveyTitle: s.title,
          surveyStatus: s.status,
          surveyVersion: s.version,
          instanceIds: matched.map((m) => String(m._id)),
          sourceIds: matched.map((m) => String(m.sourceQuestionId))
        }
      ];
    })
  );

  const usedSurveyIds = [...surveyVersionMap.keys()];
  const responses = usedSurveyIds.length
    ? await Response.find({ surveyId: { $in: usedSurveyIds.map((s) => oid(s)) } }).lean()
    : [];

  const type = q.content?.type;
  const stat = {
    totalAnswers: 0,
    breakdown: [],
    textAnswers: [],
    countNumeric: 0,
    sum: null,
    average: null,
    min: null,
    max: null
  };

  // 每份答卷中该题的作答（按版本链内所有对题实例匹配）
  const answersOf = (r) => {
    const sv = surveyVersionMap.get(String(r.surveyId?._id ?? r.surveyId));
    if (!sv) return [];
    const allow = new Set(sv.sourceIds);
    return (r.answers || []).filter(
      (a) =>
        (a.sourceQuestionId && allow.has(String(a.sourceQuestionId))) ||
        allow.has(String(a.questionId))
    );
  };

  let respondentCount = 0;

  if (type === 'radio' || type === 'checkbox') {
    const labels = new Map();
    const counts = new Map();
    for (const opt of versions.flatMap((v) => v.content?.options || [])) {
      labels.set(String(opt.value), opt.label);
      if (!counts.has(String(opt.value))) counts.set(String(opt.value), 0);
    }
    for (const r of responses) {
      const answers = answersOf(r);
      if (!answers.length) continue;
      respondentCount++;
      for (const a of answers) {
        if (type === 'radio') {
          const k = toStr(a.value);
          if (!k || !labels.has(k)) continue;
          counts.set(k, counts.get(k) + 1);
          stat.totalAnswers++;
        } else {
          const sel = Array.isArray(a.selectedOptionIds) ? a.selectedOptionIds : [];
          const seen = new Set();
          for (const v of sel) {
            const k = toStr(v);
            if (!k || seen.has(k) || !labels.has(k)) continue;
            seen.add(k);
            counts.set(k, counts.get(k) + 1);
          }
          if (sel.length) stat.totalAnswers++;
        }
      }
    }
    stat.breakdown = [...counts.entries()].map(([value, count]) => ({
      value,
      label: labels.get(value) ?? value,
      count
    }));
  } else if (type === 'number') {
    const nums = [];
    for (const r of responses) {
      const answers = answersOf(r);
      if (!answers.length) continue;
      respondentCount++;
      for (const a of answers) {
        const raw = a.value;
        if (raw === undefined || raw === null || raw === '') continue;
        const n = Number(raw);
        if (!Number.isNaN(n)) {
          nums.push(n);
          stat.totalAnswers++;
        }
      }
    }
    if (nums.length) {
      stat.countNumeric = nums.length;
      stat.sum = nums.reduce((s, x) => s + x, 0);
      stat.average = parseFloat((stat.sum / nums.length).toFixed(4));
      stat.min = Math.min(...nums);
      stat.max = Math.max(...nums);
    }
  } else if (type === 'text') {
    for (const r of responses) {
      const answers = answersOf(r);
      if (!answers.length) continue;
      respondentCount++;
      for (const a of answers) {
        const t = toStr(a.text).trim();
        if (!t) continue;
        stat.textAnswers.push(t);
        stat.totalAnswers++;
      }
    }
  }

  stat.totalRespondents = respondentCount;

  return {
    questionId: id,
    rootQuestionId: rootId,
    title: q.content?.title,
    type,
    version: q.version,
    includeVersions,
    totalResponses: respondentCount,
    totalAnswerSets: usedSurveyIds.length,
    surveyCount: usedSurveyIds.length,
    surveys: usedSurveyIds.map((sid) => ({
      surveyId: sid,
      ...surveyVersionMap.get(sid)
    })),
    stat
  };
};

/* ---------------- 题库 ---------------- */

export const createBank = async (userId, { name, description }) => {
  if (!name || !String(name).trim()) throw badRequest('Bank name is required');
  return repo.createBank({
    name: String(name).trim(),
    description: String(description || '').trim(),
    createdBy: userId
  });
};

export const listBanks = async (userId) => {
  const banks = await repo.listBanksByOwner(userId);
  const counts = await LibraryQuestion.aggregate([
    { $match: { bankId: { $in: banks.map((b) => b._id) } } },
    { $group: { _id: '$bankId', count: { $sum: 1 } } }
  ]);
  const map = new Map(counts.map((c) => [String(c._id), c.count]));
  return banks.map((b) => ({ ...b, questionCount: map.get(String(b._id)) || 0 }));
};

const getBankDocChecked = async (id, userId) => {
  const bank = await repo.getBankDoc(id);
  if (!bank) throw notFound('Question bank not found');
  ensureOwner(bank, userId);
  return bank;
};

export const updateBank = async (id, userId, { name, description }) => {
  const bank = await getBankDocChecked(id, userId);
  if (name !== undefined) {
    if (!String(name).trim()) throw badRequest('Bank name is required');
    bank.name = String(name).trim();
  }
  if (description !== undefined) bank.description = String(description).trim();
  await bank.save();
  return bank;
};

export const deleteBank = async (id, userId) => {
  const bank = await getBankDocChecked(id, userId);
  await repo.clearBankOfQuestions(bank._id);
  await repo.deleteBankById(bank._id);
  return { id };
};

export const listBankQuestions = async (id, userId) => {
  const bank = await repo.getBankById(id);
  if (!bank) throw notFound('Question bank not found');
  if (String(bank.createdBy?._id ?? bank.createdBy) !== String(userId))
    throw forbidden('Only the bank owner can view its questions');
  const items = await LibraryQuestion.find({ bankId: bank._id, status: 'active' })
    .sort({ updatedAt: -1 })
    .lean();
  return { bank, items, total: items.length };
};

export const addQuestionToBank = async (bankId, questionId, userId) => {
  const bank = await getBankDocChecked(bankId, userId);
  const q = await LibraryQuestion.findById(questionId);
  if (!q || q.status !== 'active') throw notFound('Question not found');
  ensureReadAccess(q, userId);
  q.bankId = bank._id;
  await q.save();
  return q;
};

export const removeQuestionFromBank = async (bankId, questionId, userId) => {
  const bank = await getBankDocChecked(bankId, userId);
  const q = await LibraryQuestion.findById(questionId);
  if (!q) throw notFound('Question not found');
  if (q.bankId && !same(q.bankId, bank._id)) throw badRequest('Question is not in this bank');
  q.bankId = null;
  await q.save();
  return q;
};
