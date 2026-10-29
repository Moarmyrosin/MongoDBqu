import { LibraryQuestion } from './libraryQuestion.model.js';
import { QuestionBank } from './questionBank.model.js';

export const createQuestion = async (data) => LibraryQuestion.create(data);

export const getQuestionById = (id) => LibraryQuestion.findById(id).lean();

export const getQuestionDoc = (id) => LibraryQuestion.findById(id);

export const listQuestionsByOwner = ({ ownerId, filter = {}, page = 1, limit = 100 }) => {
  const q = { ...filter, createdBy: ownerId };
  const skip = (page - 1) * limit;
  return Promise.all([
    LibraryQuestion.find(q).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    LibraryQuestion.countDocuments(q)
  ]).then(([items, total]) => ({ items, total, page, limit, pages: Math.ceil(total / limit) || 1 }));
};

export const listQuestionsSharedWith = ({ userId, filter = {}, page = 1, limit = 100 }) => {
  const q = { ...filter, sharedWith: userId };
  const skip = (page - 1) * limit;
  return Promise.all([
    LibraryQuestion.find(q)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'username')
      .lean(),
    LibraryQuestion.countDocuments(q)
  ]).then(([items, total]) => ({ items, total, page, limit, pages: Math.ceil(total / limit) || 1 }));
};

export const getLatestVersion = async (rootId) =>
  LibraryQuestion.findOne({ rootQuestionId: rootId }).sort({ version: -1 }).lean();

export const listVersionsByRoot = (rootId) =>
  LibraryQuestion.find({ rootQuestionId: rootId }).sort({ version: -1 }).lean();

export const saveQuestion = (doc) => doc.save();

export const createBank = (data) => QuestionBank.create(data);

export const getBankById = (id) => QuestionBank.findById(id).lean();

export const listBanksByOwner = (ownerId) =>
  QuestionBank.find({ createdBy: ownerId }).sort({ updatedAt: -1 }).lean();

export const saveBank = (doc) => doc.save();

export const getBankDoc = (id) => QuestionBank.findById(id);

export const deleteBankById = (id) => QuestionBank.findByIdAndDelete(id);

export const clearBankOfQuestions = (bankId) =>
  LibraryQuestion.updateMany({ bankId }, { $set: { bankId: null } });

export const replaceSharedWith = async (id, userIds) => {
  await LibraryQuestion.updateOne({ _id: id }, { $set: { sharedWith: userIds } });
};
