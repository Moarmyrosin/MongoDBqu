import asyncHandler from 'express-async-handler';
import * as LibraryService from './library.service.js';
import { success, created, noContent } from '../../common/response/index.js';

/* ---------- 题目 ---------- */

export const createQuestion = asyncHandler(async (req, res) => {
  const doc = await LibraryService.createQuestion(req.user._id, req.body);
  return created(res, doc, 'Question saved to library');
});

export const listMyQuestions = asyncHandler(async (req, res) => {
  const data = await LibraryService.listMine(req.user._id, {
    bankId: req.query.bankId,
    search: req.query.search,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 100
  });
  return success(res, data);
});

export const listSharedQuestions = asyncHandler(async (req, res) => {
  const data = await LibraryService.listSharedWithMe(req.user._id, {
    search: req.query.search,
    page: req.query.page ? Number(req.query.page) : 1,
    limit: req.query.limit ? Number(req.query.limit) : 100
  });
  return success(res, data);
});

export const getQuestion = asyncHandler(async (req, res) => {
  const doc = await LibraryService.getById(req.params.id, req.user._id);
  return success(res, doc);
});

export const updateQuestion = asyncHandler(async (req, res) => {
  const doc = await LibraryService.updateQuestion(req.params.id, req.user._id, req.body);
  return success(res, doc, 'Question updated');
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  await LibraryService.deleteQuestion(req.params.id, req.user._id);
  return noContent(res);
});

export const getVersionHistory = asyncHandler(async (req, res) => {
  const data = await LibraryService.getVersionHistory(req.params.id, req.user._id);
  return success(res, data);
});

export const restoreVersion = asyncHandler(async (req, res) => {
  const { versionId } = req.body || {};
  const doc = await LibraryService.restoreVersion(req.params.id, versionId, req.user._id);
  return created(res, doc, 'Version restored as new version');
});

export const getUsage = asyncHandler(async (req, res) => {
  const data = await LibraryService.getUsage(req.params.id, req.user._id, {
    includeVersions: req.query.includeVersions !== 'false'
  });
  return success(res, data);
});

export const getQuestionAnalytics = asyncHandler(async (req, res) => {
  const data = await LibraryService.getQuestionAnalytics(req.params.id, req.user._id, {
    includeVersions: req.query.includeVersions !== 'false'
  });
  return success(res, data);
});

export const updateShare = asyncHandler(async (req, res) => {
  const doc = await LibraryService.updateShare(req.params.id, req.user._id, req.body || {});
  return success(res, doc, 'Sharing updated');
});

export const listSharedUsers = asyncHandler(async (req, res) => {
  const data = await LibraryService.listSharedUsers(req.params.id, req.user._id);
  return success(res, data);
});

/* ---------- 题库 ---------- */

export const createBank = asyncHandler(async (req, res) => {
  const doc = await LibraryService.createBank(req.user._id, req.body);
  return created(res, doc, 'Bank created');
});

export const listBanks = asyncHandler(async (req, res) => {
  const data = await LibraryService.listBanks(req.user._id);
  return success(res, data);
});

export const updateBank = asyncHandler(async (req, res) => {
  const doc = await LibraryService.updateBank(req.params.id, req.user._id, req.body);
  return success(res, doc, 'Bank updated');
});

export const deleteBank = asyncHandler(async (req, res) => {
  await LibraryService.deleteBank(req.params.id, req.user._id);
  return noContent(res);
});

export const listBankQuestions = asyncHandler(async (req, res) => {
  const data = await LibraryService.listBankQuestions(req.params.id, req.user._id);
  return success(res, data);
});

export const addQuestionToBank = asyncHandler(async (req, res) => {
  const doc = await LibraryService.addQuestionToBank(req.params.id, req.body.questionId, req.user._id);
  return success(res, doc, 'Question added to bank');
});

export const removeQuestionFromBank = asyncHandler(async (req, res) => {
  const doc = await LibraryService.removeQuestionFromBank(req.params.id, req.params.qid, req.user._id);
  return success(res, doc, 'Question removed from bank');
});
