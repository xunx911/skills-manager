# URL State Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `/skills` 的 selected skill 和 mode 可以通过 URL 分享、刷新恢复，并随用户操作同步。

**Architecture:** 服务端 page 从 query 中选择初始 skill/mode，客户端 workbench 在 state 变化时用 History API 更新 URL，并监听 `popstate` 恢复第一阶段状态。只同步 `skill` 和 `mode`，不处理深层筛选。

**Tech Stack:** Next.js App Router、React client component、History API、Playwright E2E。

---

### Task 1: 写 URL 红灯测试

**Files:**
- Create: `apps/web/e2e/url-state.spec.ts`

- [x] **Step 1: 直接 URL 打开测试**

创建两个 skill：`url-alpha-*` 和 `url-beta-*`。打开 `/skills?skill=<beta>&mode=history`，断言页面显示 beta heading、`历史` tab selected，并且 reload 后仍保持。

- [x] **Step 2: 用户操作同步 URL 测试**

导入一个 skill，点击 `历史` tab，断言 URL 包含 `skill=<slug>` 和 `mode=history`；再点击 `概览`，断言 URL 保留 `skill` 且不再包含 `mode=history`；浏览器 Back 后恢复 `历史` tab。

- [x] **Step 3: 验证红灯**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/url-state.spec.ts --project=chromium
```

Expected: FAIL because `/skills` ignores URL state and user actions do not update query params.

### Task 2: 实现第一阶段 URL state

**Files:**
- Modify: `apps/web/app/skills/page.tsx`
- Modify: `apps/web/components/decision-workbench.tsx`

- [x] **Step 1: 服务端读取初始 query**

`SkillsPage` 读取 `searchParams.skill` 和 `searchParams.mode`；按 skill id 或 slug 匹配初始 skill；只接受第一阶段 shareable mode。

- [x] **Step 2: 客户端同步 URL**

`DecisionWorkbench` 增加 `initialSkillId`、`initialMode` props；selected skill 和 mode 变化时通过 History API 更新 `skill` 和 `mode` query。

- [x] **Step 3: 支持 Back/Forward**

监听 `popstate`，按当前 URL 恢复 selected skill 和 mode。

- [x] **Step 4: 验证绿色**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/url-state.spec.ts --project=chromium
```

Expected: 2 passed，并覆盖直达、刷新、URL 同步和 Back/Forward 恢复。

### Task 3: 文档和完整验证

**Files:**
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Create: `.agent/tasks/TASK-042.json`
- Modify: `.agent/logs/LOG.md`

- [x] **Step 1: 更新文档**

记录 URL state 第一阶段已支持 selected skill 和 mode，明确后续仍需 diff pair/history filters/selected run/case/promotion context。

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
```

Actual: all pass. Web unit 1 file / 3 tests passed；typecheck passed；build passed；audit 0 vulnerabilities；API pytest 90 passed；Playwright E2E 54 passed；`git diff --check` passed。
