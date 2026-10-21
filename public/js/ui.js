export const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const CHILD_SKIP = (c) => c === null || c === undefined || c === false || c === true;

const appendChild = (parent, child) => {
  if (CHILD_SKIP(child)) return;
  if (Array.isArray(child)) {
    child.forEach((c) => appendChild(parent, c));
    return;
  }
  parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
};

export const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs || {})) {
    if (CHILD_SKIP(val)) continue;
    if (key === 'class' || key === 'className') {
      node.className = Array.isArray(val) ? val.filter(Boolean).join(' ') : val;
    } else if (key === 'dataset') {
      Object.assign(node.dataset, val);
    } else if (key === 'style' && typeof val === 'object') {
      Object.assign(node.style, val);
    } else if (key.startsWith('on') && typeof val === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), val);
    } else if (key === 'html') {
      node.innerHTML = val;
    } else if (key === 'value') {
      node.value = val;
    } else if (key === 'checked' || key === 'disabled' || key === 'selected' || key === 'multiple' || key === 'required') {
      node[key] = Boolean(val);
    } else {
      node.setAttribute(key, String(val));
    }
  }
  children.forEach((c) => appendChild(node, c));
  return node;
};

export const frag = (...children) => {
  const f = document.createDocumentFragment();
  children.forEach((c) => appendChild(f, c));
  return f;
};

export const clear = (node) => {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
};

export const mount = (node, ...children) => {
  clear(node);
  children.forEach((c) => appendChild(node, c));
  return node;
};

export const fmtDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const fmtDate = (value) => (value ? fmtDateTime(value).slice(0, 10) : '—');

export const deadlineToInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

let toastHost = null;
export const toast = (message, type = 'info', timeout = 3200) => {
  if (!toastHost) {
    toastHost = el('div', { class: 'toast-host' });
    document.body.appendChild(toastHost);
  }
  const item = el('div', { class: `toast toast-${type}` }, message);
  toastHost.appendChild(item);
  requestAnimationFrame(() => item.classList.add('toast-in'));
  setTimeout(() => {
    item.classList.remove('toast-in');
    setTimeout(() => item.remove(), 260);
  }, timeout);
};

export const spinner = (label = '加载中…') =>
  el('div', { class: 'spinner' }, el('div', { class: 'spinner-ring' }), el('span', {}, label));

export const emptyState = (text, action) =>
  el('div', { class: 'empty' }, el('p', {}, text), action || null);

export const badge = (status) => {
  const map = { draft: '草稿', published: '已发布', closed: '已关闭' };
  return el('span', { class: `badge badge-${status}` }, map[status] || status);
};

export const confirmDialog = (message, { confirmText = '确定', danger = false } = {}) =>
  new Promise((resolve) => {
    const close = () => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        close();
        resolve(false);
      }
    };
    const ok = () => {
      close();
      resolve(true);
    };
    const cancel = () => {
      close();
      resolve(false);
    };
    const backdrop = el(
      'div',
      { class: 'modal-backdrop', onclick: (e) => e.target === backdrop && cancel() },
      el(
        'div',
        { class: 'modal', role: 'dialog' },
        el('div', { class: 'modal-body' }, el('p', { class: 'modal-message' }, message)),
        el(
          'div',
          { class: 'modal-actions' },
          el('button', { class: 'btn btn-ghost', onclick: cancel }, '取消'),
          el('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onclick: ok }, confirmText)
        )
      )
    );
    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);
  });

export const openModal = ({ title, body, actions = [], wide = false }) => {
  const backdrop = el('div', { class: 'modal-backdrop' });
  const close = () => {
    backdrop.classList.remove('modal-in');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => backdrop.remove(), 200);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  backdrop.addEventListener('click', (e) => e.target === backdrop && close());
  document.addEventListener('keydown', onKey);

  const bodyHost = el('div', { class: 'modal-body' });
  const result = { close, body: bodyHost };
  if (typeof body === 'function') body(bodyHost, result);
  else appendChild(bodyHost, body);

  backdrop.appendChild(
    el(
      'div',
      { class: `modal ${wide ? 'modal-wide' : ''}`, role: 'dialog' },
      el(
        'div',
        { class: 'modal-head' },
        el('h3', {}, title),
        el('button', { class: 'icon-btn', onclick: close, 'aria-label': '关闭' }, '×')
      ),
      bodyHost,
      actions.length ? el('div', { class: 'modal-actions' }, actions.map((a) => a(close))) : null
    )
  );
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('modal-in'));
  return result;
};

export const inputGroup = (label, control, { hint, required = false, error } = {}) =>
  el(
    'label',
    { class: `field ${error ? 'field-error' : ''}` },
    el('span', { class: 'field-label' }, label, required ? el('i', { class: 'req' }, '*') : null),
    control,
    hint ? el('span', { class: 'field-hint' }, hint) : null,
    error ? el('span', { class: 'field-msg' }, error) : null
  );

export const textInput = (attrs = {}) => el('input', { type: 'text', class: 'input', ...attrs });
export const textArea = (attrs = {}) => el('textarea', { class: 'input', rows: 3, ...attrs });
export const select = (options, attrs = {}) =>
  el(
    'select',
    { class: 'input', ...attrs },
    options.map((o) => el('option', { value: o.value, selected: String(o.value) === String(attrs.value) }, o.label))
  );

export const checkboxRow = (label, checked, onChange, hint) =>
  el(
    'label',
    { class: 'check-row' },
    el('input', {
      type: 'checkbox',
      checked,
      onchange: (e) => onChange(e.target.checked)
    }),
    el('span', { class: 'check-text' }, label, hint ? el('small', {}, hint) : null)
  );
