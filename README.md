# Survey System

基于 MongoDB 的模块化问卷系统，支持**题目库（题目保存/复用/分享/版本化）**与**题库（题目分组管理）**，以及**单题跨问卷统计**。

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

# 6. 校验前端接口声明与后端路由是否同步
npm run api:check

# 7. 端到端回归测试（自包含，自动拉起应用，验证 8 项需求变更）
npm test
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
| `#/library` | 题目库（我的题目 / 共享给我的 / 题库，创建、编辑、分享、版本历史、恢复） |
| `#/question/:id/analytics` | 单题跨问卷统计 |
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
| GET | /api/library | 我的题目 / 共享给我的 / 题库列表 |
| POST | /api/library | 新建题目（可指定 bankId 归入题库） |
| GET | /api/library/:id | 题目详情 |
| PATCH | /api/library/:id | 修改题目（默认产生新版本） |
| DELETE | /api/library/:id | 删除题目（软删除，保留历史版本） |
| GET | /api/library/:id/versions | 版本历史 |
| POST | /api/library/:id/restore | 恢复某个历史版本 |
| POST | /api/library/:id/share | 设置共享用户 |
| GET | /api/library/:id/shared-users | 查看共享用户 |
| GET | /api/library/:id/usage | 使用记录（哪些问卷、哪些版本用到） |
| GET | /api/library/:id/analytics | 单题跨问卷统计（含各问卷明细） |
| POST | /api/banks | 新建题库 |
| GET | /api/banks | 我的题库 |
| PATCH | /api/banks/:id | 重命名题库 |
| DELETE | /api/banks/:id | 删除题库（题目移出题库） |

## 模块结构

```
src/
  config/         # 环境变量、数据库连接
  common/         # 错误、响应、中间件、工具
  modules/
    auth/         # 注册登录
    users/        # 用户模型
    surveys/      # 问卷 CRUD、发布、截止、题目快照
    questions/    # 题目库 + 题库 + 版本链 + 使用统计 + 跨问卷统计
    responses/    # 答卷提交与校验（记录 sourceQuestionId）
    analytics/    # 统计结果
    rules/        # 跳转规则引擎
    validation/   # 通用校验
  routes/         # 路由汇总
  app.js
  server.js
scripts/
  seed.js                    # 示例数据
  api-check.js               # 接口同步自检
  e2e-requirements-test.mjs  # 8 项需求变更端到端回归测试（npm test）
```

## 需求变更（题目复用 / 分享 / 版本化 / 题库 / 跨问卷统计）

| 编号 | 需求 | 实现方式 |
|------|------|----------|
| R1 | 保存题目以便复用 | `POST /api/library` 保存为 `LibraryQuestion`，问卷编辑器可选“从题目库选用” |
| R2 | 分享题目 | `POST /api/library/:id/share` 写入 `sharedWith`，被共享者只读复用 |
| R3 | 修改不影响已发布问卷 | 选用题目时**复制内容快照**进问卷子文档；题库修改不触碰快照 |
| R4 | 修改历史 + 恢复 | `rootQuestionId` 版本链 + `GET .../versions` + `POST .../restore` |
| R5 | 多版本共存 | 每次编辑默认 `createNewVersion`，`previousVersionId` 串联，`{rootQuestionId, version}` 唯一索引 |
| R6 | 使用记录 | `GET /api/library/:id/usage` 返回用到该题的问卷、版本、是否本人问卷 |
| R7 | 题库 | `QuestionBank` 模型 + `bankId` 关联 + 题库 CRUD |
| R8 | 跨问卷统计 | 答卷按 `sourceQuestionId` 记录，`GET /api/library/:id/analytics` 聚合所有问卷 |

> 详细的设计思路、修改原因与改动方案见 [`docs/需求变更-设计思路与修改方案.md`](docs/需求变更-设计思路与修改方案.md)。

## 扩展点

- **新增题型**：在 `src/modules/questions/questionTypes.js` 中调用 `QuestionTypeRegistry.register(type, impl)`，无需改动答卷提交主逻辑。
- **调整校验规则**：题目的 `validationRule` 为自由 Mixed 字段，新规则只需在对应题型实现中读取。
- **调整跳转逻辑**：`jumpRules` 存于题目内，条件/动作结构可扩展；解析在 `src/modules/rules/`。
- **新增开关**：在 `survey.settings` 中增加字段，填表/提交时按需读取。
- **题目版本策略**：在 `library.service.js` 的 `updateQuestion` 中通过 `forceNewVersion` / `createNewVersionFrom` 控制“原地改”与“分支新版本”两种策略。
