import { api } from '../api.js';
import { ENDPOINTS } from '../endpoints.js';
import { el, mount, clear, spinner, emptyState, badge, fmtDateTime } from '../ui.js';

const normalize = (p) => ('/' + String(p).replace(/^\/+/, '')).replace(/\/+$/, '') || '/';
const methodsOf = (def) => (Array.isArray(def.method) ? def.method : [def.method]).map((m) => m.toUpperCase());
const keyOf = (method, path) => `${method} ${normalize(path)}`;

const AUTH_LABEL = { false: '公开', required: '需登录', optional: '可选' };

export const renderSync = (ctx, root) => {
  const content = el('div', {});
  const summaryHost = el('div', {});

  const buildDeclared = () => {
    const rows = [];
    for (const [name, def] of Object.entries(ENDPOINTS)) {
      for (const method of methodsOf(def)) {
        rows.push({ name, method, path: normalize(def.path), auth: def.auth, desc: def.desc });
      }
    }
    return rows.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  };

  const renderResult = (liveRoutes) => {
    const declared = buildDeclared();
    const liveKeys = new Set();
    for (const r of liveRoutes) for (const m of r.methods) liveKeys.add(keyOf(m, r.path));
    const declaredKeys = new Set(declared.map((d) => keyOf(d.method, d.path)));

    const onlyBackend = [...liveKeys].filter((k) => !declaredKeys.has(k)).sort();
    const onlyFrontend = [...declaredKeys].filter((k) => !liveKeys.has(k)).sort();
    const matched = declared.filter((d) => liveKeys.has(keyOf(d.method, d.path)));
    const inSync = onlyBackend.length === 0 && onlyFrontend.length === 0;

    clear(summaryHost);
    summaryHost.appendChild(
      el('div', { class: `sync-banner ${inSync ? 'sync-ok' : 'sync-bad'}` },
        el('div', {},
          el('strong', {}, inSync ? '前后端接口完全同步' : '检测到接口漂移'),
          el('p', {}, inSync
            ? `后端实际暴露 ${liveKeys.size} 条路由，与前端 endpoints.js 声明的 ${declaredKeys.size} 条完全一致。`
            : '前端接口声明与后端实际路由不一致，请按下方提示修正 public/js/endpoints.js。')
        ),
        el('div', { class: 'sync-counts' },
          el('span', { class: 'sync-num sync-num-ok' }, matched.length),
          el('span', { class: 'sync-num sync-num-bad' }, onlyBackend.length),
          el('span', { class: 'sync-num sync-num-bad' }, onlyFrontend.length)
        )
      )
    );

    const group = (title, hint, keys, tone) =>
      keys.length
        ? el('section', { class: 'card section-card' },
          el('div', { class: 'section-head' },
            el('h3', {}, title),
            el('span', { class: 'meta-dim' }, `${keys.length} 条`)
          ),
          el('p', { class: 'field-hint' }, hint),
          el('div', { class: 'sync-keys' }, keys.map((k) => el('code', { class: `sync-key sync-key-${tone}` }, k)))
        )
        : null;

    mount(content,
      group('仅后端有（前端未声明）', '后端新增或改名了接口。请在 public/js/endpoints.js 中补充对应声明。', onlyBackend, 'bad'),
      group('仅前端有（后端已不存在）', '后端删除或改名了接口。请修正或删除 endpoints.js 中的声明。', onlyFrontend, 'bad'),

      el('section', { class: 'card section-card' },
        el('div', { class: 'section-head' },
          el('h3', {}, '前端声明清单'),
          el('span', { class: 'meta-dim' }, `endpoints.js · ${declared.length} 条`)
        ),
        el('table', { class: 'table' },
          el('thead', {}, el('tr', {},
            el('th', {}, '状态'), el('th', {}, '方法'), el('th', {}, '路径'), el('th', {}, '鉴权'), el('th', {}, '说明'), el('th', {}, '常量名')
          )),
          el('tbody', {},
            declared.map((d) => {
              const ok = liveKeys.has(keyOf(d.method, d.path));
              return el('tr', { class: ok ? '' : 'row-bad' },
                el('td', {}, el('span', { class: `dot ${ok ? 'dot-ok' : 'dot-bad'}` }, ok ? '一致' : '缺失')),
                el('td', {}, el('code', {}, d.method)),
                el('td', {}, el('code', {}, d.path)),
                el('td', {}, AUTH_LABEL[d.auth] ?? String(d.auth)),
                el('td', {}, d.desc),
                el('td', {}, el('code', { class: 'dim' }, d.name))
              );
            })
          )
        )
      ),

      el('section', { class: 'card section-card' },
        el('div', { class: 'section-head' }, el('h3', {}, '后端实际路由')),
        el('p', { class: 'field-hint' }, `来自 GET /api/_meta/routes 的实时自省结果，共 ${liveRoutes.length} 条路径。`),
        el('div', { class: 'sync-keys' },
          liveRoutes.map((r) => el('code', { class: `sync-key ${declaredKeys.has(keyOf(r.methods[0], r.path)) || r.methods.some((m) => declaredKeys.has(keyOf(m, r.path))) ? 'sync-key-ok' : 'sync-key-bad'}` },
            `${r.methods.join('/')} ${r.path}`
          ))
        )
      ),

      el('section', { class: 'card section-card' },
        el('div', { class: 'section-head' }, el('h3', {}, '如何同步更新')),
        el('ol', { class: 'howto' },
          el('li', {}, '后端接口发生变化时，只需编辑 ', el('code', {}, 'public/js/endpoints.js'), ' 中的声明。'),
          el('li', {}, '运行 ', el('code', {}, 'npm run api:check'), ' 在命令行核对，或刷新本页查看结果。'),
          el('li', {}, '若新增了接口，在 ', el('code', {}, 'public/js/api.js'), ' 中补一个调用函数即可在页面中使用。')
        )
      )
    );
  };

  const load = async () => {
    mount(summaryHost, el('div', {}));
    mount(content, spinner('正在自省后端路由…'));
    try {
      const res = await api.metaRoutes();
      renderResult(res.data.routes || []);
    } catch (err) {
      mount(content, emptyState(`无法获取后端路由：${err.message}`, el('button', { class: 'btn btn-primary', onclick: load }, '重试')));
    }
  };

  mount(root,
    el('div', { class: 'page' },
      el('div', { class: 'page-head' },
        el('div', {},
          el('h2', {}, '接口同步自检'),
          el('p', { class: 'page-sub' }, '比对前端 endpoints.js 声明与后端实际暴露的路由')
        ),
        el('button', { class: 'btn btn-primary', onclick: load }, '重新检查')
      ),
      summaryHost, content
    )
  );
  load();
};
