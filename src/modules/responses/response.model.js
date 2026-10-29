import mongoose from 'mongoose';

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // 该题目在题库中的来源版本，用于跨问卷单题统计
    sourceQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryQuestion' },
    type: { type: String, enum: ['radio', 'checkbox', 'text', 'number'], required: true },
    value: { type: mongoose.Schema.Types.Mixed },
    selectedOptionIds: [{ type: String }],
    text: { type: String },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { _id: false }
);

const responseSchema = new mongoose.Schema(
  {
    surveyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Survey',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null
    },
    anonymousId: { type: String, index: true },
    surveyVersion: { type: Number },
    answers: [answerSchema],
    isComplete: { type: Boolean, default: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    submittedAt: { type: Date, default: Date.now, index: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
);

responseSchema.index({ surveyId: 1, submittedAt: -1 });
responseSchema.index({ surveyId: 1, userId: 1 });
responseSchema.index({ surveyId: 1, anonymousId: 1 });

export const Response = mongoose.model('Response', responseSchema);
