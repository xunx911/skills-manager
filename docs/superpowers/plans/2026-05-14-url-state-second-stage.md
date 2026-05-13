# URL State 第二阶段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `/skills` URL 能还原真实证据上下文，包括 diff pair、history filters/comparison、eval target/case 和 promotion review。

**Architecture:** 新增纯 URL state 工具集中处理 query parse/serialize；`DecisionWorkbench` 只把业务状态传入工具，并在 mount/popstate 时应用解析结果。Diff 和 Promotion 的加载统一改为 state-driven effects，避免按钮、URL hydrate 和 Back/Forward 各自重复 fetch 逻辑。

**Tech Stack:** Next.js App Router、React hooks、TypeScript、URLSearchParams、History API、Playwright E2E。

---

### Task 1: 写 URL state 第二阶段红灯 E2E

**Files:**
- Modify: `apps/web/e2e/url-state.spec.ts`

- [x] **Step 1: 增加 diff deep link 测试**

追加测试：导入 skill、追加第二个 bundle version、打开 diff，切到 `新增` filter 并选择 `new-checklist.md`。断言 URL 包含 `mode=diff`、`diff_left`、`diff_right`、`diff_filter=added`、`diff_file=new-checklist.md`；刷新后仍显示同一 filter 和文件。

- [x] **Step 2: 增加 history deep link 测试**

追加测试：记录 current run，追加 candidate version，记录 candidate run。进入 history 后选择 status filter、baseline、candidate 和 matrix impact；断言 URL 包含 `mode=history`、`run_status=finished`、`run`、`compare_base`、`compare_candidate`、`matrix_impact=fixed`。刷新后 run comparison 和 matrix impact 恢复。

- [x] **Step 3: 增加 evals deep link 测试**

追加测试：创建两个 case，追加 candidate version，选择 candidate eval target 和第二个 case；断言 URL 包含 `mode=evals`、`eval_target`、`case`。刷新后目标版本和 case 选择恢复。

- [x] **Step 4: 增加 promotion permalink 测试**

复用 candidate promotion path；进入 promotion review 后断言 URL 包含 `mode=promotion`、`promotion_variant`、`promotion_candidate`、`promotion_eval_set`。刷新后仍显示同一 promotion review。

- [x] **Step 5: 运行红灯**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/url-state.spec.ts --project=chromium
```

Expected: FAIL because second-stage query params are not written or restored.

### Task 2: 新增 URL state 纯工具

**Files:**
- Create: `apps/web/lib/workbench-url-state.ts`
- Create: `apps/web/components/url-state/use-workbench-url-state.ts`
- Modify: `apps/web/app/skills/page.tsx`

- [x] **Step 1: 创建类型和默认值**

在新文件定义 `SHAREABLE_MODES`、`DEFAULT_RUN_FILTERS`、`DEFAULT_RUN_MATRIX_CONTROLS`、`DEFAULT_AUDIT_FILTERS`、`parseWorkbenchUrlState` 和 `workbenchUrlForState`。

- [x] **Step 2: 实现 parse**

`parseWorkbenchUrlState(search)` 必须过滤非法 enum：mode 非法回 `overview`，`diff_filter` 非法回 `all`，matrix enum 非法回默认值。

- [x] **Step 3: 实现 serialize**

`workbenchUrlForState` 从 `{ pathname, hash, state }` 生成 URL。只保留当前 mode 相关参数，默认值不写入 URL，`skill` 永远优先使用 slug。

- [x] **Step 4: 复用到 server page**

`apps/web/app/skills/page.tsx` 改用 `parseWorkbenchUrlState` 的 `skill/mode`，并让 `promotion` 成为合法 shareable mode。

### Task 3: 接入 DecisionWorkbench 深层 hydrate/sync

**Files:**
- Modify: `apps/web/components/decision-workbench.tsx`
- Modify: `apps/web/components/url-state/use-workbench-url-state.ts`

- [x] **Step 1: 引入 URL state 工具**

删除组件内重复的 `SHAREABLE_MODES`、`DEFAULT_RUN_FILTERS`、`DEFAULT_RUN_MATRIX_CONTROLS`、`DEFAULT_AUDIT_FILTERS`、`parseShareableMode` 和 `workbenchUrlForState`，从 `@/lib/workbench-url-state` 引入；URL hydrate/sync/popstate 副作用放进 `useWorkbenchUrlStateSync` hook，避免继续膨胀主工作台组件。

- [x] **Step 2: 增加 hydrate gate**

新增 `hasHydratedUrlState` state。初始 mount 和 `popstate` 使用同一个 `applyUrlStateFromLocation`，先设置 deep state，再允许 URL sync effect 运行。

- [x] **Step 3: 同步 URL**

URL sync effect 依赖 skill、mode、diff、evals、history、matrix、promotion、audit 状态；调用 `workbenchUrlForState`。第一次 hydrate 后用 `replaceState`，后续交互用 `pushState`。

- [x] **Step 4: 只清理当前 skill 的内存状态**

`selectedSkillId` 改变时仍清空 diff/history/promotion 等状态，但不能覆盖随后 hydrate 进来的深层 query；hydrate effect 必须排在 skill reset effect 之后。

### Task 4: 统一 Diff 和 Promotion 加载

**Files:**
- Modify: `apps/web/components/decision-workbench.tsx`

- [x] **Step 1: Diff pair state-driven load**

新增 effect：当 `mode === "diff"` 且 `diffLeftVersionId/diffRightVersionId` 有效时加载 bundle diff。`openDiffMode` 和 `updateDiffPair` 只设置 state，不直接 fetch。

- [x] **Step 2: Direct diff mode 默认 pair**

当 URL 只有 `mode=diff` 但没有 pair 时，根据当前 default variant 自动设置默认 pair。

- [x] **Step 3: Promotion target state**

新增 `promotionTarget` state：`{ variantId, candidateVersionId, evalSetVersionId } | null`。`openPromotionReview` 只设置 target 和 mode。

- [x] **Step 4: Promotion target effect**

当 `mode === "promotion"` 且 target 存在时加载 `GET /api/variants/{variant_id}/promotion-review`。URL hydrate、button click、candidate banner 都复用这条路径。

### Task 5: 文档、任务记录和完整验证

**Files:**
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-ux-friction-audit-2026-05-14.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Create: `.agent/tasks/TASK-047.json`
- Modify: `.agent/tasks.json`
- Modify: `.agent/logs/LOG.md`

- [x] **Step 1: 更新产品文档**

记录 URL state 第二阶段已支持 diff/history/evals/promotion 深链，仍不把本地草稿和 viewed progress 写入 URL。

- [x] **Step 2: 完整验证**

Run:

```bash
cd apps/web && npm run test:unit
cd apps/web && npm run typecheck
cd apps/web && npm run build
cd apps/web && npm audit --omit=dev
cd apps/api && uv run pytest
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e
git diff --check
jq empty .agent/tasks.json .agent/tasks/TASK-047.json
```

Expected: all pass.
