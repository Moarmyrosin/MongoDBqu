import { api } from '../api.js';
import { el, mount, toast, badge, spinner, emptyState } from '../ui.js';
import { typeLabel } from '../validate.js';
import { renderBreakdown, renderNumber, renderTextList } from './stats.js';

export const renderQuestionAnalytics = (ctx, root) => {
  const { id } = ctx.params;
  const content = el('div', {});

  const load = async (includeVersions) => {
    mount(content, spinner('加载跨问卷统计…'));
    try {
      const res = await api.questionCrossAnalytics(id, { includeVersions });
      const d = res.data;
      const stat = d.stat || {};
      const total = (stat.breakdown || []).reduce((s, r) => s + (r.count || 0), 0);

      const chart = d.type === 'radio' || d.type === 'checkbox'
        ? renderBreakdown({ breakdown: stat.breakdown })
        : d.type === 'number'
          ? renderNumber(stat)
          : renderTextList(stat, { cap: 100 });

      mount(content,
        el('section', { class: 'card section-card' },
          el('div', { class: 'section-head' },
            el('h3', {}, d.title || '未命名题目'),
            el('div', { class: 'q-title-row' },
              el('span', { class: `type-chip type-${d.type}` }, typeLabel(d.type)),
              el('span', { class: 'version-chip' }, `v${d.version}`),
              el('span', { class: 'meta-dim' }, `作答 ${stat.totalAnswers ?? 0} 人次 · 覆盖 ${(stat.totalRespondents ?? 0)} 份答卷`)
            )
          ),
          chart,
          el('p', { class: 'chart-total' },
            includeVersions
              ? `已合并版本链上全部 ${d.surveyCount} 份使用该题（含其他版本）的问卷的答卷`
              : `仅统计 v${d.version} 在 ${d.surveyCount} 份问卷中的答卷`
          )
        ),
        el('section', { class: 'card section-card' },
          el('div', { class: 'section-head' }, el('h3', {}, '哪些问卷在用这道题')),
          (d.surveys || []).length
            ? el('div', { class: 'usage-list' },
              d.surveys.map((u) => el('div', { class: 'card usage-card' },
                el('div', { class: 'q-head' },
                  el('div', { class: 'q-title-block' },
                    el('div', { class: 'q-title-row' },
                      el('a', { class: 'q-title', href: `#/surveys/${u.surveyId}/results` }, u.surveyTitle || '未命名问卷'),
                      badge(u.surveyStatus),
                      el('span', { class: 'meta-dim' }, `问卷版本 v${u.surveyVersion}`)
                    )
                  )
                )
              ))
            )
            : el('p', { class: 'field-hint' }, '暂时没有问卷使用这道题'),
          el('div', { class: 'form-actions' },
            el('button', {
              class: 'btn btn-ghost btn-sm',
              disabled: !includeVersions,
              onclick: () => load(false)
            }, '仅看该版本'),
            el('button', {
              class: 'btn btn-ghost btn-sm',
              disabled: includeVersions,
              onclick: () => load(true)
            }, '合并全部版本')
          )
        )
      );
    } catch (e) {
      mount(content, emptyState(e.message || '加载失败', el('button', {
        class: 'btn btn-ghost', onclick: () => ctx.router.go('/questions')
      }, '返回题目库')));
      toast(e.message || '加载失败', 'error');
    }
  };

  mount(root,
    el('div', { class: 'page' },
      el('div', { class: 'page-head' },
        el('div', {},
          el('a', { class: 'back-link', href: '#/questions' }, '← 题目库'),
          el('h2', {}, '单题跨问卷统计'),
          el('p', { class: 'page-sub' }, '汇总这道题在所有问卷中的回答情况，洞察总体分布')
        ),
        el('button', { class: 'btn btn-ghost', onclick: () => load(true) }, '刷新')
      ),
      content
    )
  );
  load(true);
};
