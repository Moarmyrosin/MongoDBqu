import { api, ApiError } from '../api.js';
import {
  el, mount, clear, toast, badge, fmtDateTime, confirmDialog, openModal,
  inputGroup, textInput, textArea, select, emptyState, spinner
} from '../ui.js';
import { typeLabel } from '../validate.js';
import { openLibraryQuestionEditor } from './questionEditor.js';

/* ---------- 通用弹窗 ---------- */

/** 在问卷编辑器里「从题目库选题」：列出我的 + 共享给我的题目，点击插入 */
export const openLibraryQuestionPickModal = ({ onInsert }) => {
  let all = { mine: [], shared: [] };
  let kw = '';
  let inserted = new Set();

  const match = (q) => {
    if (!kw) return true;
    return String(q.content?.title || '').toLowerCase().includes(kw.toLowerCase());
  };
  const rows = () => [
    ...all.mine.filter(match).map((q) => ({ q, owner: '我的题目', insertedAlready: inserted.has(String(q._id)) })),
    ...all.shared.filter(match).map((q) => ({ q, owner: q.createdBy?.username ? `共享 · ${q.createdBy.username}` : '共享题目', insertedAlready: inserted.has(String(q._id)) }))
  ];

  const listHost = el('div', { class: 'picker-list' });

  const renderList = async () => {
    const data = rows();
    if (!all.mine.length && !all.shared.length) {
      mount(listHost, el('div', { class: 'empty' },
        el('p', {}, '题目库还是空的'),
        el('a', { class: 'btn btn-primary btn-sm', href: '#/questions' }, '去题目库创建题目')
      ));
      return;
    }
    mount(listHost,
      data.length
        ? data.map(({ q, owner, insertedAlready }) => el('div', { class: 'card picker-item' },
          el('div', { class: 'q-head' },
            el('div', { class: 'q-title-block' },
              el('div', { class: 'q-title-row' },
                el('span', { class: 'q-title' }, q.content?.title || '未命名'),
                el('span', { class: `type-chip type-${q.content?.type}` }, typeLabel(q.content?.type)),
                el('span', { class: 'version-chip' }, `v${q.version}`),
                el('span', { class: 'rule-chip' }, owner)
              ),
              q.content?.description ? el('p', { class: 'q-desc' }, q.content.description) : null
            ),
            el('div', { class: 'q-actions' },
              insertedAlready
                ? el('span', { class: `badge badge-closed` }, '已插入')
                : el('button', {
                  class: 'btn btn-primary btn-sm',
                  onclick: async () => {
                    try {
                      await onInsert(q._id);
                      inserted.add(String(q._id));
                      renderList();
                    } catch (e) {
                      toast(e instanceof ApiError ? e.message : '插入失败', 'error');
                    }
                  }
                }, '插入本问卷')
            )
          )
        ))
        : el('p', { class: 'field-hint' }, '没有匹配的题目，换个关键词试试')
    );
  };

  openModal({
    title: '从题目库选题',
    wide: true,
    body: async (host) => {
      const searchInput = el('input', {
        class: 'input', type: 'search', placeholder: '搜索题目标题…',
        oninput: (e) => { kw = e.target.value.trim(); renderList(); }
      });
      mount(host, spinner('加载题目库…'));
      try {
        const [mineRes, sharedRes] = await Promise.all([
          api.listMyLibraryQuestions({ limit: 200 }),
          api.listSharedQuestions({ limit: 200 }).catch(() => ({ data: { items: [] } }))
        ]);
        all = { mine: mineRes.data?.items || [], shared: sharedRes.data?.items || [] };
        mount(host,
          el('div', { class: 'form-grid' }, inputGroup('搜索', searchInput)),
          el('p', { class: 'field-hint' }, `共 ${all.mine.length} 道我的题目、${all.shared.length} 道共享题目。插入的是题目当前版本的「快照」，之后题库若生成新版本，本问卷保持不变。`),
          listHost
        );
        renderList();
      } catch (e) {
        mount(host, emptyState(e.message || '加载失败'));
      }
    },
    actions: [
      (close) => el('button', { class: 'btn btn-primary', onclick: close }, '完成')
    ]
  });
};

/** 选择一份草稿问卷，把题库题目选入 */
export const openPickSurveyModal = ({ questionIds, onDone }) => {
  let sel = null;
  let surveys = [];
  openModal({
    title: '选用题目到问卷',
    body: async (host) => {
      mount(host, spinner('加载我的草稿问卷…'));
      try {
        const res = await api.listMySurveys({ status: 'draft', limit: 100 });
        surveys = (res.data?.items || []).filter((s) => s.status === 'draft');
        if (!surveys.length) {
          mount(host, el('div', { class: 'empty' },
            el('p', {}, '暂无草稿问卷，请先新建一份问卷再选用题目'),
            el('a', { class: 'btn btn-primary', href: '#/surveys' }, '去新建问卷')
          ));
          return;
        }
        sel = select(
          surveys.map((s) => ({ value: s._id, label: `${s.title}（${(s.questions || []).length} 题）` })),
          { class: 'input' }
        );
        return mount(host, inputGroup('选择草稿问卷', sel, {
          required: true, hint: '题目会以「快照」方式插入，题库后续修改不会影响该问卷已插入的内容'
        }));
      } catch (err) {
        mount(host, emptyState(err.message || '加载失败'));
      }
    },
    actions: [
      (close) => el('button', { class: 'btn btn-ghost', onclick: close }, '取消'),
      (close) => el('button', {
        class: 'btn btn-primary',
        onclick: async () => {
          if (!sel || !sel.value) return toast('请选择一个草稿问卷', 'warn');
          const surveyId = sel.value;
          for (const qid of questionIds) {
            try {
              await api.addQuestion(surveyId, { fromQuestionId: qid });
            } catch (e) {
              toast(e instanceof ApiError ? e.message : '选用失败', 'error');
              return;
            }
          }
          toast(`已把 ${questionIds.length} 道题选入问卷`, 'success');
          close();
          onDone?.(surveyId);
        }
      }, '选用并进入编辑')
    ]
  });
};

const openPickBankModal = ({ banks, currentBankId, onPick }) => {
  let sel = null;
  openModal({
    title: '加入题库',
    body: (host) => {
      if (!banks.length) {
        mount(host, emptyState('还没有题库，先在「题目库 → 题库」页创建一个',
          el('a', { class: 'btn btn-primary', href: '#/questions?tab=banks' }, '去创建')));
        return;
      }
      sel = select(banks.filter((b) => b._id !== currentBankId).map((b) => ({ value: b._id, label: `${b.name}（${b.questionCount ?? 0} 题）` })), { class: 'input' });
      mount(host, inputGroup('选择题库', sel, { required: true }));
    },
    actions: [
      (close) => el('button', { class: 'btn btn-ghost', onclick: close }, '取消'),
      (close) => el('button', {
        class: 'btn btn-primary',
        onclick: async () => {
          if (!sel || !sel.value) return toast('请选择题库', 'warn');
          close();
          onPick?.(sel.value);
        }
      }, '加入')
    ]
  });
};

const openVersionsModal = (question, { onChanged }) => {
  openModal({
    title: `版本历史 · ${question.content?.title || ''}`,
    wide: true,
    body: async (modalHost) => {
      const render = async () => {
        mount(modalHost, spinner('加载版本历史…'));
        try {
          const res = await api.questionVersions(question._id);
          const { versions, latestVersion } = res.data;
          if (!versions.length) {
            mount(modalHost, emptyState('暂无版本数据'));
            return;
          }
          mount(modalHost,
            el('p', { class: 'field-hint' }, `v1 → v${latestVersion}，共 ${versions.length} 个版本。新版本由旧版本修改而来，互不影响。`),
            el('div', { class: 'version-list' },
              versions.map((v) => el('div', { class: 'card version-card' },
                el('div', { class: 'q-head' },
                  el('span', { class: `version-chip ${v.version === latestVersion ? 'version-latest' : ''}` }, `v${v.version}`),
                  el('div', { class: 'q-title-block' },
                    el('div', { class: 'q-title-row' },
                      el('span', { class: 'q-title' }, v.title || '未命名'),
                      el('span', { class: `type-chip type-${v.type}` }, typeLabel(v.type)),
                      v.version === latestVersion ? el('span', { class: 'req-chip' }, '当前最新') : null
                    ),
                    el('p', { class: 'q-desc' },
                      v.previousVersion ? `从 v${v.previousVersion} 修改而来 · ` : '',
                      v.creatorName ? `由 ${v.creatorName} 创建 · ` : '',
                      fmtDateTime(v.createdAt)
                    )
                  ),
                  el('div', { class: 'q-actions' },
                    v.version !== latestVersion ? el('button', {
                      class: 'btn btn-ghost btn-sm', title: '以该版本内容创建新版本（旧问卷不受影响）',
                      onclick: async () => {
                        try {
                          await api.restoreQuestionVersion(question._id, v._id);
                          toast(`已从 v${v.version} 生成新版本 v${v.version + 1}`, 'success');
                          render();
                          onChanged?.();
                        } catch (e) { toast(e.message, 'error'); }
                      }
                    }, '恢复为新版本') : null,
                    el('button', {
                      class: 'btn btn-ghost btn-sm',
                      onclick: () => openPickSurveyModal({ questionIds: [v._id] })
                    }, '选用此版本')
                  )
                )
              ))
            )
          );
        } catch (err) {
          mount(modalHost, emptyState(err.message || '加载失败'));
        }
      };
      render();
    }
  });
};

const openUsageModal = (question) => {
  openModal({
    title: `使用情况 · ${question.content?.title || ''}`,
    wide: true,
    body: async (host) => {
      mount(host, spinner('加载使用情况…'));
      try {
        const res = await api.questionUsage(question._id);
        const { surveys, totalSurveys, includeVersions, version } = res.data;
        const meta = includeVersions && question.rootQuestionId
          ? `（统计范围：该版本及整个版本链，当前查看 v${version}）`
          : `（统计范围：v${version} 本身）`;
        if (!totalSurveys) {
          mount(host, el('p', { class: 'field-hint' }, '还没有问卷使用这道题', el('span', { class: 'meta-dim' }, meta)));
          return;
        }
        mount(host,
          el('p', { class: 'field-hint' }, `被 ${totalSurveys} 份问卷使用 ${meta}。修改该题不会影响已插入的问卷（它们使用的是快照）。`),
          el('div', { class: 'usage-list' },
            surveys.map((u) => el('div', { class: 'card usage-card' },
              el('div', { class: 'q-head' },
                el('div', { class: 'q-title-block' },
                  el('div', { class: 'q-title-row' },
                    el('span', { class: 'q-title' }, u.surveyTitle || '未命名问卷'),
                    badge(u.surveyStatus),
                    u.isOwnerSurvey ? el('span', { class: 'rule-chip' }, '我的问卷') : el('span', { class: 'rule-chip' }, `${u.owner} 的问卷`)
                  )
                ),
                el('div', { class: 'q-actions' },
                  el('button', {
                    class: 'btn btn-ghost btn-sm',
                    onclick: () => {
                      document.querySelectorAll('.modal-backdrop').forEach((m) => m.remove());
                      location.hash = `#/surveys/${u.surveyId}/edit`;
                    }
                  }, '查看问卷')
                )
              )
            ))
          )
        );
      } catch (err) {
        mount(host, emptyState(err.message || '加载失败'));
      }
    }
  });
};

const openShareModal = (question, { onChanged }) => {
  let nameInput = null;
  let users = [];
  const listHost = el('div', { class: 'share-list' });

  const loadUsers = async () => {
    try {
      const res = await api.listSharedUsers(question._id);
      users = res.data || [];
      renderList();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const renderList = () => {
    mount(listHost,
      users.length
        ? users.map((u) => el('div', { class: 'share-user' },
          el('span', { class: 'share-user-name' }, u.username),
          el('button', {
            class: 'link-btn link-danger',
            onclick: async () => {
              try {
                await api.shareQuestion(question._id, { removeUserIds: [u._id] });
                toast('已取消共享', 'success');
                loadUsers();
                onChanged?.();
              } catch (e) { toast(e.message, 'error'); }
            }
          }, '移除')
        ))
        : el('p', { class: 'field-hint' }, '还没共享给任何人。被共享的用户可在自己的问卷里直接使用这道题。')
    );
  };

  openModal({
    title: `共享题目 · ${question.content?.title || ''}`,
    body: (host) => {
      nameInput = textInput({ placeholder: '输入对方用户名，如：teacher01' });
      mount(host,
        inputGroup('共享给其他用户', nameInput, { hint: '对方可以在「题目库 → 共享给我」里看到本题并直接选题使用' }),
        el('div', { class: 'form-actions' },
          el('button', {
            class: 'btn btn-primary btn-sm',
            onclick: async () => {
              const v = nameInput.value.trim();
              if (!v) return toast('请输入用户名', 'warn');
              try {
                await api.shareQuestion(question._id, { addUsernames: [v] });
                toast(`已共享给 ${v}`, 'success');
                nameInput.value = '';
                loadUsers();
                onChanged?.();
              } catch (e) { toast(e.message, 'error'); }
            }
          }, '＋ 添加共享')
        ),
        el('h4', { class: 'share-title' }, '当前共享名单'),
        listHost
      );
      loadUsers();
    },
    actions: [
      (close) => el('button', { class: 'btn btn-primary', onclick: close }, '完成')
    ]
  });
};

/* ---------- 题目卡片 ---------- */

const questionCard = (q, { mine, banks, refresh, ownerLabel }) => {
  const sharedCount = (q.sharedWith || []).length;
  return el('div', { class: 'card question-card' },
    el('div', { class: 'q-head' },
      el('div', { class: 'q-title-block' },
        el('div', { class: 'q-title-row' },
          el('span', { class: 'q-title' }, q.content?.title || '未命名题目'),
          el('span', { class: `type-chip type-${q.content?.type}` }, typeLabel(q.content?.type)),
          el('span', { class: 'version-chip' }, `v${q.version}`),
          !mine ? el('span', { class: 'rule-chip' }, `${ownerLabel || '共享题目'}`) : null,
          q.content?.required ? el('span', { class: 'req-chip' }, '必答') : null,
          mine && sharedCount ? el('span', { class: 'rule-chip' }, `已共享 ${sharedCount} 人`) : null
        ),
        q.content?.description ? el('p', { class: 'q-desc' }, q.content.description) : null,
        el('p', { class: 'q-desc meta-dim' }, `更新于 ${fmtDateTime(q.updatedAt)}`)
      )
    ),
    hasOptionsData(q) ? el('div', { class: 'q-options' },
      (q.content.options || []).map((o) => el('span', { class: 'opt-pill' }, o.label, el('code', {}, o.value)))
    ) : null,
    el('div', { class: 'lib-actions' },
      el('button', {
        class: 'btn btn-primary btn-sm',
        onclick: () => openPickSurveyModal({ questionIds: [q._id] })
      }, '选用到问卷'),
      el('button', { class: 'btn btn-ghost btn-sm', onclick: () => openVersionsModal(q, { onChanged: refresh }) }, '版本历史'),
      el('button', { class: 'btn btn-ghost btn-sm', onclick: () => openUsageModal(q) }, '使用情况 · 改题前先看'),
      mine ? el('button', { class: 'btn btn-ghost btn-sm', onclick: () => openShareModal(q, { onChanged: refresh }) }, '共享') : null,
      mine ? el('button', { class: 'btn btn-ghost btn-sm', onclick: () => openEdit(q, refresh) }, '编辑') : null,
      !mine ? el('button', { class: 'btn btn-ghost btn-sm', onclick: () => openEdit(q, refresh, q.createdBy?.username) }, '复制为新版本') : null,
      el('a', {
        class: 'btn btn-ghost btn-sm',
        href: `#/questions/${q._id}/analytics`
      }, '跨问卷统计'),
      banks && banks.length ? el('button', {
        class: 'btn btn-ghost btn-sm',
        onclick: () => openPickBankModal({ banks, currentBankId: q.bankId, onPick: async (bankId) => {
          try {
            await api.addBankQuestion(bankId, q._id);
            toast('已加入题库', 'success');
            refresh();
          } catch (e) { toast(e.message, 'error'); }
        } })
      }, '加入题库') : null,
      mine ? el('button', {
        class: 'icon-btn icon-danger', title: '删除',
        onclick: async () => {
          if (await confirmDialog(`确定删除题目「${q.content?.title}」？已插入问卷的快照不受影响`, { danger: true, confirmText: '删除' })) {
            try {
              await api.deleteLibraryQuestion(q._id);
              toast('已删除', 'success');
              refresh();
            } catch (e) { toast(e.message, 'error'); }
          }
        }
      }, '×') : null
    )
  );
};

const hasOptionsData = (q) => ['radio', 'checkbox'].includes(q.content?.type) && (q.content?.options || []).length;

const openEdit = (q, refresh, ownerName) => {
  openLibraryQuestionEditor({
    question: q,
    onSave: async (draft) => {
      try {
        const res = await api.updateLibraryQuestion(q._id, { ...draft, createNewVersion: true });
        const nv = `v${res?.data?.version ?? ''}`;
        toast(ownerName
          ? `已基于 ${ownerName} 的题目创建你自己的版本 ${nv}`
          : `修改已保存为新版本 ${nv}，旧问卷不受影响`, 'success');
        refresh();
      } catch (e) {
        toast(e instanceof ApiError ? e.message : '保存失败', 'error');
      }
    }
  });
};

/* ---------- 页面 ---------- */

export const renderLibrary = (ctx, root) => {
  const state = { tab: ctx.query.tab || 'mine', search: '', banks: [] };
  const tabsHost = el('div', { class: 'tabs' });
  const bankBarHost = el('div', { class: 'bank-bar' });
  const listHost = el('div', { class: 'lib-list' });

  const TABS = [
    { key: 'mine', label: '我的题目' },
    { key: 'shared', label: '共享给我' },
    { key: 'banks', label: '题库' }
  ];

  const loadBanks = async () => {
    try {
      const res = await api.listBanks();
      state.banks = res.data || [];
    } catch {
      state.banks = [];
    }
  };

  const renderBankTab = () => {
    clear(bankBarHost);
    const nameInput = textInput({ placeholder: '题库名称，如：校园调查常用题', maxlength: 100 });
    bankBarHost.appendChild(
      el('div', { class: 'page-head bank-create-row' },
        el('div', { class: 'form-inline' },
          inputGroup('', nameInput, { hint: '' }),
          el('button', {
            class: 'btn btn-primary',
            onclick: async () => {
              const name = nameInput.value.trim();
              if (!name) return toast('请输入题库名称', 'warn');
              try {
                await api.createBank({ name });
                toast('题库已创建', 'success');
                loadBanks().then(refresh);
              } catch (e) { toast(e.message, 'error'); }
            }
          }, '＋ 创建题库')
        )
      )
    );

    clear(listHost);
    if (!state.banks.length) {
      listHost.appendChild(emptyState('还没有题库，先在上方创建一个，把常用题目按场景归类'));
      return;
    }
    state.banks.forEach((bank) => {
      const detailHost = el('div', { class: 'bank-detail' });
      const card = el('div', { class: 'card survey-card bank-card' },
        el('div', { class: 'survey-card-head' },
          el('div', { class: 'survey-title-block' },
            el('h3', { class: 'survey-title' }, bank.name),
            el('div', { class: 'survey-meta' },
              el('span', {}, `${bank.questionCount ?? 0} 道题`),
              el('span', {}, `创建于 ${fmtDateTime(bank.createdAt)}`)
            ),
            bank.description ? el('p', { class: 'survey-desc' }, bank.description) : null
          ),
          el('div', { class: 'survey-actions' },
            el('button', {
              class: 'btn btn-ghost btn-sm', onclick: async () => {
                await renderBankDetail(bank, detailHost);
              }
            }, '查看题目'),
            el('button', {
              class: 'btn btn-ghost btn-sm', onclick: () => {
                openModal({
                  title: '重命名题库',
                  body: (host) => {
                    const inp = textInput({ value: bank.name, maxlength: 100 });
                    mount(host, inputGroup('题库名称', inp, { required: true }));
                  },
                  actions: [
                    (close) => el('button', { class: 'btn btn-ghost', onclick: close }, '取消'),
                    (close) => el('button', {
                      class: 'btn btn-primary',
                      onclick: async () => {
                        const inp = document.querySelector('.modal-backdrop .modal input');
                        const name = inp?.value?.trim();
                        if (!name) return toast('请输入名称', 'warn');
                        try {
                          await api.updateBank(bank._id, { name });
                          close();
                          toast('已保存', 'success');
                          loadBanks().then(refresh);
                        } catch (e) { toast(e.message, 'error'); }
                      }
                    }, '保存')
                  ]
                });
              }
            }, '重命名'),
            el('button', {
              class: 'btn btn-ghost btn-sm btn-danger-ghost',
              onclick: async () => {
                if (await confirmDialog(`确定删除题库「${bank.name}」？里面的题目不会被删除，只是移出题库`, { danger: true, confirmText: '删除' })) {
                  try {
                    await api.deleteBank(bank._id);
                    toast('题库已删除', 'success');
                    loadBanks().then(refresh);
                  } catch (e) { toast(e.message, 'error'); }
                }
              }
            }, '删除')
          )
        ),
        detailHost
      );
      listHost.appendChild(card);
    });
  };

  const renderBankDetail = async (bank, host) => {
    mount(host, spinner('加载题库题目…'));
    try {
      const res = await api.getBankQuestions(bank._id);
      const { items } = res.data;
      mount(host,
        items.length
          ? el('div', { class: 'question-list' },
            items.map((q) => el('div', { class: 'card bank-question-item' },
              el('div', { class: 'q-head' },
                el('span', { class: 'version-chip' }, `v${q.version}`),
                el('div', { class: 'q-title-block' },
                  el('div', { class: 'q-title-row' },
                    el('span', { class: 'q-title' }, q.content?.title || '未命名'),
                    el('span', { class: `type-chip type-${q.content?.type}` }, typeLabel(q.content?.type))
                  )
                ),
                el('div', { class: 'q-actions' },
                  el('button', {
                    class: 'btn btn-ghost btn-sm',
                    onclick: () => openPickSurveyModal({ questionIds: [q._id] })
                  }, '使用'),
                  el('button', {
                    class: 'btn btn-ghost btn-sm',
                    onclick: () => openVersionsModal(q, { onChanged: () => refresh() })
                  }, '版本'),
                  el('a', { class: 'btn btn-ghost btn-sm', href: `#/questions/${q._id}/analytics` }, '统计'),
                  q.bankId ? el('button', {
                    class: 'btn btn-ghost btn-sm link-danger',
                    onclick: async () => {
                      try {
                        await api.removeBankQuestion(bank._id, q._id);
                        toast('已移出题库', 'success');
                        loadBanks().then(refresh);
                      } catch (e) { toast(e.message, 'error'); }
                    }
                  }, '移出') : null
                )
              )
            ))
          )
          : el('p', { class: 'field-hint' }, '该题库还没有题目。在「我的题目」里点击「加入题库」即可归类。')
      );
    } catch (e) {
      mount(host, emptyState(e.message));
    }
  };

  const loadList = async () => {
    mount(listHost, spinner('加载题目…'));
    try {
      const query = { search: state.search || undefined, limit: 200 };
      let res;
      if (state.tab === 'mine') res = await api.listMyLibraryQuestions(query);
      else if (state.tab === 'shared') res = await api.listSharedQuestions(query);
      else {
        await api.listBanks();
        res = { data: { items: [] } };
      }
      const items = res.data?.items || [];
      clear(listHost);
      if (!items.length) {
        listHost.appendChild(emptyState(
          state.tab === 'mine'
            ? '还没有常用题目。点右上角「＋ 新建题目」保存，或在做问卷时点「保存到题库」沉淀题目'
            : '还没有人共享题目给你。团队协作者可在他们的题目里点「共享」'
        ));
      } else if (state.tab === 'mine') {
        items.forEach((q) => listHost.appendChild(questionCard(q, { mine: true, banks: [], refresh })));
      } else {
        items.forEach((q) => listHost.appendChild(questionCard(q, { mine: false, banks: [], refresh, ownerLabel: q.createdBy?.username ? `${q.createdBy.username} 的题目` : '共享题目' })));
      }
    } catch (err) {
      mount(listHost, emptyState(err.message || '加载失败', el('button', {
        class: 'btn btn-ghost', onclick: refresh
      }, '重试')));
    }
  };

  const refresh = () => {
    renderTabsAndHead();
    if (state.tab === 'banks') {
      loadBanks().then(() => { renderBankTab(); });
    } else {
      clear(bankBarHost);
      loadList();
    }
  };

  const renderTabsAndHead = () => {
    clear(tabsHost);
    TABS.forEach((t) => {
      tabsHost.appendChild(el('button', {
        class: `tab ${state.tab === t.key ? 'tab-active' : ''}`,
        onclick: () => { state.tab = t.key; refresh(); }
      }, t.label));
    });
  };

  const openCreate = () => {
    openLibraryQuestionEditor({
      question: null,
      onSave: async (draft) => {
        try {
          if (state.tab === 'banks') {
            toast('在题库页请先创建题目再入库，或到「我的题目」里创建后点「加入题库」', 'warn');
          }
          await api.createLibraryQuestion(draft);
          toast('题目已保存，可在任意问卷中重复选用', 'success');
          if (state.tab === 'shared') state.tab = 'mine';
          refresh();
        } catch (e) {
          toast(e instanceof ApiError ? e.message : '保存失败', 'error');
        }
      }
    });
  };

  mount(root,
    el('div', { class: 'page' },
      el('div', { class: 'page-head' },
        el('div', {},
          el('h2', {}, '题目库'),
          el('p', { class: 'page-sub' }, '把常用题目沉淀下来：可复用、可共享给团队、可分版本维护，一份题在多份问卷中被统计')
        ),
        el('div', { class: 'page-head-actions' },
          el('input', {
            class: 'input', type: 'search', placeholder: '搜索题目标题…', value: state.search,
            oninput: (e) => { state.search = e.target.value.trim(); },
            onkeydown: (e) => e.key === 'Enter' && refresh()
          }),
          state.tab !== 'banks' ? el('button', { class: 'btn btn-primary', onclick: openCreate }, '＋ 新建题目') : null
        )
      ),
      tabsHost, bankBarHost, listHost
    )
  );
  refresh();
};
