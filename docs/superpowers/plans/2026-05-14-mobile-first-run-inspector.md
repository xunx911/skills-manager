# Mobile First-Run Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移动端 first-run 默认只展示主区 `SkillLaunchpad`，避免 inspector 在页面下方重复展示完整导入表单，同时保留显式 action 的焦点交接。

**Architecture:** 用现有 React state 生成两个数据属性：是否 first-run、是否由用户请求过 inspector action。CSS 只在窄屏 first-run 初始态折叠 inspector action 区，不改后端、不引入 drawer 状态。

**Tech Stack:** Next.js App Router、React client component、TypeScript、CSS media query、Playwright E2E / visual snapshot。

---

### Task 1: 写移动端红灯测试

**Files:**
- Create: `apps/web/e2e/mobile-first-run.spec.ts`
- Modify: `apps/web/e2e/helpers.ts`
- Modify: `apps/web/e2e/skills-workbench.spec.ts`
- Modify: `apps/web/e2e/visual-workbench.spec.ts`

- [x] **Step 1: 抽取清理 helper**

把已有 skill catalog 清理逻辑移动到 `clearSkillCatalog(request)`，让 mobile spec、skills spec 和 visual spec 共用。

- [x] **Step 2: 新增失败测试**

测试在 `390 x 844` 视口打开 `/skills`，断言 `SkillLaunchpad` 可见、inspector `.inspectorForm` 初始隐藏；再点击 catalog `导入`，断言 inspector `导入标准 Skill` 可见且 `owner_ref` 获得焦点。

- [x] **Step 3: 验证红灯**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/mobile-first-run.spec.ts --project=chromium
```

Expected: FAIL because inspector `.inspectorForm` is visible.

### Task 2: 实现窄屏 first-run 折叠

**Files:**
- Modify: `apps/web/components/decision-workbench.tsx`
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: 增加状态标记**

`linearWorkbench` 增加 `data-first-run`，`linearInspector` 增加 `data-action-requested`。已有 `chooseAction` 会递增 `inspectorFocusRequest`，因此可复用它表示用户显式请求过 action。

- [x] **Step 2: 增加窄屏 CSS**

在 `@media (max-width: 900px)` 中，仅当 `data-first-run="true"` 且 `data-action-requested="false"` 时隐藏 `.actionMenu` 和 `.inspectorForm`。

- [x] **Step 3: 验证绿色**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/mobile-first-run.spec.ts --project=chromium
```

Expected: 1 passed.

### Task 3: 视觉基线、文档、全量验证

**Files:**
- Modify: `apps/web/e2e/visual-workbench.spec.ts-snapshots/mobile-empty-workbench-chromium-darwin.png`
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Modify: `.agent/tasks.json`
- Create: `.agent/tasks/TASK-040.json`
- Modify: `.agent/logs/LOG.md`

- [x] **Step 1: 更新移动端视觉基线**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/visual-workbench.spec.ts --project=chromium -g "mobile empty workbench" --update-snapshots
```

- [x] **Step 2: 人工查看截图**

确认 mobile empty snapshot 中主区 Launchpad 清晰可见，inspector 不再出现重复导入表单。

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
