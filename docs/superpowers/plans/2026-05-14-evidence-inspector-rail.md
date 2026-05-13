# Evidence Inspector Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让中等桌面宽度下的 diff/history/audit/promotion 证据视图折叠右侧 inspector，把横向空间还给主证据面板。

**Architecture:** `DecisionWorkbench` 根据当前 mode 输出 `data-inspector-layout="full|compact"`。CSS 在 `1041px-1440px` 媒体查询中把 compact mode 的 grid 第三列压成 rail，并隐藏低频 inspector actions，只保留 verification evidence。

**Tech Stack:** Next.js App Router、React client component、TypeScript、CSS media query、Playwright E2E / visual snapshot。

---

### Task 1: 写布局红灯测试

**Files:**
- Create: `apps/web/e2e/responsive-inspector.spec.ts`

- [x] **Step 1: 新增 1280px 布局测试**

测试导入 skill 后，overview inspector 宽度大于 320px；切到 history 后，inspector 宽度不超过 128px，main 宽度大于 850px，并且 action menu 与 local session 不再可见。

- [x] **Step 2: 验证红灯**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/responsive-inspector.spec.ts --project=chromium
```

Expected: FAIL because history inspector width is still about 336px.

### Task 2: 实现 compact rail

**Files:**
- Modify: `apps/web/components/decision-workbench.tsx`
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: 输出 layout 数据属性**

`diff/history/audit/promotion` 输出 `data-inspector-layout="compact"`；其他 mode 输出 `full`。

- [x] **Step 2: 中等桌面 CSS rail**

在 `@media (min-width: 1041px) and (max-width: 1440px)` 中，把 compact workbench 改成 `292px minmax(0, 1fr) 96px`，隐藏 `.localSessionPanel`、`.actionMenu` 和 `.inspectorForm`，压缩 `.inspectorEvidence`。

- [x] **Step 3: 验证绿色**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/responsive-inspector.spec.ts --project=chromium
```

Expected: 1 passed.

### Task 3: 视觉基线和文档

**Files:**
- Modify: `apps/web/e2e/visual-workbench.spec.ts-snapshots/skill-audit-explorer-chromium-darwin.png`
- Modify: `apps/web/e2e/visual-workbench.spec.ts-snapshots/promotion-review-ready-chromium-darwin.png`
- Modify: `apps/web/e2e/visual-workbench.spec.ts-snapshots/run-comparison-ready-chromium-darwin.png`
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Create: `.agent/tasks/TASK-041.json`
- Modify: `.agent/logs/LOG.md`

- [x] **Step 1: 更新证据视图视觉基线**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/visual-workbench.spec.ts --project=chromium -g "skill audit explorer|promotion review|run comparison" --update-snapshots
```

- [x] **Step 2: 查看截图**

确认 promotion/run comparison 右侧只剩 compact verification rail，主证据区不空白、不重叠。

- [x] **Step 3: 完整验证**

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

Expected: all pass.
