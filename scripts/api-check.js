#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import app from '../src/app.js';
import { listRoutes } from '../src/common/utils/routeIntrospect.js';
import { ENDPOINTS } from '../public/js/endpoints.js';

const here = dirname(fileURLToPath(import.meta.url));
const toMethodSet = (value) => new Set((Array.isArray(value) ? value : [value]).map((m) => m.toUpperCase()));
const normalize = (p) => ('/' + String(p).replace(/^\/+/, '')).replace(/\/+$/, '') || '/';

const live = listRoutes(app);
const liveKeys = new Set();
for (const route of live) {
  for (const method of route.methods) liveKeys.add(`${method} ${normalize(route.path)}`);
}

const declaredKeys = new Set();
for (const [name, def] of Object.entries(ENDPOINTS)) {
  const path = normalize(def.path);
  for (const method of toMethodSet(def.method)) declaredKeys.add(`${method} ${path}`);
  def._name = name;
}

const onlyBackend = [...liveKeys].filter((k) => !declaredKeys.has(k)).sort();
const onlyFrontend = [...declaredKeys].filter((k) => !liveKeys.has(k)).sort();
const matched = [...liveKeys].filter((k) => declaredKeys.has(k)).sort();

const lines = [];
lines.push(`接口同步检查  (后端 ${liveKeys.size} 条 / 前端声明 ${declaredKeys.size} 条)`);
lines.push('');
lines.push(`  一致   ${matched.length}`);
for (const k of matched) lines.push(`         ${k}`);
if (onlyBackend.length) {
  lines.push('');
  lines.push(`  仅后端有（前端未声明，需要在 public/js/endpoints.js 补充） ${onlyBackend.length}`);
  for (const k of onlyBackend) lines.push(`         ${k}`);
}
if (onlyFrontend.length) {
  lines.push('');
  lines.push(`  仅前端有（后端已不存在，需要删除或修正） ${onlyFrontend.length}`);
  for (const k of onlyFrontend) lines.push(`         ${k}`);
}
lines.push('');
lines.push(onlyBackend.length + onlyFrontend.length === 0 ? '  ✔ 前后端接口完全同步' : '  ✘ 存在接口漂移，请按上面提示修正');

console.log(lines.join('\n'));
process.exit(onlyBackend.length + onlyFrontend.length === 0 ? 0 : 1);
