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
    gotoQuestionId: { type: mongoose.Schema.Types.ObjectId, required: true }
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
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
    order: { type: Number, default: 0 },
    options: [optionSchema],
    validationRule: { type: mongoose.Schema.Types.Mixed, default: {} },
    jumpRules: [jumpRuleSchema],
    // 来源题库题目版本（从题目库选用的题目会记录来源，用于版本历史 / 使用统计 / 跨问卷统计）
    sourceQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LibraryQuestion' },
    sourceVersion: { type: Number },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { _id: true }
);

const sectionSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    order: { type: Number, default: 0 },
    questionIds: [{ type: mongoose.Schema.Types.ObjectId }]
  },
  { _id: false }
);

const surveySettingsSchema = new mongoose.Schema(
  {
    allowAnonymous: { type: Boolean, default: true },
    allowMultipleResponses: { type: Boolean, default: true },
    loginRequiredToFill: { type: Boolean, default: true },
    showProgress: { type: Boolean, default: false },
    shuffleQuestions: { type: Boolean, default: false },
    shuffleOptions: { type: Boolean, default: false },
    collectIp: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { _id: false }
);

const surveySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ['draft', 'published', 'closed'],
      default: 'draft',
      index: true
    },
    settings: { type: surveySettingsSchema, default: () => ({}) },
    sections: [sectionSchema],
    questions: [questionSchema],
    firstQuestionId: { type: mongoose.Schema.Types.ObjectId },
    deadline: { type: Date },
    publishedAt: { type: Date },
    closedAt: { type: Date },
    version: { type: Number, default: 1 },
    publishedSnapshot: { type: mongoose.Schema.Types.Mixed },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
);

surveySchema.index({ createdBy: 1, createdAt: -1 });
surveySchema.index({ status: 1, publishedAt: -1 });
surveySchema.index({ deadline: 1 });

surveySchema.pre('save', function (next) {
  if (this.questions && this.questions.length > 0) {
    this.questions.forEach((q, i) => {
      if (q.order === undefined || q.order === null) q.order = i;
    });
    if (!this.firstQuestionId) {
      const first = [...this.questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
      this.firstQuestionId = first._id;
    }
  }
  next();
});

export const Survey = mongoose.model('Survey', surveySchema);
