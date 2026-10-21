const base = {
  validate() {
    return { valid: true, errors: [] };
  },
  serializeAnswer() {
    return {};
  }
};

const radio = {
  type: 'radio',
  validate(question, answer) {
    const errors = [];
    const val = answer?.value;
    if (question.required && (val === undefined || val === null || val === '')) {
      errors.push('This question is required');
      return { valid: false, errors };
    }
    if (val !== undefined && val !== null && val !== '') {
      const validVals = (question.options || []).map((o) => String(o.value));
      if (!validVals.includes(String(val))) {
        errors.push('Invalid option selected');
        return { valid: false, errors };
      }
    }
    return { valid: true, errors: [] };
  },
  serializeAnswer(question, answer) {
    return { value: answer?.value ?? null };
  }
};

const checkbox = {
  type: 'checkbox',
  validate(question, answer) {
    const errors = [];
    let selected = answer?.selectedOptionIds || answer?.values || [];
    if (!Array.isArray(selected)) selected = [];
    selected = selected.filter((v) => v !== undefined && v !== null && v !== '');
    const count = selected.length;
    const rule = question.validationRule || {};
    const required = question.required;
    const min = rule.minSelected !== undefined ? rule.minSelected : rule.minCount;
    const max = rule.maxSelected !== undefined ? rule.maxSelected : rule.maxCount;
    const exact = rule.exactSelected !== undefined ? rule.exactSelected : rule.mustSelectCount;

    if (required && count === 0) {
      errors.push('This question is required');
      return { valid: false, errors };
    }
    if (exact !== undefined && count !== exact) {
      errors.push(`Must select exactly ${exact} option(s)`);
      return { valid: false, errors };
    }
    if (min !== undefined && count < min) {
      errors.push(`Must select at least ${min} option(s)`);
      return { valid: false, errors };
    }
    if (max !== undefined && count > max) {
      errors.push(`Must select at most ${max} option(s)`);
      return { valid: false, errors };
    }
    if (count > 0) {
      const validSet = new Set((question.options || []).map((o) => String(o.value)));
      if (selected.some((v) => !validSet.has(String(v)))) {
        errors.push('Invalid option(s) selected');
        return { valid: false, errors };
      }
    }
    return { valid: true, errors: [] };
  },
  serializeAnswer(question, answer) {
    let selected = answer?.selectedOptionIds || answer?.values || [];
    if (!Array.isArray(selected)) selected = [];
    selected = [...new Set(selected.map((v) => String(v)))];
    return { selectedOptionIds: selected };
  }
};

const text = {
  type: 'text',
  validate(question, answer) {
    const errors = [];
    const textVal = answer?.text ?? answer?.value ?? '';
    const t = typeof textVal === 'string' ? textVal : String(textVal ?? '');
    const rule = question.validationRule || {};
    const minLen = rule.minLength !== undefined ? rule.minLength : rule.minWords;
    const maxLen = rule.maxLength !== undefined ? rule.maxLength : rule.maxWords;

    if (question.required && t.trim().length === 0) {
      errors.push('This question is required');
      return { valid: false, errors };
    }
    if (minLen !== undefined && t.length < minLen) {
      errors.push(`Minimum length is ${minLen}`);
      return { valid: false, errors };
    }
    if (maxLen !== undefined && t.length > maxLen) {
      errors.push(`Maximum length is ${maxLen}`);
      return { valid: false, errors };
    }
    return { valid: true, errors: [] };
  },
  serializeAnswer(question, answer) {
    const textVal = answer?.text ?? answer?.value ?? '';
    return { text: typeof textVal === 'string' ? textVal : String(textVal ?? '') };
  }
};

const number = {
  type: 'number',
  validate(question, answer) {
    const errors = [];
    const raw = answer?.value ?? answer?.number ?? answer?.text;
    const required = question.required;
    const empty = raw === undefined || raw === null || String(raw).trim() === '';
    if (required && empty) {
      errors.push('This question is required');
      return { valid: false, errors };
    }
    if (empty) return { valid: true, errors: [] };

    const s = String(raw).trim();
    const isIntOnly =
      question.validationRule?.integer === true || question.validationRule?.mustBeInteger === true;

    let num;
    if (isIntOnly) {
      if (!/^-?\d+$/.test(s)) {
        errors.push('Must be an integer');
        return { valid: false, errors };
      }
      num = parseInt(s, 10);
    } else {
      if (!/^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?$/.test(s)) {
        errors.push('Must be a valid number');
        return { valid: false, errors };
      }
      num = parseFloat(s);
    }

    const rule = question.validationRule || {};
    if (rule.min !== undefined && num < rule.min) {
      errors.push(`Minimum value is ${rule.min}`);
      return { valid: false, errors };
    }
    if (rule.max !== undefined && num > rule.max) {
      errors.push(`Maximum value is ${rule.max}`);
      return { valid: false, errors };
    }
    return { valid: true, errors: [] };
  },
  serializeAnswer(question, answer) {
    const raw = answer?.value ?? answer?.number ?? answer?.text;
    if (raw === undefined || raw === null || String(raw).trim() === '')
      return { value: null };
    const s = String(raw).trim();
    const isIntOnly =
      question.validationRule?.integer === true || question.validationRule?.mustBeInteger === true;
    if (isIntOnly && /^-?\d+$/.test(s)) return { value: parseInt(s, 10) };
    if (/^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?$/.test(s)) return { value: parseFloat(s) };
    return { value: s };
  }
};

const registry = new Map();
[radio, checkbox, text, number].forEach((t) => registry.set(t.type, t));

export const QuestionTypeRegistry = {
  register(type, impl = base) {
    registry.set(type, { ...base, type, ...impl });
  },
  get(type) {
    return registry.get(type) || { ...base, type: type || 'text' };
  },
  has(type) {
    return registry.has(type);
  },
  list() {
    return Array.from(registry.keys());
  }
};

export const validateAnswerForQuestion = (question, answer) => {
  const impl = QuestionTypeRegistry.get(question.type);
  return impl.validate(question, answer || {});
};

export const serializeAnswerForQuestion = (question, answer) => {
  const impl = QuestionTypeRegistry.get(question.type);
  return impl.serializeAnswer(question, answer || {});
};
