import { Response } from './response.model.js';

export const createResponse = async (data) => Response.create(data);

export const listResponsesBySurvey = async (surveyId, { page = 1, limit = 50 } = {}) => {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Response.find({ surveyId })
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Response.countDocuments({ surveyId })
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) || 1 };
};

export const hasUserResponded = async (surveyId, userId) => {
  if (!userId) return false;
  return !!(await Response.exists({ surveyId, userId }));
};

export const hasAnonymousResponded = async (surveyId, anonymousId) => {
  if (!anonymousId) return false;
  return !!(await Response.exists({ surveyId, anonymousId }));
};

export const getAllResponsesBySurvey = async (surveyId) =>
  Response.find({ surveyId }).lean();
