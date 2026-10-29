import { randomUUID } from 'node:crypto';
import { Survey } from '../surveys/survey.model.js';
import {
  createResponse,
  hasUserResponded,
  hasAnonymousResponded,
  getAllResponsesBySurvey,
  listResponsesBySurvey
} from './response.repo.js';
import { badRequest, notFound, forbidden } from '../../common/errors/index.js';
import { isPast } from '../../common/utils/time.js';
import {
  validateAnswerForQuestion,
  serializeAnswerForQuestion
} from '../questions/questionTypes.js';
import { getNextQuestionId } from '../rules/jumpEngine.js';

const buildQuestionMap = (questions = []) => {
  const m = new Map();
  questions.forEach((q) => {
    const key = q._id?.toString();
    if (key) m.set(key, q);
  });
  return m;
};

export const submitResponse = async ({
  surveyId,
  userId,
  anonymousId: anonIn,
  answersInput = [],
  ipAddress,
  userAgent
}) => {
  const survey = await Survey.findById(surveyId);
  if (!survey) throw notFound('Survey not found');
  if (survey.status !== 'published') throw badRequest('Survey is not published');
  if (isPast(survey.deadline)) throw badRequest('Survey deadline has passed');

  const settings = survey.settings || {};
  const loginRequired = settings.loginRequiredToFill !== false;

  let effectiveUserId = userId || null;
  let effectiveAnonId = anonIn || null;

  if (loginRequired && !effectiveUserId) {
    throw badRequest('Login is required to fill this survey');
  }
  if (!loginRequired && !effectiveUserId && !effectiveAnonId) {
    effectiveAnonId = `anon_${randomUUID()}`;
  }

  if (!settings.allowMultipleResponses) {
    if (effectiveUserId && (await hasUserResponded(surveyId, effectiveUserId))) {
      throw badRequest('You have already submitted this survey');
    }
    if (effectiveAnonId && (await hasAnonymousResponded(surveyId, effectiveAnonId))) {
      throw badRequest('This respondent has already submitted this survey');
    }
  }

  const questions = survey.questions || [];
  const qMap = buildQuestionMap(questions);
  const answerByQid = new Map();
  (answersInput || []).forEach((a) => {
    if (a?.questionId) answerByQid.set(a.questionId.toString(), a);
  });

  const sortedByOrder = [...questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const firstId = survey.firstQuestionId?.toString() || sortedByOrder[0]?._id?.toString();

  const errors = [];
  const validatedAnswers = [];
  const visitedSet = new Set();

  let currentId = firstId;
  while (currentId && qMap.has(currentId) && !visitedSet.has(currentId)) {
    visitedSet.add(currentId);
    const q = qMap.get(currentId);
    const rawA = answerByQid.get(currentId) || {};
    const v = validateAnswerForQuestion(q, rawA);
    if (!v.valid) errors.push({ questionId: currentId, errors: v.errors });
    const sA = serializeAnswerForQuestion(q, rawA);
    validatedAnswers.push({
      questionId: q._id,
      sourceQuestionId: q.sourceQuestionId || undefined,
      type: q.type,
      ...sA
    });
    currentId = getNextQuestionId(q, rawA);
  }

  for (const q of sortedByOrder) {
    const id = q._id.toString();
    if (!visitedSet.has(id)) {
      visitedSet.add(id);
      const rawA = answerByQid.get(id) || {};
      const v = validateAnswerForQuestion(q, rawA);
      if (!v.valid) errors.push({ questionId: id, errors: v.errors });
      const sA = serializeAnswerForQuestion(q, rawA);
      validatedAnswers.push({
        questionId: q._id,
        sourceQuestionId: q.sourceQuestionId || undefined,
        type: q.type,
        ...sA
      });
    }
  }

  if (errors.length > 0) {
    const err = badRequest('Response validation failed');
    err.details = errors;
    throw err;
  }

  return await createResponse({
    surveyId: survey._id,
    userId: effectiveUserId,
    anonymousId: effectiveAnonId,
    surveyVersion: survey.version,
    answers: validatedAnswers,
    isComplete: true,
    ipAddress: settings.collectIp ? ipAddress : undefined,
    userAgent,
    submittedAt: new Date()
  });
};

export const getSurveyResponsesList = async (surveyId, ownerId, opts) => {
  const survey = await Survey.findById(surveyId).select('_id createdBy');
  if (!survey) throw notFound('Survey not found');
  if (survey.createdBy.toString() !== ownerId.toString())
    throw forbidden('You do not own this survey');
  return await listResponsesBySurvey(surveyId, opts);
};

export const getAllResponses = async (surveyId, ownerId) => {
  const survey = await Survey.findById(surveyId).select('_id createdBy');
  if (!survey) throw notFound('Survey not found');
  if (survey.createdBy.toString() !== ownerId.toString())
    throw forbidden('You do not own this survey');
  return await getAllResponsesBySurvey(surveyId);
};
