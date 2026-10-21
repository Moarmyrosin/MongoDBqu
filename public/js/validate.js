/**
 * 客户端校验 —— 严格镜像 src/modules/questions/questionTypes.js。
 * 后端调整校验规则时，同步修改本文件与 endpoints.js 之外无需改动其它地方。
 */

const QUESTION_TYPES = {
  radio: { label: '单选题', hasOptions: true },
  checkbox: { label: '多选题', hasOptions: true },
  text: { label: '文本填空', hasOptions: false },
  number: { label: '数字填空', hasOptions: false }
};

export const TYPE_LIST = Object.entries(QUESTION_TYPES).map(([value, v]) => ({
  value,
  label: v.label,
  hasOptions: v.hasOptions
}));

export const typeLabel = (type) => QUESTION_TYPES[type]?.label || type;
export const hasOptions = (type) => Boolean(QUESTION_TYPES[type]?.hasOptions);

const asArray = (v) => {
  let arr = Array.isArray(v) ? v : [];
  return arr.filter((x) => x !== undefined && x !== null && x !== '');
};

export const validateAnswer = (question, answer) => {
  const errors = [];
  const rule = question.validationRule || {};
  const required = Boolean(question.required);

  if (question.type === 'radio') {
    const val = answer?.value;
    if (required && (val === undefined || val === null || val === '')) {
      return { valid: false, errors: ['必答题，不能为空'] };
    }
    if (val !== undefined && val !== null && val !== '') {
      const validVals = (question.options || []).map((o) => String(o.value));
      if (!validVals.includes(String(val))) errors.push('选项不合法');
    }
  } else if (question.type === 'checkbox') {
    const selected = asArray(answer?.selectedOptionIds || answer?.values);
    const count = selected.length;
    const min = rule.minSelected !== undefined ? rule.minSelected : rule.minCount;
    const max = rule.maxSelected !== undefined ? rule.maxSelected : rule.maxCount;
    const exact = rule.exactSelected !== undefined ? rule.exactSelected : rule.mustSelectCount;
    if (required && count === 0) return { valid: false, errors: ['必答题，请至少选择一项'] };
    if (exact !== undefined && count !== exact) errors.push(`必须恰好选择 ${exact} 项`);
    if (min !== undefined && count < min) errors.push(`至少选择 ${min} 项`);
    if (max !== undefined && count > max) errors.push(`最多选择 ${max} 项`);
    if (count > 0) {
      const validSet = new Set((question.options || []).map((o) => String(o.value)));
      if (selected.some((v) => !validSet.has(String(v)))) errors.push('包含无效选项');
    }
  } else if (question.type === 'text') {
    const raw = answer?.text ?? answer?.value ?? '';
    const t = typeof raw === 'string' ? raw : String(raw ?? '');
    const minLen = rule.minLength !== undefined ? rule.minLength : rule.minWords;
    const maxLen = rule.maxLength !== undefined ? rule.maxLength : rule.maxWords;
    if (required && t.trim().length === 0) return { valid: false, errors: ['必答题，不能为空'] };
    if (minLen !== undefined && t.length < minLen) errors.push(`最少 ${minLen} 个字符`);
    if (maxLen !== undefined && t.length > maxLen) errors.push(`最多 ${maxLen} 个字符`);
  } else if (question.type === 'number') {
    const raw = answer?.value ?? answer?.number ?? answer?.text;
    const empty = raw === undefined || raw === null || String(raw).trim() === '';
    if (required && empty) return { valid: false, errors: ['必答题，不能为空'] };
    if (!empty) {
      const s = String(raw).trim();
      const isInt = rule.integer === true || rule.mustBeInteger === true;
      const okFormat = isInt ? /^-?\d+$/.test(s) : /^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?$/.test(s);
      if (!okFormat) {
        errors.push(isInt ? '必须是整数' : '必须是合法数字');
      } else {
        const num = isInt ? parseInt(s, 10) : parseFloat(s);
        if (rule.min !== undefined && num < rule.min) errors.push(`不能小于 ${rule.min}`);
        if (rule.max !== undefined && num > rule.max) errors.push(`不能大于 ${rule.max}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
};

/** 把表单里的原始值转换成可提交的 answer 结构 */
export const toAnswerPayload = (question, raw) => {
  const base = { questionId: String(question._id) };
  if (question.type === 'radio') return { ...base, value: raw === '' || raw === undefined ? null : raw };
  if (question.type === 'checkbox') return { ...base, selectedOptionIds: asArray(raw).map(String) };
  if (question.type === 'text') return { ...base, text: typeof raw === 'string' ? raw : String(raw ?? '') };
  if (question.type === 'number') {
    const s = raw === undefined || raw === null ? '' : String(raw).trim();
    return { ...base, value: s === '' ? null : s };
  }
  return { ...base, value: raw };
};

/** 各题型的表单初始值 */
export const emptyRaw = (question) => {
  if (question.type === 'checkbox') return [];
  if (question.type === 'number') return '';
  return '';
};

/** 规则摘要，用于编辑器里的提示文字 */
export const ruleSummary = (question) => {
  const rule = question.validationRule || {};
  const parts = [];
  if (question.type === 'checkbox') {
    const exact = rule.exactSelected ?? rule.mustSelectCount;
    const min = rule.minSelected ?? rule.minCount;
    const max = rule.maxSelected ?? rule.maxCount;
    if (exact !== undefined) parts.push(`必须选 ${exact} 项`);
    else {
      if (min !== undefined) parts.push(`至少 ${min} 项`);
      if (max !== undefined) parts.push(`至多 ${max} 项`);
    }
  }
  if (question.type === 'text') {
    const min = rule.minLength ?? rule.minWords;
    const max = rule.maxLength ?? rule.maxWords;
    if (min !== undefined) parts.push(`≥${min} 字`);
    if (max !== undefined) parts.push(`≤${max} 字`);
  }
  if (question.type === 'number') {
    if (rule.integer || rule.mustBeInteger) parts.push('整数');
    if (rule.min !== undefined && rule.max !== undefined) parts.push(`${rule.min}~${rule.max}`);
    else if (rule.min !== undefined) parts.push(`≥${rule.min}`);
    else if (rule.max !== undefined) parts.push(`≤${rule.max}`);
  }
  return parts.join(' · ');
};
