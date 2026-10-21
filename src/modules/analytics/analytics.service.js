import { Survey } from '../surveys/survey.model.js';
import { getAllResponses } from '../responses/response.service.js';
import { notFound, forbidden } from '../../common/errors/index.js';

const toStr = (v) => (v === undefined || v === null ? '' : String(v));

export const getSurveyAnalytics = async (surveyId, ownerId) => {
  const survey = await Survey.findById(surveyId).lean();
  if (!survey) throw notFound('Survey not found');
  if (survey.createdBy.toString() !== ownerId.toString())
    throw forbidden('You do not own this survey');

  const responses = await getAllResponses(surveyId, ownerId);
  const totalResponses = responses.length;
  const questions = survey.questions || [];

  const qResults = questions.map((q) => {
    const base = {
      questionId: q._id,
      title: q.title,
      type: q.type,
      required: q.required,
      totalAnswers: 0,
      breakdown: [],
      textAnswers: [],
      numericValues: [],
      average: null,
      min: null,
      max: null,
      sum: null,
      countNumeric: 0
    };

    if (q.type === 'radio') {
      const optionMap = new Map((q.options || []).map((o) => [toStr(o.value), { ...o, count: 0 }]));
      for (const r of responses) {
        const a = (r.answers || []).find((x) => x.questionId?.toString() === q._id.toString());
        if (a && a.value !== undefined && a.value !== null && a.value !== '') {
          const k = toStr(a.value);
          if (optionMap.has(k)) {
            optionMap.get(k).count++;
            base.totalAnswers++;
          }
        }
      }
      base.breakdown = [...optionMap.values()].map((o) => ({
        label: o.label,
        value: o.value,
        count: o.count
      }));
      return base;
    }

    if (q.type === 'checkbox') {
      const optionMap = new Map((q.options || []).map((o) => [toStr(o.value), { ...o, count: 0 }]));
      for (const r of responses) {
        const a = (r.answers || []).find((x) => x.questionId?.toString() === q._id.toString());
        const sel = a?.selectedOptionIds || [];
        if (Array.isArray(sel)) {
          const seen = new Set();
          sel.forEach((v) => {
            const k = toStr(v);
            if (optionMap.has(k) && !seen.has(k)) {
              optionMap.get(k).count++;
              seen.add(k);
            }
          });
          if (sel.length > 0) base.totalAnswers++;
        }
      }
      base.breakdown = [...optionMap.values()].map((o) => ({
        label: o.label,
        value: o.value,
        count: o.count
      }));
      return base;
    }

    if (q.type === 'text') {
      const texts = [];
      for (const r of responses) {
        const a = (r.answers || []).find((x) => x.questionId?.toString() === q._id.toString());
        const t = a?.text ?? '';
        if (typeof t === 'string' && t.trim() !== '') {
          texts.push(t.trim());
          base.totalAnswers++;
        }
      }
      base.textAnswers = texts;
      return base;
    }

    if (q.type === 'number') {
      const nums = [];
      for (const r of responses) {
        const a = (r.answers || []).find((x) => x.questionId?.toString() === q._id.toString());
        const v = a?.value;
        if (v !== undefined && v !== null && v !== '') {
          const n = Number(v);
          if (!Number.isNaN(n)) {
            nums.push(n);
            base.totalAnswers++;
          }
        }
      }
      if (nums.length > 0) {
        const sum = nums.reduce((s, x) => s + x, 0);
        base.numericValues = nums;
        base.countNumeric = nums.length;
        base.sum = sum;
        base.average = parseFloat((sum / nums.length).toFixed(4));
        base.min = Math.min(...nums);
        base.max = Math.max(...nums);
      }
      return base;
    }

    return base;
  });

  return {
    surveyId,
    title: survey.title,
    totalResponses,
    questions: qResults
  };
};

export const getQuestionAnalytics = async (surveyId, questionId, ownerId) => {
  const full = await getSurveyAnalytics(surveyId, ownerId);
  const q = full.questions.find((x) => x.questionId?.toString() === questionId.toString());
  if (!q) throw notFound('Question not found');
  return {
    surveyId,
    totalResponses: full.totalResponses,
    question: q
  };
};
