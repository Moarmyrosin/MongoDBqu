import { api, ApiError } from '../api.js';
import { store } from '../store.js';
import { el, mount, toast, inputGroup, textInput } from '../ui.js';

export const renderAuth = (ctx, root, { mode = 'login' } = {}) => {
  const isLogin = mode === 'login';
  const username = textInput({ placeholder: '3~32 个字符', autocomplete: 'username' });
  const password = textInput({ type: 'password', placeholder: '至少 6 位', autocomplete: isLogin ? 'current-password' : 'new-password' });
  const email = textInput({ placeholder: '选填', autocomplete: 'email' });
  const submitBtn = el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, isLogin ? '登 录' : '注 册');
  const errorBox = el('div', { class: 'form-error', hidden: true });

  const showError = (msg) => {
    errorBox.textContent = msg;
    errorBox.hidden = !msg;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    showError('');
    submitBtn.disabled = true;
    try {
      const body = { username: username.value.trim(), password: password.value };
      if (!isLogin && email.value.trim()) body.email = email.value.trim();
      const res = await api[isLogin ? 'login' : 'register'](body);
      store.setSession(res.data.token, res.data.user);
      toast(isLogin ? '登录成功' : '注册成功，已自动登录', 'success');
      ctx.router.go('/surveys', { replace: true });
    } catch (err) {
      showError(err instanceof ApiError ? err.message : '请求失败，请重试');
    } finally {
      submitBtn.disabled = false;
    }
  };

  mount(
    root,
    el(
      'div',
      { class: 'auth-wrap' },
      el(
        'div',
        { class: 'auth-card' },
        el('div', { class: 'auth-head' },
          el('h1', {}, '问卷系统'),
          el('p', {}, isLogin ? '登录后创建和管理你的问卷' : '创建账号，开始发布问卷')
        ),
        errorBox,
        el(
          'form',
          { class: 'auth-form', onsubmit: onSubmit },
          inputGroup('用户名', username, { required: true }),
          inputGroup('密码', password, { required: true }),
          isLogin ? null : inputGroup('邮箱', email, { hint: '用于找回，可留空' }),
          submitBtn
        ),
        el(
          'div',
          { class: 'auth-switch' },
          isLogin
            ? el('span', {}, '还没有账号？', el('a', { href: '#/register' }, '立即注册'))
            : el('span', {}, '已有账号？', el('a', { href: '#/login' }, '去登录'))
        ),
        el('div', { class: 'auth-demo' },
          el('span', {}, '演示账号 '),
          el('code', {}, 'demo / password123'),
          el('button', {
            class: 'link-btn',
            type: 'button',
            onclick: () => {
              username.value = 'demo';
              password.value = 'password123';
            }
          }, '一键填入')
        )
      )
    )
  );
  username.focus();
};
