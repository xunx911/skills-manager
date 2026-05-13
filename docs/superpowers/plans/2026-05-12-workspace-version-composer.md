# Workspace Version Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户在 `变体` 主工作区直接追加标准 Skill bundle 版本，并顺滑进入候选版本测评。

**Architecture:** 新增 `WorkspaceVersionComposer` 组件，渲染主区版本追加表单，并复用 `DecisionWorkbench.createVariantVersion` 的 `FormEvent<HTMLFormElement>` 写入逻辑。旧 inspector 表单保留，以降低改动面。

**Tech Stack:** Next.js client components、现有 FastAPI API、Playwright E2E。

---

### Task 1: 红色 E2E

**Files:**
- Modify: `apps/web/e2e/skills-workbench.spec.ts`

- [x] **Step 1: 新增主区追加版本测试**

新增测试 `operator can append a candidate version from the variants workspace`：导入 skill，进入 `变体`，通过 `.workspaceVersionComposer` 上传文件夹，取消 current，保存后断言 candidate 测评交接。

- [x] **Step 2: 验证红灯**

Run:

```bash
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e -- --grep "append a candidate version from the variants workspace"
```

Expected: FAIL，因为 `.workspaceVersionComposer` 尚不存在。

### Task 2: 主区组件

**Files:**
- Create: `apps/web/components/variants/workspace-version-composer.tsx`
- Modify: `apps/web/components/decision-workbench.tsx`
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: 新建 `WorkspaceVersionComposer`**

组件接收 `busy`、`variants`、`defaultVariantId`、`onCreateVersion`，渲染 variant select、folder file input、zip file input、change summary、make_current checkbox 和 submit button。

- [x] **Step 2: 接入 `VariantsPane`**

给 `VariantsPane` 传入 `busy` 和 `onCreateVersion`，在 toolbar 下方、variant map 上方渲染 composer。

- [x] **Step 3: 样式**

新增 `.workspaceVersionComposer`、`.workspaceVersionComposerGrid`、`.workspaceVersionSummary`，让它成为主工作区的紧凑任务条，而不是又一个笨重表单卡片。

### Task 3: 文档和验证

**Files:**
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Modify: `.agent/logs/LOG.md`
- Modify: `.agent/tasks.json`
- Modify: `.agent/tasks/TASK-015.json`

- [x] **Step 1: 文档**

README 说明可在变体主面板追加候选版本；UX review 记录 Linear/Airtable/Vercel 借鉴；完成度审计更新摩擦项。

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

设置 TASK-015 complete / passes true，提交 `feat: append versions from workspace`。
