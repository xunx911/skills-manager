# Local Login Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把前端自由切换本地 actor 升级为需要本地登录码的 session gate，为后续真实认证铺路。

**Architecture:** 后端在 `/api/session` 增加 `access_code` 校验，成功后继续复用现有 HMAC 签名 HttpOnly cookie。前端 `LocalSessionPanel` 接入共享表单基础件，提交 actor 和 access code，成功后刷新当前 session/capabilities。

**Tech Stack:** FastAPI、pytest、React、Next.js、Playwright。

---

### Task 1: API local login gate

**Files:**
- Modify: `apps/api/skillhub/api/auth.py`
- Modify: `apps/api/skillhub/api/main.py`
- Modify: `apps/api/tests/test_api_commands.py`

- [x] **Step 1: 写 API 红测**
  - 新增 `test_session_actor_requires_local_access_code`。
  - 错误 `access_code` 调 `POST /api/session` 应返回 `403`，并且不设置 `skillhub_actor` cookie。
  - 正确 `access_code = "skillhub-dev"` 应返回 `200`，并设置 cookie。
  - 更新 `test_session_actor_cookie_controls_created_owner`，请求体加入 `access_code`。

- [x] **Step 2: 跑 API 红灯**
  - Run: `cd apps/api && UV_NO_CACHE=1 uv run pytest tests/test_api_commands.py -k "session_actor"`
  - Expected: FAIL，因为当前 endpoint 不要求 access code。

- [x] **Step 3: 实现后端门禁**
  - `SetSessionPayload` 增加 `access_code: str`。
  - `auth.py` 增加 `verify_local_session_access_code(access_code: str)`。
  - 使用 `hmac.compare_digest` 对比 `SKILLHUB_LOCAL_SESSION_CODE`，默认 `skillhub-dev`。
  - 错误时抛 `PermissionDeniedError("Invalid local session access code.")`。

- [x] **Step 4: 跑 API 绿灯**
  - Run: `cd apps/api && UV_NO_CACHE=1 uv run pytest tests/test_api_commands.py -k "session_actor"`
  - Expected: PASS。

### Task 2: Frontend local login form

**Files:**
- Modify: `apps/web/components/session/local-session-panel.tsx`
- Modify: `apps/web/components/decision-workbench.tsx`
- Modify: `apps/web/e2e/accessibility-workbench.spec.ts`
- Modify: `apps/web/e2e/skills-workbench.spec.ts`
- Modify: `apps/web/e2e/visual-workbench.spec.ts`

- [x] **Step 1: 写/更新 E2E 红测**
  - 更新本地 actor 切换相关 E2E，让它们填写 `access_code = "skillhub-dev"`。
  - 新增断言：未填写登录码时，`.localSessionPanel .formErrorSummary` 可见，`input[name="access_code"]` 为 `aria-invalid="true"`。

- [x] **Step 2: 跑 E2E 红灯**
  - Run: `cd apps/web && npm run e2e -- skills-workbench.spec.ts -g "switch local session actor"`
  - Expected: FAIL，因为 UI 还没有 access code 字段。

- [x] **Step 3: 更新 LocalSessionPanel**
  - 使用 `ValidatedForm` 包裹表单。
  - 使用 `TextField` 渲染 actor 和 access code。
  - actor 字段 placeholder 仍为 `release-manager`。
  - access code 字段 `type="password"`，placeholder 为 `skillhub-dev`。
  - 按钮文案改为 `登录 actor`。

- [x] **Step 4: 更新 switchActor payload**
  - `DecisionWorkbench.switchActor` 从表单读取 `access_code`。
  - `POST /api/session` body 传 `{ actor, access_code }`。

- [x] **Step 5: 跑 E2E 绿灯**
  - Run: `cd apps/web && npm run e2e -- skills-workbench.spec.ts -g "switch local session actor|capabilities"`
  - Expected: PASS。

### Task 3: 文档、完整验证、提交

**Files:**
- Modify: `README.md`
- Modify: `docs/api-contract.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Modify: `.agent/logs/LOG.md`
- Modify: `.agent/tasks.json`
- Create: `.agent/tasks/TASK-064.json`

- [x] **Step 1: 更新中文文档和任务记录**
  - 写清本地默认登录码 `skillhub-dev`。
  - 明确这不是最终 OIDC/JWT，只是本地登录门禁。

- [x] **Step 2: 完整验证**
  - `cd apps/api && UV_NO_CACHE=1 uv run pytest`
  - `cd apps/web && npm run test:unit`
  - `cd apps/web && npm run typecheck`
  - `cd apps/web && npm run build`
  - `cd apps/web && npm audit --omit=dev`
  - `cd apps/web && npm run e2e`
  - `git diff --check`
  - `jq empty .agent/tasks.json .agent/tasks/TASK-064.json`
