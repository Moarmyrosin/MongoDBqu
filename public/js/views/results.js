import { api } from '../api.js';
import { el, mount, clear, toast, badge, fmtDateTime, spinner, emptyState } from '../ui.js';
import { typeLabel } from '../validate.js';

const renderBreakdown = (q) => {
  const rows = q.breakdown || [];
  const total = rows.reduce((s, r) => s + (r.count || 0), 0);
  const max = Math.max(1, ...rows.map((r) => r.count || 0));
  if (!rows.length) return el('p', { class: 'field-hint' }, '暂无数据');
  return el('div', { class: 'bar-chart' },
    rows.map((r) => {
      const count = r.count || 0;
      const pct = total ? Math.round((count / total) * 100) : 0;
      return el('div', { class: 'bar-row' },
        el('span', { class: 'bar-label', title: r.label }, r.label),
        el('div', { class: 'bar-track' },
          el('div', { class: 'bar-fill', style: { width: `${(count / max) * 100}%` } })
        ),
        el('span', { class: 'bar-count' }, count),
        el('span', { class: 'bar-pct' }, `${pct}%`)
      );
    }),
    el('p', { class: 'chart-total' }, `共 ${total} 人次选择`)
  );
};

const renderNumber = (q) => {
  if (!q.countNumeric) return el('p', { class: 'field-hint' }, '暂无数字作答');
  return el('div', { class: 'stat-grid' },
    [
      ['作答人数', q.countNumeric],
      ['平均值', q.average ?? '—'],
      ['最小值', q.min ?? '—'],
      ['最大值', q.max ?? '—'],
      ['合计', q.sum ?? '—']
    ].map(([k, v]) => el('div', { class: 'stat-cell' }, el('span', { class: 'stat-k' }, k), el('strong', {}, String(v))))
  );
};

const renderText = (q) => {
  const list = q.textAnswers || [];
  if (!list.length) return el('p', { class: 'field-hint' }, '暂无文字作答');
  return el('ul', { class: 'text-list' }, list.map((t, i) => el('li', {}, el('span', { class: 'text-idx' }, i + 1), el('span', {}, t))));
};

const answerSummary = (a, questionMap) => {
  const q = questionMap.get(String(a.questionId));
  const label = q?.title || '已删除的题目';
  let valueText = '';
  if (a.type === 'radio') {
    const opt = (q?.options || []).find((o) => String(o.value) === String(a.value));
    valueText = opt?.label || String(a.value ?? '—');
  } else if (a.type === 'checkbox') {
    const ids = a.selectedOptionIds || [];
    valueText = ids.length
      ? ids.map((v) => (q?.options || []).find((o) => String(o.value) === String(v))?.label || v).join('、')
      : '—';
  } else if (a.type === 'text') {
    valueText = a.text || '—';
  } else {
    valueText = a.value === null || a.value === undefined ? '—' : String(a.value);
  }
  return el('div', { class: 'resp-answer' },
    el('span', { class: 'resp-q' }, label),
    el('span', { class: 'resp-v' }, valueText)
  );
};

export const renderResults = (ctx, root) => {
  const { id } = ctx.params;
  const state = { tab: 'analytics', page: 1, limit: 20 };
  let survey = null;
  let analytics = null;
  let responses = null;

  const tabsHost = el('div', { class: 'tabs' });
  const content = el('div', {});

  const loadAnalytics = async () => {
    const [s, a] = await Promise.all([api.getSurvey(id), api.surveyAnalytics(id)]);
    survey = s.data;
    analytics = a.data;
  };

  const loadResponses = async () => {
    const r = await api.listResponses(id, { page: state.page, limit: state.limit });
    responses = r.data;
  };

  const renderTabs = () => {
    clear(tabsHost);
    [['analytics', '统计分析'], ['responses', `答卷明细 (${analytics?.totalResponses ?? 0})`]].forEach(([key, label]) => {
      tabsHost.appendChild(el('button', {
        class: `tab ${state.tab === key ? 'tab-active' : ''}`,
        onclick: () => { state.tab = key; renderContent(); }
      }, label));
    });
  };

  const renderAnalytics = () => {
    const questionMap = new Map((survey.questions || []).map((q) => [String(q._id), q]));
    const qs = [...(survey.questions || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (!qs.length) return emptyState('该问卷还没有题目');
    return el('div', { class: 'analytics-list' },
      qs.map((q, i) => {
        const stat = (analytics.questions || []).find((x) => String(x.questionId) === String(q._id)) || {};
        return el('section', { class: 'card section-card' },
          el('div', { class: 'section-head' },
            el('h3', {}, `${i + 1}. ${q.title}`),
            el('div', { class: 'q-title-row' },
              el('span', { class: `type-chip type-${q.type}` }, typeLabel(q.type)),
              el('span', { class: 'meta-dim' }, `作答 ${stat.totalAnswers ?? 0} 人次`)
            )
          ),
          q.type === 'radio' || q.type === 'checkbox' ? renderBreakdown(stat) : null,
          q.type === 'number' ? renderNumber(stat) : null,
          q.type === 'text' ? renderText(stat) : null
        );
      }),
      el('p', { class: 'chart-total' }, `统计基于全部 ${analytics.totalResponses} 份答卷，自动实时更新`)
    );
  };

  const renderResponseList = () => {
    const questionMap = new Map((survey.questions || []).map((q) => [String(q._id), q]));
    if (!responses?.items?.length) return emptyState('还没有人填写这份问卷');
    return el('div', { class: 'response-list' },
      responses.items.map((r, i) => el('div', { class: 'card response-card' },
        el('div', { class: 'resp-head' },
          el('span', { class: 'resp-no' }, `#${(state.page - 1) * state.limit + i + 1}`),
          el('span', { class: 'meta-dim' }, fmtDateTime(r.submittedAt)),
          el('span', { class: 'meta-dim' }, r.userId ? '登录用户' : `匿名 ${String(r.anonymousId || '').slice(0, 12)}`),
          el('span', { class: 'meta-dim' }, `问卷版本 v${r.surveyVersion}`)
        ),
        el('div', { class: 'resp-answers' }, (r.answers || []).map((a) => answerSummary(a, questionMap)))
      )),
      el('div', { class: 'pager' },
        el('span', { class: 'pager-info' }, `共 ${responses.total} 份`),
        el('button', {
          class: 'btn btn-ghost btn-sm', disabled: state.page <= 1,
          onclick: () => { state.page--; loadResponses().then(renderContent).catch((e) => toast(e.message, 'error')); }
        }, '上一页'),
        el('span', { class: 'pager-page' }, `${state.page} / ${responses.pages || 1}`),
        el('button', {
          class: 'btn btn-ghost btn-sm', disabled: state.page >= (responses.pages || 1),
          onclick: () => { state.page++; loadResponses().then(renderContent).catch((e) => toast(e.message, 'error')); }
        }, '下一页')
      )
    );
  };

  const renderContent = () => {
    renderTabs();
    mount(content, state.tab === 'analytics' ? renderAnalytics() : renderResponseList());
    const sub = root.querySelector('.page-sub');
    if (sub) sub.textContent = `${analytics.totalResponses} 份答卷 · 问卷版本 v${survey.version}`;
  };

  const load = async () => {
    mount(content, spinner('加载统计…'));
    try {
      await loadAnalytics();
      if (state.tab === 'responses') await loadResponses();
      renderContent();
    } catch (err) {
      mount(content, emptyState(err.message || '加载失败', el('button', {
        class: 'btn btn-ghost', onclick: () => ctx.router.go('/surveys')
      }, '返回列表')));
    }
  };

  mount(root,
    el('div', { class: 'page' },
      el('div', { class: 'page-head' },
        el('div', {},
          el('a', { class: 'back-link', href: '#/surveys' }, '← 我的问卷'),
          el('h2', {}, '统计结果'),
          el('p', { class: 'page-sub' }, '加载中…')
        ),
        el('button', { class: 'btn btn-ghost', onclick: load }, '刷新')
      ),
      tabsHost, content
    )
  );
  load();
};
