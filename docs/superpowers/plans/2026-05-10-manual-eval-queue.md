# 手工测评执行队列 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把测评页的 pass/fail 操作升级成顺手的 review queue，支持状态筛选、自动前进、批量处理未确认和键盘确认。

**Architecture:** 不改后端模型；所有新增能力都是 `EvalRun` 提交前的前端草稿交互。新增一个专职 controls 组件，`DecisionWorkbench` 只保留状态计算、选择和 API 写入。

**Tech Stack:** Next.js App Router、React client components、TypeScript、Playwright E2E、现有 FastAPI/SQLAlchemy 测试栈。

---

### Task 1: 写红测和任务定义

**Files:**
- Modify: `apps/web/e2e/skills-workbench.spec.ts`
- Add: `.agent/tasks/TASK-007.json`
- Modify: `.agent/tasks.json`

- [x] **Step 1: 添加 TASK-007 定义**

新增任务文件，要求覆盖状态筛选、自动前进、批量未确认、键盘确认和全量验证。

- [x] **Step 2: 写 Playwright 红测：队列筛选和批量未确认**

在 `skills-workbench.spec.ts` 新增测试：导入 skill，批量添加三条 case，打开 `未确认` 筛选，点击第一条 `通过` 后断言第二条 case 变为 active；点击 `未确认标为通过` 后记录 run，断言 `已记录 3/3 通过。`。

- [x] **Step 3: 写 Playwright 红测：键盘 pass/fail**

新增测试：批量添加两条 case，选中第一条，按 `p` 和 `f`，记录 run，断言 `已记录 1/2 通过。`。

- [x] **Step 4: 运行红测**

```bash
cd apps/web && npm run e2e -- --grep "manual eval queue"
```

预期：失败，因为筛选、自动前进、批量未确认和键盘确认还不存在。

### Task 2: 实现 review controls 和队列行为

**Files:**
- Add: `apps/web/components/eval-cases/eval-review-controls.tsx`
- Modify: `apps/web/components/decision-workbench.tsx`
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: 新增 `EvalReviewControls`**

组件接收 `filter`、counts、progress、bulk commands 和 record command，渲染 filter chips、progress、`下一条未确认`、`未确认标为通过`、`清空草稿`、`记录本次测评`。

- [x] **Step 2: 接入 `EvalsPane` 状态计算**

在 `EvalsPane` 内新增 `reviewFilter`，计算 `visibleCases`、`pendingCases`、`selectedVisibleIndex`，空列表显示当前筛选下没有 case。

- [x] **Step 3: 实现自动前进**

点击 `通过` / `不通过` 后先写草稿，再选择下一条未确认；如果没有未确认，保持当前选择。

- [x] **Step 4: 实现键盘确认**

在 `EvalsPane` 中监听 `keydown`，忽略 input、textarea、select、contenteditable；支持 `j`、`k`、`ArrowDown`、`ArrowUp`、`p`、`f`。

- [x] **Step 5: 添加样式**

新增 `.evalQueueControls`、`.evalFilterTabs`、`.evalQueueActions`、`.caseReviewCardDone`、`.caseReviewCardPending` 等样式，保持当前工作台的低噪声、密集、可扫读风格。

- [x] **Step 6: 运行局部 E2E**

```bash
cd apps/web && npm run e2e -- --grep "manual eval queue"
```

预期：新增测试通过。

### Task 3: 文档、全量验证、提交推送

**Files:**
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Modify: `.agent/logs/LOG.md`
- Add: `.agent/screenshots/TASK-007-1.png`

- [x] **Step 1: 更新文档**

README 补充测评页 review queue 的试用路径；UX 评审记录 TestRail/Airtable 借鉴；完成度审计补上 TASK-007 证据和剩余缺口。

- [x] **Step 2: 截图验证**

启动本地服务，截取 `/skills` 测评页，保存到 `.agent/screenshots/TASK-007-1.png` 并人工查看截图不空白、不重叠。

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
git commit -m "feat: streamline manual eval queue"
git push
```

## 自检

- 不把临时草稿落库，避免污染不可变 eval run 事实。
- 批量操作只作用于未确认项，不覆盖已标记的不通过。
- 键盘快捷键不在输入框中触发。
- 保持 result 状态只有通过/不通过。
