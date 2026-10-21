/**
 * 前端接口声明 —— 唯一真相来源。
 *
 * 后端接口发生变化时，只需要修改本文件，然后运行 `npm run api:check`
 * 即可自动比对声明与后端实际路由是否一致。
 *
 * 字段说明：
 *   method : HTTP 方法，或方法数组
 *   path   : 完整路径，`:xxx` 为路径参数
 *   auth   : false = 公开 | 'required' = 需要 Bearer token
 *   desc   : 中文说明，用于「接口同步」页展示
 */
export const ENDPOINTS = {
  health: { method: 'GET', path: '/api/health', auth: false, desc: '健康检查' },
  apiInfo: { method: 'GET', path: '/api', auth: false, desc: '服务信息' },
  metaRoutes: { method: 'GET', path: '/api/_meta/routes', auth: false, desc: '后端实际路由清单（自省）' },

  register: { method: 'POST', path: '/api/auth/register', auth: false, desc: '注册' },
  login: { method: 'POST', path: '/api/auth/login', auth: false, desc: '登录' },
  me: { method: 'GET', path: '/api/auth/me', auth: 'required', desc: '当前用户' },

  createSurvey: { method: 'POST', path: '/api/surveys', auth: 'required', desc: '创建问卷' },
  listMySurveys: { method: 'GET', path: '/api/surveys/mine', auth: 'required', desc: '我的问卷列表' },
  getSurvey: { method: 'GET', path: '/api/surveys/:id', auth: 'required', desc: '问卷详情' },
  updateSurvey: { method: 'PATCH', path: '/api/surveys/:id', auth: 'required', desc: '修改问卷（仅草稿）' },
  deleteSurvey: { method: 'DELETE', path: '/api/surveys/:id', auth: 'required', desc: '删除问卷（仅草稿）' },

  addQuestion: { method: 'POST', path: '/api/surveys/:id/questions', auth: 'required', desc: '添加题目（仅草稿）' },
  updateQuestion: { method: 'PATCH', path: '/api/surveys/:id/questions/:qid', auth: 'required', desc: '修改题目（仅草稿）' },
  deleteQuestion: { method: 'DELETE', path: '/api/surveys/:id/questions/:qid', auth: 'required', desc: '删除题目（仅草稿）' },
  reorderQuestions: { method: 'POST', path: '/api/surveys/:id/questions/reorder', auth: 'required', desc: '重排题目（仅草稿）' },

  publishSurvey: { method: 'POST', path: '/api/surveys/:id/publish', auth: 'required', desc: '发布问卷' },
  closeSurvey: { method: 'POST', path: '/api/surveys/:id/close', auth: 'required', desc: '关闭问卷' },
  setDeadline: { method: 'PATCH', path: '/api/surveys/:id/deadline', auth: 'required', desc: '设置/清除截止时间' },

  getForm: { method: 'GET', path: '/api/surveys/:id/form', auth: false, desc: '填写表单（公开）' },
  submitResponse: { method: 'POST', path: '/api/surveys/:id/responses', auth: 'required', desc: '提交答卷' },
  listResponses: { method: 'GET', path: '/api/surveys/:id/responses', auth: 'required', desc: '答卷列表（仅拥有者）' },
  surveyAnalytics: { method: 'GET', path: '/api/surveys/:id/analytics', auth: 'required', desc: '全卷统计（仅拥有者）' },
  questionAnalytics: { method: 'GET', path: '/api/surveys/:id/questions/:qid/analytics', auth: 'required', desc: '单题统计（仅拥有者）' }
};

export const HTTP_METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];
