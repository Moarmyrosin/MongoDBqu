import { matchAny } from './conditions.js';

export const getNextQuestionId = (question, answer) => {
  const rules = question.jumpRules || [];
  for (const r of rules) {
    const when = r.when || {};
    const conditions = when.conditions || [];
    if (matchConditions(conditions, answer)) {
      return r.gotoQuestionId ? r.gotoQuestionId.toString() : null;
    }
  }
  return null;
};

const matchConditions = (conditions, answer) => {
  if (!conditions || conditions.length === 0) return false;
  return matchAny(conditions, answer);
};
