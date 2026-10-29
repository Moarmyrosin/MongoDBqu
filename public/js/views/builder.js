import { api, ApiError } from '../api.js';
import { store } from '../store.js';
import {
  el, mount, clear, toast, badge, fmtDateTime, deadlineToInput, confirmDialog,
  inputGroup, textInput, textArea, checkboxRow, spinner, emptyState, openModal
} from '../ui.js';
import { typeLabel, ruleSummary, hasOptions } from '../validate.js';
import { describeRule } from '../jump.js';
import { openQuestionEditor } from './questionEditor.js';
import { openLibraryQuestionPickModal } from './library.js';

const SETTINGS_FIELDS = [
  { key: 'loginRequiredToFill', label: '填写前必须登录', hint: '默认开启；关闭后允许匿名提交' },
  { key: 'allowMultipleResponses', label: '允许同一人多次填写', hint: '关闭后同一账号只能提交一次' },
  { key: 'allowAnonymous', label: '允许匿名填写', hint: '与「必须登录」配合使用' },
  { key: 'collectIp', label: '记录填写者 IP', hint: '开启后答卷会保存 IP 地址' },
  { key: 'showProgress', label: '填写时显示进度（逐步模式）', hint: '开启后填写页按跳转规则逐题推进' },
  { key: 'shuffleQuestions', label: '打乱题目顺序', hint: '每次进入填写页随机排序' },
  { key: 'shuffleOptions', label: '打乱选项顺序', hint: '每个单选/多选题的选项随机排序' }
];

export const renderBuilder = (ctx, root) => {
  const { id } = ctx.params;
  let survey = null;
  let saving = false;

  const body = el('div', {});
  const topHost = el('div', {});

  const reload = async () => {
    mount(body, spinner('加载问卷…'));
    try {
      const res = await api.getSurvey(id);
      survey = res.data;
      render();
    } catch (err) {
      mount(body, emptyState(err.message || '加载失败', el('button', {
        class: 'btn btn-ghost', onclick: () => ctx.router.go('/surveys')
      }, '返回列表')));
    }
  };

  const isDraft = () => survey?.status === 'draft';

  const guardDraft = () => {
    if (!isDraft()) {
      toast('问卷发布后不可修改题目，如需调整请先记录内容再重建', 'warn');
      return false;
    }
    return true;
  };

  const run = async (fn, msg, after) => {
    if (saving) return;
    saving = true;
    try {
      const res = await fn();
      if (res?.data?.questions) survey = res.data;
      if (msg) toast(msg, 'success');
      after?.();
      render();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : '操作失败', 'error');
    } finally {
      saving = false;
    }
  };

  const saveInfo = async () => {
    const title = survey.title.trim();
    if (!title) return toast('问卷标题不能为空', 'warn');
    await run(
      () => api.updateSurvey(id, {
        title,
        description: (survey.description || '').trim(),
        settings: survey.settings
      }),
      '已保存'
    );
  };

  const addQuestion = () => {
    if (!guardDraft()) return;
    openQuestionEditor({
      survey,
      question: null,
      onSave: (draft) => run(() => api.addQuestion(id, draft), '题目已添加')
    });
  };

  const pickFromLibrary = () => {
    if (!guardDraft()) return;
    openLibraryQuestionPickModal({
      onInsert: async () => {
        const res = await api.getSurvey(id);
        survey = res.data;
        render();
      }
    });
  };

  const saveToLibrary = async (q) => {
    if (await confirmDialog(`把「${q.title}」保存为常用题目？\n保存后可在「题目库」中重复选用、共享和分版本维护。`, { confirmText: '保存到题目库' })) {
      try {
        await api.createLibraryQuestion({
          content: {
            title: q.title,
            description: q.description || '',
            type: q.type,
            required: Boolean(q.required),
            options: q.options || [],
            validationRule: q.validationRule || {}
          }
        });
        toast('已保存到题目库，跳转规则请入库后在问卷内重新配置', 'success');
      } catch (err) {
        toast(err instanceof ApiError ? err.message : '保存失败', 'error');
      }
    }
  };

  const editQuestion = (q) => {
    if (!guardDraft()) return;
    openQuestionEditor({
      survey,
      question: q,
      onSave: async (draft) => {
        let payload = draft;
        let msg = '题目已更新';
        if (q.sourceQuestionId) {
          const createNewVersion = await confirmDialog(
            `这道题来自题目库（v${q.sourceVersion ?? '?'}）。\n\n选择「生成新版本」：会把本次修改保存为题库新版本并关联本问卷；其他问卷仍用旧版本。\n\n（选择「取消」则只修改本问卷内的快照，不影响题库与其他问卷）`,
            { confirmText: '生成新版本' }
          );
          payload = { ...draft, createNewVersion };
          msg = createNewVersion ? '已生成题库新版本并关联' : '题目已更新（仅本问卷）';
        }
        await run(() => api.updateQuestion(id, q._id, payload), msg);
      }
    });
  };

  const moveQuestion = async (index, delta) => {
    if (!guardDraft()) return;
    const order = [...survey.questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    await run(() => api.reorderQuestions(id, order.map((q) => q._id)), '顺序已调整');
  };

  const removeQuestion = async (q) => {
    if (!guardDraft()) return;
    if (await confirmDialog(`确定删除题目「${q.title}」？`, { danger: true, confirmText: '删除' })) {
      await run(() => api.deleteQuestion(id, q._id), '题目已删除');
    }
  };

  const jumpLabel = (q) => {
    const rules = q.jumpRules || [];
    if (!rules.length) return null;
    const titles = new Map((survey.questions || []).map((x) => [String(x._id), x.title || '未命名']));
    return el('div', { class: 'q-jumps' },
      rules.map((r) => el('span', { class: 'jump-chip' },
        describeRule(r, q, titles.get(String(r.gotoQuestionId)) || '（目标题目不存在）')
      ))
    );
  };

  const render = () => {
    clear(topHost);
    topHost.appendChild(
      el('div', { class: 'builder-top' },
        el('div', { class: 'builder-top-left' },
          el('a', { class: 'back-link', href: '#/surveys' }, '← 我的问卷'),
          el('div', { class: 'builder-title-row' },
            el('h2', {}, survey.title || '未命名问卷'),
            badge(survey.status),
            el('span', { class: 'meta-dim' }, `v${survey.version}`)
          ),
          el('p', { class: 'meta-dim' },
            `${(survey.questions || []).length} 题 · 创建于 ${fmtDateTime(survey.createdAt)}`,
            survey.publishedAt ? ` · 发布于 ${fmtDateTime(survey.publishedAt)}` : null,
            survey.deadline ? ` · 截止 ${fmtDateTime(survey.deadline)}` : null
          )
        ),
        el('div', { class: 'builder-top-right' },
          isDraft() ? el('button', { class: 'btn btn-primary', onclick: saveInfo }, '保存修改') : null,
          isDraft() ? el('button', {
            class: 'btn btn-primary',
            onclick: async () => {
              if (!(survey.questions || []).length) return toast('请先添加至少一道题目', 'warn');
              if (await confirmDialog('发布后题目将不可修改，确定发布？', { confirmText: '发布' })) {
                await run(() => api.publishSurvey(id), '问卷已发布');
              }
            }
          }, '发布问卷') : null,
          survey.status === 'published' ? el('button', {
            class: 'btn btn-ghost',
            onclick: async () => {
              if (await confirmDialog('关闭后将无法再填写该问卷，确定关闭？', { danger: true, confirmText: '关闭问卷' })) {
                await run(() => api.closeSurvey(id), '问卷已关闭');
              }
            }
          }, '关闭问卷') : null,
          survey.status !== 'draft' ? el('button', {
            class: 'btn btn-ghost',
            onclick: () => ctx.router.go(`/surveys/${id}/results`)
          }, '查看统计') : null,
          survey.status === 'published' ? el('button', {
            class: 'btn btn-ghost',
            onclick: () => ctx.router.go(`/f/${id}`)
          }, '预览填写') : null
        )
      )
    );

    const questions = [...(survey.questions || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    mount(body,
      el('div', { class: 'builder-grid' },
        el('div', { class: 'builder-main' },
          el('section', { class: 'card section-card' },
            el('div', { class: 'section-head' },
              el('h3', {}, '题目列表'),
              el('div', { class: 'section-head-actions' },
                isDraft() ? el('button', { class: 'btn btn-ghost btn-sm', onclick: pickFromLibrary }, '从题目库选题') : null,
                isDraft() ? el('button', { class: 'btn btn-primary btn-sm', onclick: addQuestion }, '＋ 添加题目') : null
              )
            ),
            questions.length
              ? el('div', { class: 'question-list' },
                questions.map((q, i) => el('div', { class: 'card question-card' },
                  el('div', { class: 'q-head' },
                    el('span', { class: 'q-index' }, i + 1),
                    el('div', { class: 'q-title-block' },
                      el('div', { class: 'q-title-row' },
                        el('span', { class: 'q-title' }, q.title || '未命名题目'),
                        el('span', { class: `type-chip type-${q.type}` }, typeLabel(q.type)),
                        q.sourceQuestionId ? el('span', { class: 'version-chip' }, `题库 v${q.sourceVersion ?? '?'}`) : null,
                        q.required ? el('span', { class: 'req-chip' }, '必答') : null,
                        ruleSummary(q) ? el('span', { class: 'rule-chip' }, ruleSummary(q)) : null
                      ),
                      q.description ? el('p', { class: 'q-desc' }, q.description) : null
                    ),
                    el('div', { class: 'q-actions' },
                      isDraft() ? el('button', { class: 'btn btn-ghost btn-sm', onclick: () => editQuestion(q) }, '编辑') : null,
                      isDraft() ? el('button', { class: 'btn btn-ghost btn-sm', title: '把这道题沉淀为常用题目', onclick: () => saveToLibrary(q) }, '存到题目库') : null,
                      isDraft() ? el('button', {
                        class: 'icon-btn', title: '上移', disabled: i === 0, onclick: () => moveQuestion(i, -1)
                      }, '↑') : null,
                      isDraft() ? el('button', {
                        class: 'icon-btn', title: '下移', disabled: i === questions.length - 1, onclick: () => moveQuestion(i, 1)
                      }, '↓') : null,
                      isDraft() ? el('button', {
                        class: 'icon-btn icon-danger', title: '删除', onclick: () => removeQuestion(q)
                      }, '×') : null
                    )
                  ),
                  hasOptions(q.type) && q.options?.length
                    ? el('div', { class: 'q-options' },
                      q.options.map((o, oi) => el('span', { class: 'opt-pill' }, `${oi + 1}. ${o.label}`, el('code', {}, o.value)))
                    )
                    : null,
                  jumpLabel(q)
                )))
              : emptyState('还没有题目，点击右上角「添加题目」开始设计', isDraft() ? el('button', {
                class: 'btn btn-primary', onclick: addQuestion
              }, '添加第一题') : null)
          )
        ),

        el('div', { class: 'builder-side' },
          el('section', { class: 'card section-card' },
            el('div', { class: 'section-head' }, el('h3', {}, '基本信息')),
            el('div', { class: 'form-grid' },
              inputGroup('问卷标题', textInput({
                value: survey.title || '', maxlength: 200,
                disabled: !isDraft(),
                oninput: (e) => (survey.title = e.target.value)
              }), { required: true }),
              inputGroup('问卷说明', textArea({
                value: survey.description || '', rows: 4, maxlength: 2000, disabled: !isDraft(),
                oninput: (e) => (survey.description = e.target.value)
              }))
            )
          ),

          el('section', { class: 'card section-card' },
            el('div', { class: 'section-head' }, el('h3', {}, '填写设置')),
            el('div', { class: 'settings-list' },
              SETTINGS_FIELDS.map((f) => checkboxRow(
                f.label,
                Boolean(survey.settings?.[f.key]),
                (on) => {
                  if (!isDraft() && ['allowMultipleResponses', 'collectIp'].includes(f.key)) {
                    toast('该设置仅在草稿阶段可修改', 'warn');
                    render();
                    return;
                  }
                  survey.settings = { ...(survey.settings || {}), [f.key]: on };
                  if (!isDraft()) return;
                  run(() => api.updateSurvey(id, { settings: { [f.key]: on } }), null);
                },
                f.hint
              ))
            )
          ),

          el('section', { class: 'card section-card' },
            el('div', { class: 'section-head' }, el('h3', {}, '截止时间')),
            el('div', { class: 'form-grid' },
              inputGroup('截止时间', el('input', {
                class: 'input', type: 'datetime-local', value: deadlineToInput(survey.deadline),
                disabled: survey.status === 'closed',
                onchange: async (e) => {
                  const val = e.target.value;
                  await run(
                    () => api.setDeadline(id, val ? new Date(val).toISOString() : null),
                    val ? '截止时间已设置' : '截止时间已清除'
                  );
                }
              }), { hint: '到达时间后填写页会拒绝提交' })
            )
          ),

          el('section', { class: 'card section-card' },
            el('div', { class: 'section-head' }, el('h3', {}, '填写链接')),
            survey.status === 'published'
              ? el('div', { class: 'share-box' },
                el('input', { class: 'input', readonly: true, value: `${location.origin}${location.pathname}#/f/${id}`, onclick: (e) => e.target.select() }),
                el('button', {
                  class: 'btn btn-ghost btn-sm',
                  onclick: async () => {
                    try {
                      await navigator.clipboard.writeText(`${location.origin}${location.pathname}#/f/${id}`);
                      toast('链接已复制', 'success');
                    } catch { toast('复制失败，请手动复制', 'warn'); }
                  }
                }, '复制')
              )
              : el('p', { class: 'field-hint' }, '问卷发布后可获取公开填写链接')
          )
        )
      )
    );
  };

  mount(root, el('div', { class: 'page page-builder' }, topHost, body));
  reload();
};
