# 候选版本验证交接 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让追加 candidate `VariantVersion` 后自动进入候选版本测评上下文，并能从测评页直接进入 promotion review。

**Architecture:** 不改后端 schema/API；复用 `POST /api/variant-versions` 返回的 `variant_version_id`，在前端设置测评目标版本、清空草稿、切换到 `测评`。新增一个只展示 candidate 上下文的 banner 组件，避免继续膨胀 `DecisionWorkbench` 的 JSX。

**Tech Stack:** Next.js App Router、React client components、TypeScript、Playwright E2E、现有 FastAPI/SQLAlchemy 后端。

---

### Task 1: 红测和任务定义

**Files:**
- Add: `.agent/tasks/TASK-008.json`
- Modify: `.agent/tasks.json`
- Modify: `apps/web/e2e/skills-workbench.spec.ts`

- [x] **Step 1: 添加 TASK-008 定义**

任务要求覆盖 candidate 创建后的自动测评交接、banner、promotion review 入口和草稿清空。

- [x] **Step 2: 写 Playwright 红测**

新增测试 `candidate version handoff selects the new version for verification`：

1. 导入 skill。
2. 添加一个 case，并给 current 记录 `不通过`。
3. 追加版本，取消 `make_current`。
4. 断言页面自动在 `测评` tab，`测评目标版本` 选择了 `v2 · candidate`。
5. 断言 `进入设为当前版本评审` banner 可见。
6. 断言记录按钮禁用，证明 current 的旧草稿没有被复用。
7. 标记 candidate case 通过并记录 run。
8. 点击 banner 的 `进入设为当前版本评审`，断言 promotion readiness 可见。

- [x] **Step 3: 运行红测**

```bash
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e -- --grep "candidate version handoff"
```

预期：失败，因为追加 candidate 后不会自动切换测评上下文，也没有 banner。

### Task 2: 实现候选测评交接

**Files:**
- Add: `apps/web/components/eval-cases/candidate-verification-banner.tsx`
- Modify: `apps/web/components/decision-workbench.tsx`
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: 新增 CandidateVerificationBanner**

组件显示 candidate label、版本号、change summary，以及 `进入设为当前版本评审` 按钮。

- [x] **Step 2: 统一测评目标切换**

在 `DecisionWorkbench` 增加 `selectEvalTargetVersion(versionId: string)`，内部执行：

```ts
setEvalTargetVersionId(versionId);
setCaseResults(Object.fromEntries(cases.map((item) => [item.case_version.id, null])));
setActionMode("run");
```

- [x] **Step 3: 修改 createVariantVersion**

读取 `apiSend<{ variant_version_id: string; version_number: number }>` 返回值。若 `make_current=false`，调用 `selectEvalTargetVersion(result.variant_version_id)`，`setMode("evals")`，返回提示 `Variant 版本已创建。已切到候选 vN 测评。`。

- [x] **Step 4: 在 EvalsPane 渲染 banner**

根据 `evalTargetVersionId` 从 `evalTargetVersions` 找到 target option；当 `!targetOption.isCurrent` 时渲染 `CandidateVerificationBanner`。

- [x] **Step 5: 添加样式**

新增 `.candidateVerificationBanner` 等样式，保持低噪声、信息密集，不做营销式大卡。

- [x] **Step 6: 运行局部 E2E**

```bash
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e -- --grep "candidate version handoff"
```

预期：通过。

### Task 3: 文档、全量验证、提交推送

**Files:**
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Modify: `.agent/logs/LOG.md`
- Add: `.agent/screenshots/TASK-008-1.png`

- [x] **Step 1: 更新文档**

README 增加 candidate version handoff 的试用路径；UX 评审记录 Vercel/Netlify 借鉴；完成度审计补上 TASK-008 证据。

- [x] **Step 2: 截图验证**

保存候选测评 banner 或更新受影响视觉快照，人工查看不空白、不重叠。

- [x] **Step 3: 全量验证**

```bash
cd apps/api && uv run pytest
cd apps/web && npm run typecheck
cd apps/web && npm run build
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e
git diff --check
```

- [x] **Step 4: 提交推送**

```bash
git add .
git commit -m "feat: guide candidate version verification"
git push
```

## 自检

- 不把 candidate verification 做成新后端状态。
- 不改变 `EvalRun` exact binding。
- 不复用跨版本本地草稿。
- 不影响 current 版本追加的原有行为。
