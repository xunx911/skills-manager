# Promotion decision note 字段级校验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development for behavior changes and superpowers:verification-before-completion before claiming completion. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 risky promotion 的 decision note 增加字段级必填/长度校验，并在 Promotion review 表单中显示可回焦错误。

**Architecture:** 后端用 Pydantic `Field(max_length=1000)` 保护 `decision_note`，repository 对 risky 空说明返回 `FieldInvariantError`。前端把 `PromotionReviewPane` 的 decision form 接入 `ValidatedForm` 和共享 `TextAreaField`，并让 `promoteFromReview` 把 API field errors 重新抛给表单。

**Tech Stack:** FastAPI、Pydantic v2、pytest、React、Next.js、Playwright。

---

### Task 1: API 红绿测试

**Files:**
- Modify: `apps/api/tests/test_api_commands.py`

- [x] **Step 1: 写失败测试**
  - 在 promotion command 测试附近新增 risky promotion 测试。
  - 先提交空白 `decision_note`，期望 `400`，`field_errors[0].field == "decision_note"`，code 为 `promotion.decision_note_required`。
  - 再提交 1001 字符 `decision_note`，期望 `422`，code 为 `request.string_too_long`。

- [x] **Step 2: 跑红灯**
  - Run: `cd apps/api && UV_NO_CACHE=1 uv run pytest tests/test_api_commands.py -k "promotion_decision_note"`
  - Expected: FAIL，当前 API 对空白说明返回普通 invariant，对超长说明没有字段级保护。

### Task 2: 后端字段规则

**Files:**
- Modify: `apps/api/skillhub/api/main.py`
- Modify: `apps/api/skillhub/infrastructure/db/repositories.py`

- [x] **Step 1: 增加 decision note 类型**
  - `PROMOTION_DECISION_NOTE_MAX_LENGTH = 1000`。
  - `PromotionDecisionNote = Annotated[str | None, Field(max_length=PROMOTION_DECISION_NOTE_MAX_LENGTH)]`。
  - `PromoteVariantVersionPayload.decision_note` 改为 `PromotionDecisionNote = None`。

- [x] **Step 2: 增加中文错误文案**
  - `request_validation_message("decision_note", "string_too_long")` 返回 `设为当前版本说明最多 1000 个字符。`。
  - `API_FIELD_LABELS["decision_note"] = "设为当前版本说明"`。

- [x] **Step 3: risky 空说明返回 FieldInvariantError**
  - 把 repository 中 `Promotion decision note is required when review has risk.` 改成 `FieldInvariantError`。
  - 字段错误 payload 为 `decision_note / 填写设为当前版本说明。 / promotion.decision_note_required`。

- [x] **Step 4: 跑 API 绿灯**
  - Run: `cd apps/api && UV_NO_CACHE=1 uv run pytest tests/test_api_commands.py -k "promotion_decision_note"`
  - Expected: PASS。

### Task 3: 前端字段回填

**Files:**
- Modify: `apps/web/components/promotion-review/promotion-review-pane.tsx`
- Modify: `apps/web/components/decision-workbench.tsx`
- Modify: `apps/web/e2e/skills-workbench.spec.ts`

- [x] **Step 1: 写 E2E 红测**
  - 更新 risky promotion E2E：空 note 时按钮可点，点击后 `.promotionDecisionBar .formErrorSummary` 聚焦并显示 `填写设为当前版本说明。`。
  - 填入 1001 字符后再次提交，断言显示 `设为当前版本说明最多 1000 个字符。`。
  - 填入有效说明后 promotion 成功，v2 显示 `Current`。

- [x] **Step 2: PromotionReviewPane 接入 ValidatedForm**
  - 导入 `ValidatedForm` 和 `TextAreaField`。
  - `onPromote` 类型改为 `() => void | Promise<void>`。
  - `<form className="promotionDecisionBar">` 改为 `<ValidatedForm className="promotionDecisionBar">`。
  - plain `<textarea>` 改为 `<TextAreaField aria-label="设为当前版本说明" label="设为当前版本说明" name="decision_note" ... />`。
  - risky 状态设置 `required` 和 `data-required-message="填写设为当前版本说明。"`，复用 `ValidatedForm` 的 required 收集器。
  - `canPromote` 只判断 busy、candidate run 和 readiness，不再因为 risky 空说明禁用按钮。

- [x] **Step 3: rethrow API field errors**
  - `promoteFromReview` 调用 `runCommand(..., { rethrowFieldErrors: true })`。

- [x] **Step 4: 跑目标 E2E 绿灯**
  - Run: `cd apps/web && npm run e2e -- skills-workbench.spec.ts -g "risky promotion"`
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
- Create: `.agent/tasks/TASK-061.json`

- [x] **Step 1: 更新中文文档和任务记录**
  - 写清 promotion decision note 必填、上限和字段错误行为。

- [x] **Step 2: 完整验证**
  - `cd apps/api && UV_NO_CACHE=1 uv run pytest`
  - `cd apps/web && npm run test:unit`
  - `cd apps/web && npm run typecheck`
  - `cd apps/web && npm run build`
  - `cd apps/web && npm audit --omit=dev`
  - `cd apps/web && npm run e2e`
  - `git diff --check`
  - `jq empty .agent/tasks.json .agent/tasks/TASK-061.json`
