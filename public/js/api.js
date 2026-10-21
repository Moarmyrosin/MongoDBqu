import { ENDPOINTS } from './endpoints.js';
import { store } from './store.js';

export class ApiError extends Error {
  constructor(message, { status = 0, details = null, payload = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.payload = payload;
  }
}

export const buildPath = (endpoint, params = {}) => {
  const def = typeof endpoint === 'string'
  ? (ENDPOINTS[endpoint] || { path: endpoint, method: 'GET', auth: false })
  : endpoint;
  if (!def) throw new Error(`未知接口: ${endpoint}`);
  return def.path.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    const val = params[key];
    if (val === undefined || val === null || val === '') {
      throw new Error(`缺少路径参数 ${key}（接口 ${def.path}）`);
    }
    return encodeURIComponent(String(val));
  });
};

export const request = async (endpoint, { params, query, body, auth, signal, raw = false } = {}) => {
  const def = typeof endpoint === 'string'
    ? (ENDPOINTS[endpoint] || { path: endpoint, method: 'GET', auth: false })
    : endpoint;
  if (!def) throw new Error(`未知接口: ${endpoint}`);

  let url = buildPath(endpoint, params || {});
  if (query && Object.keys(query).length) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      qs.append(k, String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const headers = { Accept: 'application/json' };
  const needAuth = auth === undefined ? def.auth === 'required' : auth;
  if (needAuth && store.token) headers.Authorization = `Bearer ${store.token}`;

  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, { method: def.method, headers, body: payload, signal });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError('无法连接服务器，请确认后端已启动', { status: 0 });
  }

  if (raw) {
    if (!res.ok) throw new ApiError(`请求失败 (${res.status})`, { status: res.status });
    return res;
  }

  if (res.status === 204) return null;

  let json = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok || json?.success === false) {
    throw new ApiError(json?.message || `请求失败 (${res.status})`, {
      status: res.status,
      details: json?.details ?? null,
      payload: json
    });
  }

  return json;
};

const wrap = (endpoint, maker) => (args) => maker(endpoint, args);

export const api = {
  health: wrap('health', (e, a) => request(e, a)),
  apiInfo: wrap('apiInfo', (e, a) => request(e, a)),
  metaRoutes: wrap('metaRoutes', (e, a) => request(e, a)),

  register: (body) => request('register', { body }),
  login: (body) => request('login', { body }),
  me: () => request('me'),

  createSurvey: (body) => request('createSurvey', { body }),
  listMySurveys: (query) => request('listMySurveys', { query }),
  getSurvey: (id) => request('getSurvey', { params: { id } }),
  updateSurvey: (id, body) => request('updateSurvey', { params: { id }, body }),
  deleteSurvey: (id) => request('deleteSurvey', { params: { id } }),

  addQuestion: (id, body) => request('addQuestion', { params: { id }, body }),
  updateQuestion: (id, qid, body) => request('updateQuestion', { params: { id, qid }, body }),
  deleteQuestion: (id, qid) => request('deleteQuestion', { params: { id, qid } }),
  reorderQuestions: (id, order) => request('reorderQuestions', { params: { id }, body: { order } }),

  publishSurvey: (id) => request('publishSurvey', { params: { id } }),
  closeSurvey: (id) => request('closeSurvey', { params: { id } }),
  setDeadline: (id, deadline) => request('setDeadline', { params: { id }, body: { deadline } }),

  getForm: (id, auth = false) => request('getForm', { params: { id }, auth }),
  submitResponse: (id, body) => request('submitResponse', { params: { id }, body }),
  listResponses: (id, query) => request('listResponses', { params: { id }, query }),
  surveyAnalytics: (id) => request('surveyAnalytics', { params: { id } }),
  questionAnalytics: (id, qid) => request('questionAnalytics', { params: { id, qid } })
};
