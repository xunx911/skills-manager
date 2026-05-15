# Accepted verification note 字段级校验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for behavior changes and superpowers:verification-before-completion before claiming completion. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 accepted verification note 增加服务端长度上限，并在 run comparison 表单中显示字段级错误。

**Architecture:** 后端用 Pydantic `Field(max_length=1000)` 保护 `note`。前端把 `RunComparisonPanel` 的 accept form 接入 `ValidatedForm` 和共享 `TextField`，并让 `acceptComparisonCandidate` 把 API field errors 重新抛给表单。

**Tech Stack:** FastAPI、Pydantic v2、pytest、React、Next.js、Playwright。

---

### Task 1: API 红绿测试

**Files:**
- Modify: `apps/api/tests/test_api_commands.py`

- [x] **Step 1: 写失败测试**
  - 在 accepted verification 测试附近新增 1001 字符 note 断言。
  - 期望 `422`，`field_errors[0].field == "note"`，code 为 `request.string_too_long`。

- [x] **Step 2: 跑红灯**
  - Run: `UV_NO_CACHE=1 uv run pytest tests/test_api_commands.py -k "accepted_verification"`
  - Expected: FAIL，当前 API 接受超长 note。

### Task 2: 后端长度规则

**Files:**
- Modify: `apps/api/skillhub/api/main.py`

- [x] **Step 1: 增加 note 类型**
  - `ACCEPTED_VERIFICATION_NOTE_MAX_LENGTH = 1000`。
  - `AcceptedVerificationNote = Annotated[str, Field(max_length=ACCEPTED_VERIFICATION_NOTE_MAX_LENGTH)]`。
  - `AcceptEvalRunVerificationPayload.note` 改为 `AcceptedVerificationNote = ""`。

- [x] **Step 2: 增加中文错误文案**
  - `request_validation_message("note", "string_too_long")` 返回 `验证说明最多 1000 个字符。`。

- [x] **Step 3: 跑 API 绿灯**
  - Run: `UV_NO_CACHE=1 uv run pytest tests/test_api_commands.py -k "accepted_verification"`
  - Expected: PASS。

### Task 3: 前端字段回填

**Files:**
- Modify: `apps/web/components/run-comparison/run-comparison-panel.tsx`
- Modify: `apps/web/components/decision-workbench.tsx`
- Modify: `apps/web/e2e/form-errors.spec.ts`

- [x] **Step 1: 写 E2E 红测**
  - 导入 skill，添加 case，记录一次失败 run 和一次通过 run。
  - 在历史页选择 baseline/candidate，填入 1001 字符 `Accepted verification note`。
  - 点击 `接受为验证依据`，断言 `.runCompareAcceptBar .formErrorSummary` 聚焦并显示 `验证说明最多 1000 个字符。`。
  - 断言输入框 `aria-invalid="true"`，点击摘要链接后焦点回到输入框。

- [x] **Step 2: RunComparisonPanel 接入 ValidatedForm**
  - 导入 `ValidatedForm` 和 `TextField`。
  - `onAccept` 类型改为 `() => void | Promise<void>`。
  - `<form className="runCompareAcceptBar">` 改为 `<ValidatedForm className="runCompareAcceptBar">`。
  - plain `<input>` 改为 `<TextField aria-label="Accepted verification note" label="Verification note" name="note" ... />`。

- [x] **Step 3: rethrow API field errors**
  - `acceptComparisonCandidate` 调用 `runCommand(..., { rethrowFieldErrors: true })`。

- [x] **Step 4: 跑目标 E2E 绿灯**
  - Run: `npm run e2e -- form-errors.spec.ts -g "accepted verification note"`
  - Expected: PASS。

### Task 4: 文档、完整验证、提交

**Files:**
- Modify: `README.md`
- Modify: `docs/api-contract.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-ux-friction-audit-2026-05-14.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Modify: `.agent/logs/LOG.md`
- Modify: `.agent/tasks.json`
- Create: `.agent/tasks/TASK-060.json`

- [x] **Step 1: 更新中文文档和任务记录**
  - 写清 accepted verification note 上限和字段错误行为。

- [x] **Step 2: 完整验证**
  - `cd apps/api && UV_NO_CACHE=1 uv run pytest`
  - `cd apps/web && npm run test:unit`
  - `cd apps/web && npm run typecheck`
  - `cd apps/web && npm run build`
  - `cd apps/web && npm audit --omit=dev`
  - `cd apps/web && npm run e2e`
  - `git diff --check`
  - `jq empty .agent/tasks.json .agent/tasks/TASK-060.json`
