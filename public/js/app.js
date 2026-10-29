import { createRouter } from './router.js';
import { store } from './store.js';
import { api } from './api.js';
import { el, mount, clear, toast } from './ui.js';
import { renderAuth } from './views/auth.js';
import { renderSurveys } from './views/surveys.js';
import { renderBuilder } from './views/builder.js';
import { renderResults } from './views/results.js';
import { renderFill } from './views/fill.js';
import { renderSync } from './views/sync.js';
import { renderLibrary } from './views/library.js';
import { renderQuestionAnalytics } from './views/questionAnalytics.js';

const nav = document.getElementById('nav');
const view = document.getElementById('view');

const renderNav = () => {
  const user = store.user;
  clear(nav);
  nav.appendChild(
    el('div', { class: 'nav-inner' },
      el('a', { class: 'brand', href: '#/' },
        el('span', { class: 'brand-mark' }, '问'),
        el('span', { class: 'brand-text' }, '问卷系统')
      ),
      el('nav', { class: 'nav-links' },
        store.isLoggedIn ? el('a', { class: 'nav-link', href: '#/surveys' }, '我的问卷') : null,
        store.isLoggedIn ? el('a', { class: 'nav-link', href: '#/questions' }, '题目库') : null,
        el('a', { class: 'nav-link', href: '#/sync' }, '接口同步')
      ),
      el('div', { class: 'nav-right' },
        store.isLoggedIn
          ? el('div', { class: 'nav-user' },
            el('span', { class: 'nav-username' }, user?.username || '我'),
            el('button', {
              class: 'btn btn-ghost btn-sm',
              onclick: () => {
                store.clear();
                renderNav();
                toast('已退出登录', 'info');
                location.hash = '#/login';
              }
            }, '退出')
          )
          : el('div', { class: 'nav-user' },
            el('a', { class: 'btn btn-ghost btn-sm', href: '#/login' }, '登录'),
            el('a', { class: 'btn btn-primary btn-sm', href: '#/register' }, '注册')
          )
      )
    )
  );
};

const router = createRouter();

const requireAuth = (ctx) => {
  if (!store.isLoggedIn) {
    toast('请先登录', 'warn');
    ctx.router.go('/login', { replace: true });
    return false;
  }
  return true;
};

const refreshMe = async () => {
  if (!store.isLoggedIn) return;
  try {
    const res = await api.me();
    store.setUser(res.data);
  } catch {
    store.clear();
    renderNav();
  }
};

router
  .use((ctx) => { ctx.router = router; })
  .on('/', () => router.go(store.isLoggedIn ? '/surveys' : '/login', { replace: true }))
  .on('/login', (ctx) => {
    renderNav();
    renderAuth(ctx, view, { mode: 'login' });
  })
  .on('/register', (ctx) => {
    renderNav();
    renderAuth(ctx, view, { mode: 'register' });
  })
  .on('/surveys', (ctx) => {
    if (!requireAuth(ctx)) return;
    renderNav();
    renderSurveys(ctx, view);
  })
  .on('/surveys/:id/edit', (ctx) => {
    if (!requireAuth(ctx)) return;
    renderNav();
    renderBuilder(ctx, view);
  })
  .on('/surveys/:id/results', (ctx) => {
    if (!requireAuth(ctx)) return;
    renderNav();
    renderResults(ctx, view);
  })
  .on('/questions', (ctx) => {
    if (!requireAuth(ctx)) return;
    renderNav();
    renderLibrary(ctx, view);
  })
  .on('/questions/:id/analytics', (ctx) => {
    if (!requireAuth(ctx)) return;
    renderNav();
    renderQuestionAnalytics(ctx, view);
  })
  .on('/f/:id', (ctx) => {
    renderNav();
    renderFill(ctx, view);
  })
  .on('/sync', (ctx) => {
    renderNav();
    renderSync(ctx, view);
  })
  .fallback((ctx) => {
    renderNav();
    mount(view,
      el('div', { class: 'page' },
        el('div', { class: 'empty' },
          el('h2', {}, '页面不存在'),
          el('p', {}, `找不到 ${ctx.path}`),
          el('a', { class: 'btn btn-primary', href: '#/' }, '返回首页')
        )
      )
    );
  });

renderNav();
refreshMe();
router.resolve();
