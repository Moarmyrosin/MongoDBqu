/**
 * 跳转规则 —— 镜像 src/modules/rules/conditions.js 与 jumpEngine.js，
 * 以及 src/modules/responses/response.service.js 中的路径遍历。
 */

const eq = (a, b) => a === b;
const ne = (a, b) => a !== b;
const includes = (arr = [], v) => Array.isArray(arr) && arr.includes(v);
const notIncludes = (arr = [], v) => Array.isArray(arr) && !arr.includes(v);
const gt = (a, b) => Number(a) > Number(b);
const gte = (a, b) => Number(a) >= Number(b);
const lt = (a, b) => Number(a) < Number(b);
const lte = (a, b) => Number(a) <= Number(b);
const between = (a, min, max) => lte(a, max) && gte(a, min);
const isEmpty = (v) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
const notEmpty = (v) => !isEmpty(v);

const OPS = { eq, ne, includes, notIncludes, gt, gte, lt, lte, between, isEmpty, notEmpty };

export const JUMP_OPS = [
  { value: 'eq', label: '等于', kind: 'scalar' },
  { value: 'ne', label: '不等于', kind: 'scalar' },
  { value: 'includes', label: '包含', kind: 'array' },
  { value: 'notIncludes', label: '不包含', kind: 'array' },
  { value: 'gt', label: '大于', kind: 'number' },
  { value: 'gte', label: '大于等于', kind: 'number' },
  { value: 'lt', label: '小于', kind: 'number' },
  { value: 'lte', label: '小于等于', kind: 'number' },
  { value: 'between', label: '介于', kind: 'range' },
  { value: 'isEmpty', label: '为空', kind: 'none' },
  { value: 'notEmpty', label: '不为空', kind: 'none' }
];

export const opKind = (op) => JUMP_OPS.find((o) => o.value === op)?.kind || 'scalar';
export const opLabel = (op) => JUMP_OPS.find((o) => o.value === op)?.label || op;

export const evalCondition = (cond = {}, answer) => {
  const { op = 'eq', value, values, min, max } = cond;
  const fn = OPS[op];
  if (!fn) return false;
  if (op === 'between') return fn(answer?.value ?? answer, min, max);
  if (op === 'includes' || op === 'notIncludes') {
    return fn(
      answer?.selectedOptionIds || answer?.values || (Array.isArray(answer) ? answer : []),
      values !== undefined ? values : value
    );
  }
  if (op === 'isEmpty' || op === 'notEmpty') return fn(answer?.value ?? answer?.text ?? answer);
  return fn(answer?.value ?? answer, value);
};

export const matchAny = (conditions = [], answer) => conditions.some((c) => evalCondition(c, answer));

export const getNextQuestionId = (question, answer) => {
  for (const r of question.jumpRules || []) {
    const conditions = r.when?.conditions || [];
    if (conditions.length > 0 && matchAny(conditions, answer)) {
      return r.gotoQuestionId ? String(r.gotoQuestionId) : null;
    }
  }
  return null;
};

/** 镜像服务端：从首题沿跳转规则走一遍，再把剩余题目按 order 补齐 */
export const buildVisitOrder = (survey, rawAnswers) => {
  const questions = survey.questions || [];
  const qMap = new Map(questions.map((q) => [String(q._id), q]));
  const sortedByOrder = [...questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const firstId = survey.firstQuestionId ? String(survey.firstQuestionId) : sortedByOrder[0]?._id?.toString();

  const visited = [];
  const visitedSet = new Set();
  let currentId = firstId;
  while (currentId && qMap.has(currentId) && !visitedSet.has(currentId)) {
    visitedSet.add(currentId);
    const q = qMap.get(currentId);
    visited.push(q);
    currentId = getNextQuestionId(q, rawAnswers.get(currentId) || {});
  }
  for (const q of sortedByOrder) {
    const id = String(q._id);
    if (!visitedSet.has(id)) {
      visitedSet.add(id);
      visited.push(q);
    }
  }
  return visited;
};

/** 只沿跳转规则的"逻辑路径"（用于填写向导逐步推进），不含补齐的剩余题目 */
export const buildJumpChain = (survey, rawAnswers) => {
  const questions = survey.questions || [];
  const qMap = new Map(questions.map((q) => [String(q._id), q]));
  const sortedByOrder = [...questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const firstId = survey.firstQuestionId ? String(survey.firstQuestionId) : sortedByOrder[0]?._id?.toString();

  const chain = [];
  const seen = new Set();
  let currentId = firstId;
  while (currentId && qMap.has(currentId) && !seen.has(currentId)) {
    seen.add(currentId);
    const q = qMap.get(currentId);
    chain.push(q);
    currentId = getNextQuestionId(q, rawAnswers.get(currentId) || {});
  }
  return chain;
};

export const describeCondition = (cond, question) => {
  const { op = 'eq', value, values, min, max } = cond;
  if (op === 'isEmpty') return '为空';
  if (op === 'notEmpty') return '不为空';
  if (op === 'between') return `介于 ${min} 与 ${max}`;
  if (op === 'includes' || op === 'notIncludes') {
    const list = (Array.isArray(values) ? values : [values]).filter((v) => v !== undefined && v !== '');
    const labels = list.map((v) => (question?.options || []).find((o) => String(o.value) === String(v))?.label || v);
    return `${opLabel(op)} ${labels.join('、') || '（未选）'}`;
  }
  const label = (question?.options || []).find((o) => String(o.value) === String(value))?.label;
  return `${opLabel(op)} ${label ?? (value ?? '')}`;
};

export const describeRule = (rule, question, targetTitle) => {
  const conditions = rule.when?.conditions || [];
  const condText = conditions.length
    ? conditions.map((c) => describeCondition(c, question)).join(' 或 ')
    : '（无条件）';
  return `当 ${condText} → 跳到 ${targetTitle}`;
};

export const emptyCondition = () => ({ op: 'eq', value: '' });
export const emptyRule = () => ({ when: { conditions: [emptyCondition()] }, gotoQuestionId: '' });
