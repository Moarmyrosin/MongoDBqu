const compile = (pattern) => {
  const keys = [];
  const source = pattern
    .replace(/\/+$/, '')
    .split('/')
    .map((seg) => {
      if (!seg) return '';
      if (seg.startsWith(':')) {
        keys.push(seg.slice(1));
        return '/([^/]+)';
      }
      return seg === '*' ? '/.*' : `/${seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
    })
    .join('');
  return { regex: new RegExp(`^${source || '/'}/?$`), keys };
};

export const createRouter = (root) => {
  const routes = [];
  const middleware = [];
  let notFound = () => {};
  let current = null;

  const parseHash = () => {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [pathPart, queryPart = ''] = raw.split('?');
    const query = Object.fromEntries(new URLSearchParams(queryPart));
    return { path: pathPart.replace(/\/+$/, '') || '/', query, raw };
  };

  const api = {
    use(fn) {
      middleware.push(fn);
      return api;
    },
    on(pattern, handler) {
      routes.push({ ...compile(pattern), handler, pattern });
      return api;
    },
    fallback(handler) {
      notFound = handler;
      return api;
    },
    go(path, { replace = false } = {}) {
      const target = `#${path}`;
      if (replace) location.replace(target);
      else location.hash = path;
    },
    current() {
      return current;
    },
    refresh() {
      dispatch();
    }
  };

  const dispatch = async () => {
    const { path, query } = parseHash();
    for (const route of routes) {
      const m = route.regex.exec(path);
      if (!m) continue;
      const params = {};
      route.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      const ctx = { path, params, query, route: route.pattern };
      current = ctx;
      for (const mw of middleware) {
        const stop = await mw(ctx);
        if (stop === false) return;
      }
      return route.handler(ctx);
    }
    current = { path, params: {}, query, route: null };
    notFound(current);
  };

  window.addEventListener('hashchange', dispatch);
  api.resolve = dispatch;
  return api;
};
