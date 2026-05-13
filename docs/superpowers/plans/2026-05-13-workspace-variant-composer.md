# Workspace Variant Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户在 `变体` 主工作区直接创建新的 tags 约束 variant，并立刻在 variant map 中看到结果。

**Architecture:** 新增 `VariantCreationComposer` 组件，复用 `DecisionWorkbench.createVariant` 的表单提交逻辑。主区 composer 通过 `copy_current` 字段请求从 default variant 的 current version 复制内容引用；旧 inspector 表单保留并继续使用原路径。

**Tech Stack:** Next.js client components、现有 FastAPI API、Playwright E2E。

---

### Task 1: 红色 E2E

**Files:**
- Modify: `apps/web/e2e/skills-workbench.spec.ts`

- [x] **Step 1: 新增主区创建 variant 测试**

新增测试 `operator can create a variant from the variants workspace`，导入 skill 后进入 `变体`，通过 `.variantCreationComposer` 填写 label、tags、summary、change summary，提交后断言 variant map 出现新卡片和 `v1`。

- [x] **Step 2: 验证红灯**

Run:

```bash
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e -- --grep "create a variant from the variants workspace"
```

Expected: FAIL，因为 `.variantCreationComposer` 尚不存在。

### Task 2: 主区组件和数据流

**Files:**
- Create: `apps/web/components/variants/variant-creation-composer.tsx`
- Modify: `apps/web/components/decision-workbench.tsx`
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: 新建 `VariantCreationComposer`**

组件接收 `busy`、`hasBaseVersion`、`onCreateVariant`，默认渲染主区动作条；点击后原地展开 label、tags、summary、change summary、copy_current、make_default 和 submit button。

- [x] **Step 2: 接入 `VariantsPane`**

给 `VariantsPane` 传入 `onCreateVariant` 和 `hasBaseVersion`，在 `WorkspaceVersionComposer` 上方渲染新 composer。

- [x] **Step 3: 调整 `createVariant`**

当表单包含 `copy_current=on` 且 default variant 有 current version 时，使用 default current version 的 `content_ref` 创建新 variant 的 v1；否则保持现有 inline content_ref 回退。

- [x] **Step 4: 样式**

新增 `.variantCreationComposer` 系列样式，使用与 version composer 相邻但不混淆的浅绿色基线提示，避免主区看起来像堆叠普通表单。

### Task 3: 文档和验证

**Files:**
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Modify: `.agent/logs/LOG.md`
- Modify: `.agent/tasks.json`
- Modify: `.agent/tasks/TASK-016.json`

- [x] **Step 1: 文档**

README 说明可在变体主面板创建约束 variant；UX review 记录 Linear/Figma/Airtable 借鉴；完成度审计更新已完成项和剩余摩擦。

- [x] **Step 2: 验证**

Run:

```bash
cd apps/api && uv run pytest
cd apps/web && npm run typecheck
cd apps/web && npm run build
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e
git diff --check
```

Expected: 全部通过。

- [x] **Step 3: 提交**

设置 TASK-016 complete / passes true，提交 `feat: create variants from workspace`。
