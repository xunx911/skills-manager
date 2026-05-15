# 保存视图名称字段级校验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for behavior changes and superpowers:verification-before-completion before claiming completion. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 saved run view 的重复名、空白名和超长名都返回字段级错误，并在 History 页回填到 `保存视图名称` 输入框。

**Architecture:** 后端用 Pydantic 限制 `CreateSavedViewPayload.name`，repository 对 trim 后空白和唯一约束冲突抛 `FieldInvariantError`。前端把 `SavedRunViews` 从按钮区升级为 `ValidatedForm`，复用现有 API field error 回填。

**Tech Stack:** FastAPI、Pydantic v2、pytest、React、Next.js、Playwright。

---

### Task 1: API 红绿测试

**Files:**
- Modify: `apps/api/tests/test_api_commands.py`

- [x] **Step 1: 写失败测试**
  - 扩展 saved view endpoint 测试，断言重复名称返回 `field_errors[0].field == "name"` 和 code `saved_view.name_conflict`。
  - 新增超长名称测试，断言 81 字符名称返回字段 `name` 和 `request.string_too_long`。

- [x] **Step 2: 跑红灯**
  - Run: `UV_NO_CACHE=1 uv run pytest tests/test_api_commands.py -k "saved_run_view"`
  - Expected: FAIL，当前重复名称没有 `field_errors`，超长名称没有被拦截。

### Task 2: 后端字段错误实现

**Files:**
- Modify: `apps/api/skillhub/api/main.py`
- Modify: `apps/api/skillhub/infrastructure/db/repositories.py`

- [x] **Step 1: 增加 saved view name 类型**
  - 在 API payload 区增加 `SAVED_VIEW_NAME_MAX_LENGTH = 80`。
  - 定义 `SavedViewName = Annotated[str, Field(min_length=1, max_length=SAVED_VIEW_NAME_MAX_LENGTH)]`。
  - `CreateSavedViewPayload.name` 改为 `SavedViewName`。

- [x] **Step 2: 增加中文字段文案**
  - `request_validation_message("name", "string_too_long")` 返回 `保存视图名称最多 80 个字符。`。
  - `request_validation_message("name", "missing" | "string_too_short")` 返回 `填写保存视图名称。`。

- [x] **Step 3: repository 字段错误**
  - trim 后空白抛 `FieldInvariantError("Saved view name is required.", [FieldError("name", "填写保存视图名称。", "saved_view.name_required")])`。
  - 唯一约束冲突抛 `FieldInvariantError("Saved view name already exists.", [FieldError("name", "保存视图名称已存在。", "saved_view.name_conflict")])`。

- [x] **Step 4: 跑 API 绿灯**
  - Run: `UV_NO_CACHE=1 uv run pytest tests/test_api_commands.py -k "saved_run_view"`
  - Expected: PASS。

### Task 3: 前端字段回填

**Files:**
- Modify: `apps/web/components/saved-views/saved-run-views.tsx`
- Modify: `apps/web/components/decision-workbench.tsx`
- Modify: `apps/web/e2e/form-errors.spec.ts`

- [x] **Step 1: 写 E2E 红测**
  - 创建一个 skill，进入历史页，保存名称 `候选版本通过记录`。
  - 再次用同名保存，断言 `.savedRunViews .formErrorSummary` 聚焦并显示 `保存视图名称已存在。`。
  - 断言 `保存视图名称` 输入框有 `aria-invalid="true"`，点击摘要链接后焦点回到该输入框。

- [x] **Step 2: `SavedRunViews` 接入 `ValidatedForm`**
  - `onSave` 类型改为 `() => void | Promise<void>`。
  - 根元素改为 `<ValidatedForm aria-label="保存视图" className="savedRunViews" onValidSubmit={submit}>`。
  - `TextField` 增加 `name="name"` 和 `required`。
  - 保存按钮改为 `type="submit"`，不要因为空值禁用，交给表单错误摘要处理。

- [x] **Step 3: 保留 API field error 给表单**
  - `createSavedRunView` 捕获错误时，如果是带 `fieldErrors` 的 `ApiError`，重新抛出给 `ValidatedForm`。
  - 其他错误继续显示全局 notice。

- [x] **Step 4: 跑目标 E2E 绿灯**
  - Run: `npm run e2e -- form-errors.spec.ts -g "saved run view"`
  - Expected: PASS。

### Task 4: 文档、完整验证、提交

**Files:**
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-ux-friction-audit-2026-05-14.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Modify: `.agent/logs/LOG.md`
- Modify: `.agent/tasks.json`
- Create: `.agent/tasks/TASK-059.json`

- [x] **Step 1: 更新中文文档和任务记录**
  - 写清 saved view name 上限、重复名字段错误和前端回填行为。

- [x] **Step 2: 完整验证**
  - `cd apps/api && UV_NO_CACHE=1 uv run pytest`
  - `cd apps/web && npm run test:unit`
  - `cd apps/web && npm run typecheck`
  - `cd apps/web && npm run build`
  - `cd apps/web && npm audit --omit=dev`
  - `cd apps/web && npm run e2e`
  - `git diff --check`
  - `jq empty .agent/tasks.json .agent/tasks/TASK-059.json`
