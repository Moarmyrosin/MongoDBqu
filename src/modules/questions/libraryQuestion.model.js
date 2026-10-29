import mongoose from 'mongoose';

const optionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
    score: { type: Number },
    imageUrl: { type: String, trim: true }
  },
  { _id: false }
);

const jumpConditionSchema = new mongoose.Schema(
  {
    op: {
      type: String,
      enum: ['eq', 'ne', 'includes', 'notIncludes', 'gt', 'gte', 'lt', 'lte', 'between', 'isEmpty', 'notEmpty'],
      default: 'eq'
    },
    value: { type: mongoose.Schema.Types.Mixed },
    values: [{ type: mongoose.Schema.Types.Mixed }],
    min: { type: Number },
    max: { type: Number }
  },
  { _id: false }
);

const jumpWhenSchema = new mongoose.Schema(
  {
    conditions: [jumpConditionSchema]
  },
  { _id: false }
);

const jumpRuleSchema = new mongoose.Schema(
  {
    when: jumpWhenSchema,
    gotoQuestionId: { type: mongoose.Schema.Types.ObjectId, required: false }
  },
  { _id: false }
);

const questionContentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    type: {
      type: String,
      enum: ['radio', 'checkbox', 'text', 'number'],
      required: true,
      default: 'radio'
    },
    required: { type: Boolean, default: false },
    options: [optionSchema],
    validationRule: { type: mongoose.Schema.Types.Mixed, default: {} },
    jumpRules: [jumpRuleSchema]
  },
  { _id: false }
);

const libraryQuestionSchema = new mongoose.Schema(
  {
    content: { type: questionContentSchema, required: true },
    bankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuestionBank',
      index: true,
      default: null
    },
    rootQuestionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LibraryQuestion'
    },
    previousVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LibraryQuestion',
      default: null
    },
    previousVersion: { type: Number, default: null },
    version: { type: Number, default: 1 },
    status: { type: String, enum: ['active', 'deleted'], default: 'active', index: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
);

libraryQuestionSchema.index({ createdBy: 1, updatedAt: -1 });
libraryQuestionSchema.index({ rootQuestionId: 1, version: 1 });
libraryQuestionSchema.index({ sharedWith: 1, updatedAt: -1 });
libraryQuestionSchema.index({ 'content.title': 'text' });

export const LibraryQuestion = mongoose.model('LibraryQuestion', libraryQuestionSchema);
