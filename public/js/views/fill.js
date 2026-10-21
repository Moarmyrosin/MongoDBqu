import { api, ApiError } from '../api.js';
import { store } from '../store.js';
import { el, mount, clear, toast, spinner, emptyState, fmtDateTime, badge } from '../ui.js';
import { validateAnswer, toAnswerPayload, emptyRaw, typeLabel, ruleSummary } from '../validate.js';
import { getNextQuestionId, buildVisitOrder, buildJumpChain } from '../jump.js';

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const sortedQuestions = (survey) => [...(survey.questions || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export const renderFill = (ctx, root) => {
  const { id } = ctx.params;
  const state = {
    survey: null,
    loginRequired: false,
    values: new Map(),
    errors: new Map(),
    mode: 'single',
    currentId: null,
    chain: [],
    visited: [],
    done: false
  };

  const content = el('div', {});

  const displayQuestions = () => {
    let qs = sortedQuestions(state.survey);
    if (state.survey.settings?.shuffleQuestions) qs = shuffle(qs);
    return qs;
  };

  const answerObj = (q) => {
    const raw = state.values.get(String(q._id));
    return raw === undefined ? {} : (() => {
      if (q.type === 'checkbox') return { selectedOptionIds: Array.isArray(raw) ? raw : [] };
      if (q.type === 'text') return { text: raw };
      return { value: raw === '' ? null : raw };
    })();
  };

  const questionInput = (q) => {
    const qid = String(q._id);
    const raw = state.values.get(qid);
    const err = state.errors.get(qid);
    const opts = state.survey.settings?.shuffleOptions && q.options ? shuffle(q.options) : q.options || [];

    let control;
    if (q.type === 'radio') {
      control = el('div', { class: 'choice-list' },
        opts.map((o) => el('label', { class: `choice ${raw === o.value ? 'choice-on' : ''}` },
          el('input', {
            type: 'radio', name: `q_${qid}`, value: o.value, checked: raw === o.value,
            onchange: () => { state.values.set(qid, o.value); state.errors.delete(qid); render(); }
          }),
          el('span', { class: 'choice-mark' }),
          el('span', {}, o.label)
        ))
      );
    } else if (q.type === 'checkbox') {
      const selected = new Set(Array.isArray(raw) ? raw : []);
      control = el('div', { class: 'choice-list' },
        opts.map((o) => el('label', { class: `choice ${selected.has(String(o.value)) ? 'choice-on' : ''}` },
          el('input', {
            type: 'checkbox', value: o.value, checked: selected.has(String(o.value)),
            onchange: (e) => {
              if (e.target.checked) selected.add(String(o.value));
              else selected.delete(String(o.value));
              state.values.set(qid, [...selected]);
              state.errors.delete(qid);
              render();
            }
          }),
          el('span', { class: 'choice-mark choice-mark-box' }),
          el('span', {}, o.label)
        ))
      );
    } else if (q.type === 'number') {
      const rule = q.validationRule || {};
      control = el('input', {
        class: 'input', type: 'number',
        min: rule.min, max: rule.max, step: rule.integer || rule.mustBeInteger ? 1 : 'any',
        value: raw ?? '', placeholder: '请输入数字',
        oninput: (e) => { state.values.set(qid, e.target.value); state.errors.delete(qid); }
      });
    } else {
      const rule = q.validationRule || {};
      control = el('textarea', {
        class: 'input', rows: 3, maxlength: rule.maxLength ?? rule.maxWords,
        value: raw ?? '', placeholder: '请输入内容',
        oninput: (e) => { state.values.set(qid, e.target.value); state.errors.delete(qid); }
      });
    }

    return el('div', { class: `fill-question ${err ? 'has-error' : ''}`, id: `fq_${qid}` },
      el('div', { class: 'fq-head' },
        el('span', { class: 'fq-title' }, q.title),
        q.required ? el('span', { class: 'req-chip' }, '必答') : null,
        ruleSummary(q) ? el('span', { class: 'rule-chip' }, ruleSummary(q)) : null
      ),
      q.description ? el('p', { class: 'fq-desc' }, q.description) : null,
      control,
      err ? el('p', { class: 'field-msg' }, err) : null
    );
  };

  const validateAll = () => {
    state.errors.clear();
    let ok = true;
    for (const q of state.survey.questions) {
      const v = validateAnswer(q, answerObj(q));
      if (!v.valid) {
        ok = false;
        state.errors.set(String(q._id), v.errors.join('；'));
      }
    }
    return ok;
  };

  const submit = async () => {
    if (!validateAll()) {
      render();
      toast('还有题目不符合要求，请检查标红的题目', 'warn');
      const firstErr = state.survey.questions.find((q) => state.errors.has(String(q._id)));
      if (firstErr && state.mode === 'wizard') {
        state.currentId = String(firstErr._id);
        state.visited.push(state.currentId);
      }
      render();
      document.getElementById(`fq_${firstErr?._id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const payload = {
      answers: state.survey.questions.map((q) => toAnswerPayload(q, state.values.get(String(q._id)) ?? emptyRaw(q)))
    };

    try {
      await api.submitResponse(id, payload);
      state.done = true;
      render();
      toast('提交成功，感谢你的填写', 'success');
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details)) {
        state.errors.clear();
        for (const d of err.details) state.errors.set(String(d.questionId), (d.errors || []).join('；'));
        const first = err.details[0];
        if (first && state.mode === 'wizard') {
          state.currentId = String(first.questionId);
          state.visited.push(state.currentId);
        }
        render();
        toast('提交校验未通过，请修正标红的题目', 'error');
        document.getElementById(`fq_${first?.questionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        toast(err.message || '提交失败', 'error');
      }
    }
  };

  const renderSingle = () => {
    const qs = displayQuestions();
    return el('div', { class: 'fill-body' },
      qs.length ? qs.map((q) => questionInput(q)) : emptyState('这份问卷还没有题目'),
      qs.length ? el('div', { class: 'fill-actions' },
        el('button', { class: 'btn btn-primary btn-lg', onclick: submit }, '提交问卷')
      ) : null
    );
  };

  const wizardIndex = () => state.chain.findIndex((q) => String(q._id) === state.currentId);

  const gotoNext = () => {
    const current = state.survey.questions.find((q) => String(q._id) === state.currentId);
    if (current) {
      const v = validateAnswer(current, answerObj(current));
      if (!v.valid) {
        state.errors.set(String(current._id), v.errors.join('；'));
        render();
        return;
      }
      state.errors.delete(String(current._id));
    }
    const jumpTo = current ? getNextQuestionId(current, answerObj(current)) : null;
    if (jumpTo && state.survey.questions.some((q) => String(q._id) === jumpTo)) {
      state.currentId = jumpTo;
      state.visited.push(jumpTo);
      render();
      scrollToTop();
      return;
    }
    const i = wizardIndex();
    if (i >= 0 && i < state.chain.length - 1) {
      state.currentId = String(state.chain[i + 1]._id);
      state.visited.push(state.currentId);
      render();
      scrollToTop();
      return;
    }
    submit();
  };

  const gotoPrev = () => {
    if (state.visited.length <= 1) return;
    state.visited.pop();
    state.currentId = state.visited[state.visited.length - 1];
    render();
    scrollToTop();
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const renderWizard = () => {
    const current = state.survey.questions.find((q) => String(q._id) === state.currentId);
    const total = state.survey.questions.length;
    const idx = wizardIndex();
    const progress = Math.round(((idx + 1) / total) * 100);
    return el('div', { class: 'fill-body' },
      el('div', { class: 'wizard-progress' },
        el('div', { class: 'wizard-bar' }, el('div', { class: 'wizard-bar-fill', style: { width: `${progress}%` } })),
        el('span', { class: 'wizard-count' }, `第 ${(idx + 1) ?? 1} / ${total} 题`)
      ),
      current ? questionInput(current) : emptyState('题目不存在'),
      el('div', { class: 'fill-actions' },
        state.visited.length > 1 ? el('button', { class: 'btn btn-ghost', onclick: gotoPrev }, '上一题') : null,
        el('button', { class: 'btn btn-primary', onclick: gotoNext }, idx >= state.chain.length - 1 ? '提交问卷' : '下一题')
      ),
      el('p', { class: 'field-hint wizard-hint' }, '已配置跳转规则时，将根据你的回答自动跳转到对应题目')
    );
  };

  const renderDone = () =>
    el('div', { class: 'fill-done' },
      el('div', { class: 'done-icon' }, '✓'),
      el('h2', {}, '提交成功'),
      el('p', {}, '感谢你的填写，答卷已保存。'),
      el('button', { class: 'btn btn-ghost', onclick: () => ctx.router.go('/') }, '返回首页')
    );

  const renderGate = (node) => el('div', { class: 'fill-gate card' }, node);

  const render = () => {
    const s = state.survey;
    if (state.done) {
      mount(content, renderDone());
      return;
    }

    const header = el('div', { class: 'fill-head' },
      el('h1', {}, s.title),
      s.description ? el('p', { class: 'fill-desc' }, s.description) : null,
      el('div', { class: 'fill-meta' },
        badge(s.status),
        el('span', {}, `${(s.questions || []).length} 题`),
        el('span', {}, `版本 v${s.version}`),
        s.deadline ? el('span', { class: 'meta-warn' }, `截止 ${fmtDateTime(s.deadline)}`) : null
      )
    );

    if (s.status !== 'published') {
      mount(content, header, renderGate(el('div', {},
        el('h3', {}, '问卷当前不可填写'),
        el('p', {}, s.status === 'closed' ? '该问卷已关闭。' : '该问卷尚未发布。')
      )));
      return;
    }

    if (state.loginRequired && !store.isLoggedIn) {
      mount(content, header, renderGate(el('div', {},
        el('h3', {}, '请先登录'),
        el('p', {}, '该问卷要求填写者登录后才能提交。'),
        el('div', { class: 'gate-actions' },
          el('a', { class: 'btn btn-primary', href: '#/login' }, '去登录'),
          el('a', { class: 'btn btn-ghost', href: '#/register' }, '注册账号')
        )
      )));
      return;
    }

    mount(content, header, state.mode === 'wizard' ? renderWizard() : renderSingle());
  };

  const bootWizard = () => {
    const qs = displayQuestions();
    const firstId = state.survey.firstQuestionId
      ? String(state.survey.firstQuestionId)
      : qs[0]?._id && String(qs[0]._id);
    state.chain = buildJumpChain({ ...state.survey, questions: qs }, new Map());
    if (!state.currentId) {
      state.currentId = firstId || qs[0]?._id && String(qs[0]._id);
      state.visited = state.currentId ? [state.currentId] : [];
    }
  };

  const load = async () => {
    mount(content, spinner('加载问卷…'));
    try {
      const res = await api.getForm(id, store.isLoggedIn);
      state.survey = res.data.survey;
      state.loginRequired = res.data.loginRequiredToFill !== false;
      state.mode = state.survey.settings?.showProgress ? 'wizard' : 'single';
      for (const q of state.survey.questions || []) state.values.set(String(q._id), emptyRaw(q));
      if (state.mode === 'wizard') bootWizard();
      render();
    } catch (err) {
      mount(content, emptyState(err.message || '问卷加载失败', el('a', { class: 'btn btn-ghost', href: '#/' }, '返回首页')));
    }
  };

  mount(root, el('div', { class: 'page page-fill' }, content));
  load();
};
