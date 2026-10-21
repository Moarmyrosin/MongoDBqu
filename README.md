# Survey System

基于 MongoDB 的模块化问卷系统后端。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（复制 .env.example 为 .env 并修改）
# 本地需已运行 MongoDB（默认 mongodb://localhost:27017）

# 3. 启动开发服务器
npm run dev

# 4. 浏览器访问前端
#    http://localhost:3000  （前端由后端直接托管，无需另起服务）

# 5. 可选：写入示例数据（demo / password123）
npm run seed

# 6. 可选：校验前端接口声明与后端路由是否同步
npm run api:check
```

## 前端

纯静态 SPA（原生 ES Module，无构建步骤），由后端 `express.static` 直接托管。

| 路由 | 页面 |
|------|------|
| `#/login` `#/register` | 登录 / 注册 |
| `#/surveys` | 我的问卷（新建、筛选、发布、关闭、删除、复制链接） |
| `#/surveys/:id/edit` | 问卷编辑器（基本信息、填写设置、题目、选项、校验规则、跳转规则、截止时间） |
| `#/surveys/:id/results` | 统计结果（条形图 / 数字统计 / 文字列表）与答卷明细 |
| `#/f/:id` | 公开填写页（支持逐步向导模式、跳转、逐题校验、错误定位） |
| `#/sync` | 接口同步自检 |

### 后端改了接口后如何同步

接口声明集中在 **`public/js/endpoints.js`**（唯一真相来源）。后端接口变化时：

1. 编辑 `public/js/endpoints.js` 中的声明
2. 运行 `npm run api:check`，或打开 `#/sync` 页查看比对结果
3. 如需在页面中调用新接口，在 `public/js/api.js` 补一个函数即可

`npm run api:check` 会通过 `GET /api/_meta/routes` 自省后端实际路由，与前端声明逐条比对，输出「一致 / 仅后端有 / 仅前端有」三类结果，存在漂移时退出码为 1。


## 核心 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 注册 |
| POST | /api/auth/login | 登录（返回 token） |
| GET | /api/auth/me | 当前用户 |
| POST | /api/surveys | 创建问卷 |
| GET | /api/surveys/mine | 我的问卷列表 |
| GET | /api/surveys/:id | 问卷详情 |
| PATCH | /api/surveys/:id | 修改问卷基本信息 |
| DELETE | /api/surveys/:id | 删除问卷（仅草稿） |
| POST | /api/surveys/:id/questions | 添加题目 |
| PATCH | /api/surveys/:id/questions/:qid | 修改题目 |
| DELETE | /api/surveys/:id/questions/:qid | 删除题目 |
| POST | /api/surveys/:id/questions/reorder | 重排题目 |
| POST | /api/surveys/:id/publish | 发布问卷 |
| POST | /api/surveys/:id/close | 关闭问卷 |
| PATCH | /api/surveys/:id/deadline | 设置截止时间 |
| GET | /api/surveys/:id/form | 获取填写表单（公开） |
| POST | /api/surveys/:id/responses | 提交答卷（可匿名） |
| GET | /api/surveys/:id/responses | 答卷列表（仅拥有者） |
| GET | /api/surveys/:id/analytics | 全卷统计（仅拥有者） |
| GET | /api/surveys/:id/questions/:qid/analytics | 单题统计（仅拥有者） |

## 模块结构

```
src/
  config/         # 环境变量、数据库连接
  common/         # 错误、响应、中间件、工具
  modules/
    auth/         # 注册登录
    users/        # 用户模型
    surveys/      # 问卷 CRUD、发布、截止
    questions/    # 题型注册表（单选/多选/文本/数字）
    responses/    # 答卷提交与校验
    analytics/    # 统计结果
    rules/        # 跳转规则引擎
    validation/   # 通用校验
  routes/         # 路由汇总
  app.js
  server.js
scripts/seed.js   # 示例数据
```

## 扩展点

- **新增题型**：在 `src/modules/questions/questionTypes.js` 中调用 `QuestionTypeRegistry.register(type, impl)`，无需改动答卷提交主逻辑。
- **调整校验规则**：题目的 `validationRule` 为自由 Mixed 字段，新规则只需在对应题型实现中读取。
- **调整跳转逻辑**：`jumpRules` 存于题目内，条件/动作结构可扩展；解析在 `src/modules/rules/`。
- **新增开关**：在 `survey.settings` 中增加字段，填表/提交时按需读取。
