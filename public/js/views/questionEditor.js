import { el, mount, openModal, inputGroup, textInput, textArea, select, checkboxRow, toast } from '../ui.js';
import { TYPE_LIST, typeLabel, hasOptions, validateAnswer } from '../validate.js';
import { JUMP_OPS, opKind, emptyRule, emptyCondition } from '../jump.js';

const slug = (label, fallback) => {
  const s = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s || fallback;
};

const cleanRules = (question, type) => {
  const rule = { ...(question.validationRule || {}) };
  const keep = {};
  const num = (v) => (v === '' || v === undefined || v === null || Number.isNaN(Number(v)) ? undefined : Number(v));
  const int = (v) => (v === true || v === 'true' ? true : undefined);

  if (type === 'checkbox') {
    const exact = num(rule.exactSelected ?? rule.mustSelectCount);
    if (exact !== undefined) keep.exactSelected = exact;
    else {
      const min = num(rule.minSelected ?? rule.minCount);
      const max = num(rule.maxSelected ?? rule.maxCount);
      if (min !== undefined) keep.minSelected = min;
      if (max !== undefined) keep.maxSelected = max;
    }
  } else if (type === 'text') {
    const min = num(rule.minLength ?? rule.minWords);
    const max = num(rule.maxLength ?? rule.maxWords);
    if (min !== undefined) keep.minLength = min;
    if (max !== undefined) keep.maxLength = max;
  } else if (type === 'number') {
    if (int(rule.integer ?? rule.mustBeInteger)) keep.integer = true;
    const min = num(rule.min);
    const max = num(rule.max);
    if (min !== undefined) keep.min = min;
    if (max !== undefined) keep.max = max;
  }
  return keep;
};

const normalizeRules = (jumpRules, type) => {
  if (!['radio', 'checkbox', 'number'].includes(type)) return [];
  return (jumpRules || [])
    .map((r) => {
      const conditions = (r.when?.conditions || [])
        .map((c) => {
          const kind = opKind(c.op);
          const out = { op: c.op };
          if (kind === 'scalar' || kind === 'number') {
            if (c.value !== '' && c.value !== undefined && c.value !== null) out.value = c.value;
          } else if (kind === 'array') {
            const values = (Array.isArray(c.values) ? c.values : [c.values]).filter((v) => v !== '' && v !== undefined && v !== null);
            if (values.length) out.values = values;
          } else if (kind === 'range') {
            if (c.min !== '' && c.min !== undefined) out.min = Number(c.min);
            if (c.max !== '' && c.max !== undefined) out.max = Number(c.max);
          }
          return out;
        })
        .filter((c) => {
          if (c.op === 'isEmpty' || c.op === 'notEmpty') return true;
          if (c.values) return true;
          if (c.min !== undefined || c.max !== undefined) return true;
          return c.value !== undefined && c.value !== '';
        });
      return { when: { conditions }, gotoQuestionId: r.gotoQuestionId };
    })
    .filter((r) => r.gotoQuestionId && r.when.conditions.length > 0);
};

const conditionValueInput = (cond, question) => {
  const kind = opKind(cond.op);
  if (kind === 'none') return null;

  if (kind === 'range') {
    return el('div', { class: 'cond-range' },
      el('input', {
        class: 'input input-sm', type: 'number', value: cond.min ?? '', placeholder: '最小',
        oninput: (e) => { cond.min = e.target.value; }
      }),
      el('span', {}, '~'),
      el('input', {
        class: 'input input-sm', type: 'number', value: cond.max ?? '', placeholder: '最大',
        oninput: (e) => { cond.max = e.target.value; }
      })
    );
  }

  if (kind === 'array') {
    const options = question?.options || [];
    if (!options.length) return el('span', { class: 'field-hint' }, '该题暂无选项');
    const selected = new Set((Array.isArray(cond.values) ? cond.values : []).map(String));
    return el('div', { class: 'cond-options' },
      options.map((o) => el('label', { class: 'mini-check' },
        el('input', {
          type: 'checkbox', checked: selected.has(String(o.value)),
          onchange: (e) => {
            if (e.target.checked) selected.add(String(o.value));
            else selected.delete(String(o.value));
            cond.values = [...selected];
          }
        }),
        el('span', {}, o.label)
      ))
    );
  }

  if (question?.options?.length && ['radio', 'checkbox'].includes(question.type)) {
    return select(
      [{ value: '', label: '请选择选项' }, ...question.options.map((o) => ({ value: String(o.value), label: o.label }))],
      { class: 'input input-sm', value: cond.value ?? '', onchange: (e) => { cond.value = e.target.value; } }
    );
  }

  return el('input', {
    class: 'input input-sm', type: kind === 'number' ? 'number' : 'text',
    value: cond.value ?? '', placeholder: kind === 'number' ? '数值' : '值',
    oninput: (e) => { cond.value = e.target.value;     }
  });
};

/** 题目库专用：新建/编辑题库题目（无跳转规则，保存为 content 结构） */
export const openLibraryQuestionEditor = ({ question, onSave }) => {
  const content = question?.content
    ? { ...question.content, _id: question._id }
    : null;
  openQuestionEditor({
    survey: null,
    question: content,
    onSave: (draft) => onSave({
      content: {
        title: draft.title,
        description: draft.description,
        type: draft.type,
        required: draft.required,
        options: draft.options,
        validationRule: draft.validationRule
      }
    })
  });
};

const jumpRulesEditor = (draft, questions, selfId, refresh) => {
  const host = el('div', { class: 'jump-editor' });
  const supports = ['radio', 'checkbox', 'number'].includes(draft.type);

  const render = () => {
    mount(host,
      supports
        ? el('div', { class: 'jump-list' },
          draft.jumpRules.length === 0
            ? el('p', { class: 'field-hint' }, '暂未配置跳转规则，填写时按顺序作答')
            : draft.jumpRules.map((rule, ri) => {
              const condHost = el('div', { class: 'cond-list' });
              const target = questions.find((q) => String(q._id) === String(rule.gotoQuestionId));
              return el('div', { class: 'jump-rule' },
                el('div', { class: 'jump-rule-head' },
                  el('span', { class: 'jump-rule-title' }, `规则 ${ri + 1}`),
                  el('button', {
                    class: 'link-btn link-danger', onclick: () => {
                      draft.jumpRules.splice(ri, 1);
                      refresh();
                    }
                  }, '删除规则')
                ),
                condHost,
                el('button', {
                  class: 'link-btn', onclick: () => {
                    rule.when.conditions.push(emptyCondition());
                    refresh();
                  }
                }, '＋ 添加条件'),
                el('div', { class: 'jump-target' },
                  el('span', {}, '则跳转到'),
                  select(
                    [{ value: '', label: '请选择题目' }, ...questions
                      .filter((q) => String(q._id) !== selfId)
                      .map((q) => ({ value: String(q._id), label: `${(q.order ?? 0) + 1}. ${q.title || '未命名'}` }))],
                    {
                      class: 'input input-sm', value: rule.gotoQuestionId || '',
                      onchange: (e) => { rule.gotoQuestionId = e.target.value; refresh(); }
                    }
                  )
                ),
                target ? null : el('p', { class: 'field-msg' }, '目标题目不存在，请重新选择')
              );
            })
        )
        : el('p', { class: 'field-hint' }, '该题型不支持跳转规则（仅单选 / 多选 / 数字可用）')
    );

    if (!supports) return;

    draft.jumpRules.forEach((rule, ri) => {
      const list = host.querySelectorAll('.cond-list')[ri];
      if (!list) return;
      rule.when.conditions.forEach((cond, ci) => {
        list.appendChild(el('div', { class: 'cond-row' },
          select(JUMP_OPS.map((o) => ({ value: o.value, label: o.label })), {
            class: 'input input-sm cond-op', value: cond.op,
            onchange: (e) => { cond.op = e.target.value; refresh(); }
          }),
          conditionValueInput(cond, draft),
          el('button', {
            class: 'icon-btn', title: '删除条件', onclick: () => {
              rule.when.conditions.splice(ci, 1);
              if (rule.when.conditions.length === 0) draft.jumpRules.splice(ri, 1);
              refresh();
            }
          }, '×')
        ));
      });
    });
  };

  host.refresh = render;
  render();
  return host;
};

const optionsEditor = (draft, refresh) => {
  const host = el('div', { class: 'options-editor' });
  const render = () => {
    mount(host,
      draft.options.map((opt, i) => {
        const valueInput = el('input', {
          class: 'input input-sm option-value', placeholder: '提交值', value: opt.value,
          oninput: (e) => { opt.value = e.target.value; opt._touched = true; }
        });
        return el('div', { class: 'option-row' },
          el('span', { class: 'option-index' }, i + 1),
          el('input', {
            class: 'input input-sm option-label', placeholder: '选项文字', value: opt.label,
            oninput: (e) => {
              opt.label = e.target.value;
              if (!opt._touched) {
                opt.value = slug(opt.label, `opt${i + 1}`);
                valueInput.value = opt.value;
              }
            }
          }),
          valueInput,
          el('button', {
            class: 'icon-btn', title: '删除选项', onclick: () => {
              draft.options.splice(i, 1);
              refresh();
            }
          }, '×')
        );
      }),
      el('button', {
        class: 'link-btn', onclick: () => {
          draft.options.push({ label: '', value: `opt${draft.options.length + 1}` });
          refresh();
        }
      }, '＋ 添加选项')
    );
  };
  host.refresh = render;
  render();
  return host;
};

const validationEditor = (draft, refresh) => {
  const host = el('div', { class: 'validation-editor' });
  const render = () => {
    const r = draft.validationRule;
    if (draft.type === 'checkbox') {
      const useExact = r.exactSelected !== undefined && r.exactSelected !== '';
      mount(host,
        checkboxRow('限制选择数量', useExact || r.minSelected !== undefined || r.maxSelected !== undefined, (on) => {
          if (!on) draft.validationRule = {};
          else draft.validationRule = { minSelected: 1 };
          refresh();
        }),
        useExact
          ? inputGroup('必须恰好选择', el('input', {
            class: 'input input-sm', type: 'number', min: 1, value: r.exactSelected ?? '',
            oninput: (e) => { r.exactSelected = e.target.value === '' ? undefined : Number(e.target.value); }
          }), { hint: '填写后将忽略最小/最大限制' })
          : (r.minSelected !== undefined || r.maxSelected !== undefined || r.minCount !== undefined || r.maxCount !== undefined)
            ? el('div', { class: 'rule-grid' },
              inputGroup('至少选择', el('input', {
                class: 'input input-sm', type: 'number', min: 0, value: r.minSelected ?? r.minCount ?? '',
                oninput: (e) => { r.minSelected = e.target.value === '' ? undefined : Number(e.target.value); delete r.minCount; }
              })),
              inputGroup('最多选择', el('input', {
                class: 'input input-sm', type: 'number', min: 1, value: r.maxSelected ?? r.maxCount ?? '',
                oninput: (e) => { r.maxSelected = e.target.value === '' ? undefined : Number(e.target.value); delete r.maxCount; }
              })),
              el('button', {
                class: 'link-btn', onclick: () => {
                  draft.validationRule = { exactSelected: 2 };
                  refresh();
                }
              }, '改为「必须恰好选择 N 项」')
            )
            : el('button', {
              class: 'link-btn', onclick: () => { draft.validationRule = { minSelected: 2 }; refresh(); }
            }, '＋ 添加数量限制')
      );
      return;
    }

    if (draft.type === 'text') {
      mount(host,
        inputGroup('最少字数', el('input', {
          class: 'input input-sm', type: 'number', min: 0, value: r.minLength ?? r.minWords ?? '',
          oninput: (e) => { r.minLength = e.target.value === '' ? undefined : Number(e.target.value); delete r.minWords; }
        }), { hint: '留空表示不限制' }),
        inputGroup('最多字数', el('input', {
          class: 'input input-sm', type: 'number', min: 1, value: r.maxLength ?? r.maxWords ?? '',
          oninput: (e) => { r.maxLength = e.target.value === '' ? undefined : Number(e.target.value); delete r.maxWords; }
        }), { hint: '留空表示不限制' })
      );
      return;
    }

    if (draft.type === 'number') {
      mount(host,
        checkboxRow('必须是整数', r.integer === true || r.mustBeInteger === true, (on) => {
          if (on) r.integer = true;
          else { delete r.integer; delete r.mustBeInteger; }
        }),
        el('div', { class: 'rule-grid' },
          inputGroup('最小值', el('input', {
            class: 'input input-sm', type: 'number', value: r.min ?? '',
            oninput: (e) => { r.min = e.target.value === '' ? undefined : Number(e.target.value); }
          })),
          inputGroup('最大值', el('input', {
            class: 'input input-sm', type: 'number', value: r.max ?? '',
            oninput: (e) => { r.max = e.target.value === '' ? undefined : Number(e.target.value); }
          }))
        )
      );
      return;
    }

    mount(host, el('p', { class: 'field-hint' }, '单选题无需额外校验规则'));
  };
  host.refresh = render;
  render();
  return host;
};

/**
 * 打开题目编辑弹窗。
 * @param {{survey:any|null, question:any|null, onSave:Function}} opts
 *   - survey 存在：问卷题目编辑（可配置跳转规则、目标为问卷内其他题目）
 *   - survey 为 null：题目库编辑器（不涉及跳转规则）
 */
export const openQuestionEditor = ({ survey = null, question, onSave }) => {
  const isNew = !question;
  const isSurveyMode = Boolean(survey);
  const otherQuestions = ((survey ? survey.questions : []) || []).filter(
    (q) => !question || String(q._id) !== String(question._id)
  );

  const draft = {
    title: question?.title || '',
    description: question?.description || '',
    type: question?.type || 'radio',
    required: Boolean(question?.required),
    options: (question?.options || []).map((o) => ({ label: o.label, value: o.value, _touched: true })),
    validationRule: { ...(question?.validationRule || {}) },
    jumpRules: isSurveyMode
      ? (question?.jumpRules || []).map((r) => ({
        when: { conditions: (r.when?.conditions || []).map((c) => ({ ...c })) },
        gotoQuestionId: r.gotoQuestionId ? String(r.gotoQuestionId) : ''
      }))
      : []
  };
  if (isNew && !draft.options.length) {
    draft.options = [
      { label: '', value: 'opt1' },
      { label: '', value: 'opt2' }
    ];
  }

  let formHost, jumpHost, optHost, valHost, errHost;
  let lastValidated = null;

  const refresh = () => {
    optHost?.refresh?.();
    valHost?.refresh?.();
    jumpHost?.refresh?.();
    preview?.();
  };

  const rebuildConditional = () => {
    if (!formHost) return;
    const optWrap = formHost.querySelector('[data-slot="options"]');
    const valWrap = formHost.querySelector('[data-slot="validation"]');
    const jumpWrap = formHost.querySelector('[data-slot="jump"]');
    if (hasOptions(draft.type)) {
      optHost = optionsEditor(draft, refresh);
      mount(optWrap, inputGroup('选项列表', optHost, { hint: '「提交值」会作为答案上报，留空时根据文字自动生成' }));
    } else {
      optHost = null;
      mount(optWrap);
    }
    valHost = validationEditor(draft, refresh);
    mount(valWrap, inputGroup('校验规则', valHost));
    if (!isSurveyMode) {
      mount(jumpWrap);
      return;
    }
    jumpHost = jumpRulesEditor(draft, otherQuestions, question?._id, refresh);
    mount(jumpWrap, inputGroup('跳转规则', jumpHost, { hint: '条件之间为「或」关系，命中即跳转；未命中按顺序继续' }));
  };

  const preview = () => {
    const fake = {
      _id: 'preview',
      type: draft.type,
      required: draft.required,
      options: draft.options.map(({ label, value }) => ({ label, value })),
      validationRule: cleanRules(draft, draft.type)
    };
    let sample;
    if (draft.type === 'radio') sample = { value: draft.options[0]?.value };
    else if (draft.type === 'checkbox') sample = { selectedOptionIds: draft.options.slice(0, 1).map((o) => o.value) };
    else if (draft.type === 'text') sample = { text: '示例' };
    else sample = { value: 1 };
    const v = validateAnswer(fake, sample);
    mount(errHost,
      el('div', { class: 'preview-box' },
        el('strong', {}, '示例校验：'),
        v.valid
          ? el('span', { class: 'ok' }, '通过')
          : el('span', { class: 'bad' }, v.errors.join('；')),
        el('span', { class: 'preview-rule' }, `规则：${JSON.stringify(fake.validationRule)}`)
      )
    );
  };

  const save = () => {
    const title = draft.title.trim();
    if (!title) return toast('请填写题目标题', 'warn');
    if (hasOptions(draft.type)) {
      const opts = draft.options
        .map((o, i) => ({ label: String(o.label || '').trim(), value: String(o.value || '').trim() || slug(o.label, `opt${i + 1}`) }))
        .filter((o) => o.label);
      if (opts.length < 2) return toast('单选/多选题至少需要 2 个有效选项', 'warn');
      const values = opts.map((o) => o.value);
      if (new Set(values).size !== values.length) return toast('选项的「提交值」不能重复', 'warn');
      draft.options = opts;
    } else {
      draft.options = [];
    }
    onSave({
      title,
      description: draft.description.trim(),
      type: draft.type,
      required: draft.required,
      options: draft.options,
      validationRule: cleanRules(draft, draft.type),
      jumpRules: normalizeRules(draft.jumpRules, draft.type)
    });
  };

  openModal({
    title: isNew ? (isSurveyMode ? '添加题目' : '新建题目') : (isSurveyMode ? '编辑题目' : '编辑题目'),
    wide: true,
    body: (host) => {
      errHost = el('div', {});
      const titleEl = textInput({ value: draft.title, placeholder: '例如：你的性别', oninput: (e) => (draft.title = e.target.value) });
      const descEl = textArea({ value: draft.description, rows: 2, placeholder: '选填，题目的补充说明', oninput: (e) => (draft.description = e.target.value) });
      const typeSel = select(TYPE_LIST.map((t) => ({ value: t.value, label: t.label })), {
        value: draft.type,
        onchange: (e) => { draft.type = e.target.value; rebuildConditional(); }
      });
      const reqInput = el('input', {
        type: 'checkbox', checked: draft.required, onchange: (e) => (draft.required = e.target.checked)
      });

      formHost = el('div', { class: 'q-form' },
        errHost,
        el('div', { class: 'form-grid-2' },
          inputGroup('题目标题', titleEl, { required: true }),
          inputGroup('题型', typeSel)
        ),
        inputGroup('题目说明', descEl),
        el('label', { class: 'check-row' }, reqInput, el('span', { class: 'check-text' }, '必答题', el('small', {}, '必答题未作答时无法提交'))),
        el('div', { 'data-slot': 'options' }),
        el('div', { 'data-slot': 'validation' }),
        el('div', { 'data-slot': 'jump' })
      );
      mount(host, formHost);
      rebuildConditional();
      preview();
    },
    actions: [
      (close) => el('button', { class: 'btn btn-ghost', onclick: close }, '取消'),
      (close) => el('button', {
        class: 'btn btn-primary',
        onclick: () => { save(); close(); }
      }, isNew ? '添加' : '保存')
    ]
  });
};
