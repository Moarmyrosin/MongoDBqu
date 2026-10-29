import { el } from '../ui.js';

export const renderBreakdown = (q) => {
  const rows = [...(q.breakdown || [])].sort((a, b) => (b.count || 0) - (a.count || 0));
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

export const renderNumber = (q) => {
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

export const renderTextList = (q, { cap = 0 } = {}) => {
  let list = q.textAnswers || [];
  if (cap && list.length > cap) list = list.slice(0, cap);
  if (!list.length) return el('p', { class: 'field-hint' }, '暂无文字作答');
  return el('div', {},
    el('ul', { class: 'text-list' }, list.map((t, i) => el('li', {}, el('span', { class: 'text-idx' }, i + 1), el('span', {}, t)))),
    cap && (q.textAnswers?.length || 0) > cap
      ? el('p', { class: 'field-hint' }, `仅展示最近 ${cap} 条，共 ${(q.textAnswers || []).length} 条`)
      : null
  );
};
