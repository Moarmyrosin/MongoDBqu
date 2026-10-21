import asyncHandler from 'express-async-handler';
import * as ResponseService from './response.service.js';
import { success, created } from '../../common/response/index.js';

export const submitResponse = asyncHandler(async (req, res) => {
  const ipAddress =
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];
  const resp = await ResponseService.submitResponse({
    surveyId: req.params.id,
    userId: req.user?._id || null,
    anonymousId: req.body?.anonymousId || null,
    answersInput: req.body?.answers || [],
    ipAddress,
    userAgent
  });
  return created(res, resp, 'Response submitted');
});

export const listSurveyResponses = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const data = await ResponseService.getSurveyResponsesList(req.params.id, req.user._id, {
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 50
  });
  return success(res, data);
});
