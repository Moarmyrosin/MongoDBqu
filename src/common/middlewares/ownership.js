import asyncHandler from 'express-async-handler';
import { Survey } from '../../modules/surveys/survey.model.js';
import { forbidden, notFound } from '../errors/index.js';

export const requireSurveyOwner = asyncHandler(async (req, res, next) => {
  const surveyId = req.params.id || req.params.surveyId;
  const survey = await Survey.findById(surveyId).select('_id createdBy status');
  if (!survey) return next(notFound('Survey not found'));
  if (survey.createdBy.toString() !== req.user._id.toString()) {
    return next(forbidden('You do not own this survey'));
  }
  req.survey = survey;
  next();
});
