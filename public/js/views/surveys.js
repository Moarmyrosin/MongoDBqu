import { api, ApiError } from '../api.js';
import { el, mount, clear, toast, badge, fmtDateTime, openModal, confirmDialog, inputGroup, textInput, textArea, emptyState, spinner } from '../ui.js';

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'closed', label: '已关闭' }
];

const fillUrl = (id) => `${location.origin}${location.pathname}#/f/${id}`;

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast('链接已复制', 'success');
  } catch {
    openModal({
      title: '填写链接',
      body: el('div', {}, el('input', { class: 'input', value: text, readonly: true, onfocus: (e) => e.target.select() })),
      actions: [(close) => el('button', { class: 'btn btn-primary', onclick: close }, '关闭')]
    });
  }
};

export const renderSurveys = (ctx, root) => {
  const state = { page: 1, limit: 10, status: '', total: 0, pages: 1, items: [], loading: false };

  const tabs = el('div', { class: 'tabs' });
  const listHost = el('div', { class: 'survey-list' });
  const pagerHost = el('div', { class: 'pager' });

  const load = async () => {
    state.loading = true;
    mount(listHost, spinner('加载问卷…'));
    try {
      const res = await api.listMySurveys({ page: state.page, limit: state.limit, status: state.status || undefined });
      state.items = res.data.items || [];
      state.total = res.data.total || 0;
      state.pages = res.data.pages || 1;
      renderList();
    } catch (err) {
      mount(listHost, emptyState(err.message || '加载失败'));
    } finally {
      state.loading = false;
    }
  };

  const act = async (fn, successMsg) => {
    try {
      const r = await fn();
      if (successMsg) toast(successMsg, 'success');
      return r;
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '操作失败', 'error');
      throw err;
    }
  };

  const openCreate = () => {
    let titleEl, descEl;
    openModal({
      title: '新建问卷',
      body: (host) => {
        titleEl = textInput({ placeholder: '例如：校园生活满意度调查', maxlength: 200 });
        descEl = textArea({ placeholder: '选填，向填写者说明本次调查目的', rows: 3, maxlength: 2000 });
        mount(host, el('div', { class: 'form-grid' },
          inputGroup('问卷标题', titleEl, { required: true }),
          inputGroup('问卷说明', descEl)
        ));
      },
      actions: [(close) => el('button', { class: 'btn btn-ghost', onclick: close }, '取消'),
      (close) => el('button', {
        class: 'btn btn-primary', onclick: async () => {
          const title = titleEl.value.trim();
          if (!title) return toast('请填写问卷标题', 'warn');
          try {
            const res = await api.createSurvey({ title, description: descEl.value.trim() });
            toast('问卷已创建', 'success');
            close();
            ctx.router.go(`/surveys/${res.data._id}/edit`);
          } catch (err) {
            toast(err.message, 'error');
          }
        }
      }, '创建并编辑')]
    });
  };

  const renderTabs = () => {
    clear(tabs);
    STATUS_TABS.forEach((t) => {
      tabs.appendChild(el('button', {
        class: `tab ${state.status === t.value ? 'tab-active' : ''}`,
        onclick: () => { state.status = t.value; state.page = 1; load(); }
      }, t.label));
    });
  };

  const renderPager = () => {
    clear(pagerHost);
    if (state.pages <= 1 && state.total <= state.limit) return;
    pagerHost.appendChild(el('span', { class: 'pager-info' }, `共 ${state.total} 份`));
    pagerHost.appendChild(el('button', {
      class: 'btn btn-ghost btn-sm', disabled: state.page <= 1,
      onclick: () => { state.page--; load(); }
    }, '上一页'));
    pagerHost.appendChild(el('span', { class: 'pager-page' }, `${state.page} / ${state.pages}`));
    pagerHost.appendChild(el('button', {
      class: 'btn btn-ghost btn-sm', disabled: state.page >= state.pages,
      onclick: () => { state.page++; load(); }
    }, '下一页'));
  };

  const renderList = () => {
    clear(listHost);
    renderTabs();
    renderPager();
    if (!state.items.length) {
      listHost.appendChild(emptyState(
        state.status ? '该状态下还没有问卷' : '还没有问卷，点击右上角「新建问卷」开始',
        el('button', { class: 'btn btn-primary', onclick: openCreate }, '新建问卷')
      ));
      return;
    }
    for (const s of state.items) {
      const qCount = (s.questions || []).length;
      const card = el('div', { class: 'card survey-card' },
        el('div', { class: 'survey-card-head' },
          el('div', { class: 'survey-title-block' },
            el('h3', { class: 'survey-title' }, s.title),
            el('div', { class: 'survey-meta' },
              badge(s.status),
              el('span', {}, `${qCount} 题`),
              el('span', {}, `v${s.version}`),
              el('span', {}, `创建于 ${fmtDateTime(s.createdAt)}`),
              s.deadline ? el('span', { class: 'meta-warn' }, `截止 ${fmtDateTime(s.deadline)}`) : null
            )
          ),
          el('div', { class: 'survey-actions' },
            s.status === 'draft' ? el('button', {
              class: 'btn btn-primary btn-sm',
              onclick: () => act(() => api.publishSurvey(s._id), '已发布').then(load)
            }, '发布') : null,
            s.status === 'draft' ? el('button', {
              class: 'btn btn-ghost btn-sm',
              onclick: () => ctx.router.go(`/surveys/${s._id}/edit`)
            }, '编辑') : null,
            s.status !== 'draft' ? el('button', {
              class: 'btn btn-primary btn-sm',
              onclick: () => ctx.router.go(`/surveys/${s._id}/results`)
            }, '统计') : null,
            s.status === 'published' ? el('button', {
              class: 'btn btn-ghost btn-sm',
              onclick: () => copyText(fillUrl(s._id))
            }, '复制链接') : null,
            s.status === 'published' ? el('button', {
              class: 'btn btn-ghost btn-sm',
              onclick: async () => {
                if (await confirmDialog('关闭后将无法再填写该问卷，确定关闭？', { danger: true, confirmText: '关闭问卷' })) {
                  act(() => api.closeSurvey(s._id), '已关闭').then(load);
                }
              }
            }, '关闭') : null,
            s.status === 'draft' ? el('button', {
              class: 'btn btn-ghost btn-sm btn-danger-ghost',
              onclick: async () => {
                if (await confirmDialog(`确定删除草稿「${s.title}」？此操作不可恢复`, { danger: true, confirmText: '删除' })) {
                  await act(() => api.deleteSurvey(s._id), '已删除');
                  if (state.items.length === 1 && state.page > 1) state.page--;
                  load();
                }
              }
            }, '删除') : null
          )
        ),
        s.description ? el('p', { class: 'survey-desc' }, s.description) : null
      );
      listHost.appendChild(card);
    }
  };

  mount(
    root,
    el('div', { class: 'page' },
      el('div', { class: 'page-head' },
        el('div', {}, el('h2', {}, '我的问卷'), el('p', { class: 'page-sub' }, `共创建 ${state.total} 份问卷`)),
        el('button', { class: 'btn btn-primary', onclick: openCreate }, '＋ 新建问卷')
      ),
      tabs, listHost, pagerHost
    )
  );
  load();
};
