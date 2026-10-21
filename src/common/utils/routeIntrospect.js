const UNMOUNTED = Symbol('unmounted');

const REGEXP_PREFIX_MARKERS = [
  { find: '\\/?(?=\\/|$)', replace: '' },
  { find: '(?=\\/|$)', replace: '' },
  { find: '(?=\\/)', replace: '' },
  { find: '\\/?:?', replace: '/' }
];

const regexpToPrefix = (regexp) => {
  if (!regexp) return '';
  if (regexp.fast_slash) return '';
  let source = String(regexp.source);

  REGEXP_PREFIX_MARKERS.forEach(({ find, replace }) => {
    source = source.split(find).join(replace);
  });

  source = source.replace(/^\^/, '').replace(/\$$/, '');
  source = source.replace(/\\\//g, '/');
  source = source.replace(/\(\?:\(\[\^\/\]\+\?\)\)/g, ':param');
  source = source.replace(/\(\[\^\/\]\+\?\)/g, ':param');
  source = source.replace(/\\\*/g, '*');
  source = source.replace(/\(\?=\\\|\$\)|\(\?=\\\/\|\$\)/g, '');
  source = source.replace(/\(\?:\|\\\$\)/g, '');
  source = source.replace(/\|\\\$\)/g, ')');
  return source;
};

const toPathString = (path) => {
  if (Array.isArray(path)) return path.map(toPathString);
  return String(path);
};

const collect = (stack, prefix = '', out = []) => {
  for (const layer of stack || []) {
    if (layer.route) {
      const paths = toPathString(layer.route.path);
      const methods = Object.keys(layer.route.methods || {})
        .filter((m) => layer.route.methods[m] && m !== '_all')
        .map((m) => m.toUpperCase());
      for (const p of Array.isArray(paths) ? paths : [paths]) {
        const full = `${prefix}${p === '/' ? '' : p}` || '/';
        out.push({ path: full, methods });
      }
      continue;
    }

    if (layer.name === 'router' && layer.handle?.stack) {
      collect(layer.handle.stack, prefix + regexpToPrefix(layer.regexp), out);
    }
  }
  return out;
};

export const listRoutes = (app, { prefix = '/api' } = {}) => {
  const router = app._router || app.router;
  if (!router?.stack) return [];

  const merged = new Map();
  for (const entry of collect(router.stack)) {
    if (prefix && !entry.path.startsWith(prefix)) continue;
    const key = entry.path;
    if (!merged.has(key)) merged.set(key, new Set());
    entry.methods.forEach((m) => merged.get(key).add(m));
  }

  return [...merged.entries()]
    .map(([path, methods]) => ({ path, methods: [...methods].sort() }))
    .sort((a, b) => a.path.localeCompare(b.path) || a.methods[0].localeCompare(b.methods[0]));
};

export { UNMOUNTED };
