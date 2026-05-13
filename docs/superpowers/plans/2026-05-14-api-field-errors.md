# 后端字段错误映射 Implementation Plan

**Goal:** 让服务端字段错误能回填到前端写入表单，先覆盖 Skill ID 唯一性和 FastAPI 请求体校验。

## Steps

- [x] **Step 1: 写任务规格和红测**
  - 新增 `.agent/tasks/TASK-051.json` 并登记到 `.agent/tasks.json`。
  - API 测试覆盖创建 skill 重复 slug、更新 skill 重复 slug、请求体缺少 slug。
  - Playwright 测试覆盖 inspector 新建 skill 使用重复 Skill ID 后出现字段错误摘要。

- [x] **Step 2: 后端字段错误契约**
  - 新增 `FieldError` 和 `FieldInvariantError`。
  - repository 在 skill slug 唯一性冲突时抛出字段错误。
  - API handler 保留 `detail`，新增 `field_errors`。
  - FastAPI `RequestValidationError` 映射为字段错误数组。

- [x] **Step 3: 前端 API 错误类型**
  - 新增 `ApiError`、`ApiFieldError` 和响应解析 helper。
  - `apiSend/apiGet` 在非 2xx 时抛出 `ApiError`。

- [x] **Step 4: 表单映射**
  - `ValidatedForm` 捕获带 `fieldErrors` 的 `ApiError`。
  - 按 field name 查找当前 form 控件，显示 summary、字段旁错误和 `aria-invalid`。
  - 新建 skill / 编辑 skill 命令遇到字段错误时冒泡给 form。

- [x] **Step 5: 文档与验证**
  - 更新 README、API contract、产品完成度审计、摩擦审计、UX 复盘、任务日志和任务规格。
  - 运行 API、unit、typecheck、build、audit、E2E、diff check 和 JSON 校验。

## Rollback

如果字段错误映射导致表单提交或命令失败回归：

1. 保留后端 `field_errors` 契约，先撤销前端 `runCommand(..., { rethrowFieldErrors: true })` 调用，让失败回到全局 notice。
2. 如果 API 响应破坏旧客户端，再保留 `detail` 并只撤销新增 request validation handler。
3. 后续重新逐表单接入，不一次性扩大到所有 mutation。
