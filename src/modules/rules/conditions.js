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
  v === undefined ||
  v === null ||
  (typeof v === 'string' && v.trim() === '') ||
  (Array.isArray(v) && v.length === 0);
const notEmpty = (v) => !isEmpty(v);

const ops = { eq, ne, includes, notIncludes, gt, gte, lt, lte, between, isEmpty, notEmpty };

export const evalCondition = (cond = {}, answer) => {
  const { op = 'eq', value, values, min, max } = cond;
  const fn = ops[op];
  if (!fn) return false;
  if (op === 'between') return fn(answer?.value ?? answer, min, max);
  if (op === 'includes' || op === 'notIncludes')
    return fn(
      answer?.selectedOptionIds || answer?.values || (Array.isArray(answer) ? answer : []),
      values !== undefined ? values : value
    );
  if (op === 'isEmpty' || op === 'notEmpty') return fn(answer?.value ?? answer?.text ?? answer);
  return fn(answer?.value ?? answer, value);
};

export const matchAny = (conditions = [], answer) =>
  conditions.some((c) => evalCondition(c, answer));
