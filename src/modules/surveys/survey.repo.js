import { Survey } from './survey.model.js';

export const createSurvey = async (data) => Survey.create(data);

export const getSurveyById = async (id) => Survey.findById(id);

export const listSurveysByOwner = async (ownerId, { page = 1, limit = 20, status } = {}) => {
  const filter = { createdBy: ownerId };
  if (status) filter.status = status;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Survey.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Survey.countDocuments(filter)
  ]);
  return { items, total, page, limit, pages: Math.ceil(total / limit) || 1 };
};

export const deleteSurveyById = async (id) => Survey.findByIdAndDelete(id);
