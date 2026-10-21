import asyncHandler from 'express-async-handler';
import * as AnalyticsService from './analytics.service.js';
import { success } from '../../common/response/index.js';

export const getSurveyAnalytics = asyncHandler(async (req, res) => {
  const data = await AnalyticsService.getSurveyAnalytics(req.params.id, req.user._id);
  return success(res, data);
});

export const getQuestionAnalytics = asyncHandler(async (req, res) => {
  const data = await AnalyticsService.getQuestionAnalytics(
    req.params.id,
    req.params.qid,
    req.user._id
  );
  return success(res, data);
});
