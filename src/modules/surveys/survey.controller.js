import asyncHandler from 'express-async-handler';
import * as SurveyService from './survey.service.js';
import { success, created, noContent } from '../../common/response/index.js';

export const createSurvey = asyncHandler(async (req, res) => {
  const doc = await SurveyService.create({ userId: req.user._id, ...req.body });
  return created(res, doc, 'Survey created');
});

export const listMySurveys = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const data = await SurveyService.listMine(req.user._id, {
    page: page ? Number(page) : 1,
    limit: limit ? Number(limit) : 20,
    status
  });
  return success(res, data);
});

export const getSurvey = asyncHandler(async (req, res) => {
  const s = await SurveyService.getById(req.params.id);
  return success(res, s);
});

export const updateSurvey = asyncHandler(async (req, res) => {
  const s = await SurveyService.updateBasic(req.params.id, req.user._id, req.body);
  return success(res, s, 'Survey updated');
});

export const deleteSurvey = asyncHandler(async (req, res) => {
  await SurveyService.remove(req.params.id, req.user._id);
  return noContent(res);
});

export const addQuestion = asyncHandler(async (req, res) => {
  const s = await SurveyService.addQuestion(req.params.id, req.user._id, req.body);
  return success(res, s, 'Question added');
});

export const updateQuestion = asyncHandler(async (req, res) => {
  const s = await SurveyService.updateQuestion(req.params.id, req.user._id, req.params.qid, req.body);
  return success(res, s, 'Question updated');
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  const s = await SurveyService.deleteQuestion(req.params.id, req.user._id, req.params.qid);
  return success(res, s, 'Question deleted');
});

export const reorderQuestions = asyncHandler(async (req, res) => {
  const { order } = req.body;
  const s = await SurveyService.reorderQuestions(req.params.id, req.user._id, order || []);
  return success(res, s, 'Questions reordered');
});

export const publishSurvey = asyncHandler(async (req, res) => {
  const s = await SurveyService.publish(req.params.id, req.user._id);
  return success(res, s, 'Survey published');
});

export const closeSurvey = asyncHandler(async (req, res) => {
  const s = await SurveyService.close(req.params.id, req.user._id);
  return success(res, s, 'Survey closed');
});

export const setDeadline = asyncHandler(async (req, res) => {
  const { deadline } = req.body;
  const s = await SurveyService.setDeadline(req.params.id, req.user._id, deadline);
  return success(res, s, 'Deadline updated');
});

export const getSurveyForm = asyncHandler(async (req, res) => {
  const s = await SurveyService.getPublishedForFill(req.params.id);
  const { loginRequiredToFill = true } = s.settings || {};
  return success(res, { survey: s, loginRequiredToFill });
});
