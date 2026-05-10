# Project Build Log

`Current Status`
=================
**Last Updated:** YYYY-MM-DD HH:MM
**Tasks Completed:** TOTAL_NUMBER_OF_TASKS
**Current Task:** TASK-CURRENT_TASK_NUMBER Complete

----------------------------------------------

## Session Log

### 2026-05-10 16:30 CST - TASK-008 候选版本验证交接

- 追加 `make_current=false` 的候选版本后，工作台自动切到 `测评`，并选中新建 candidate 作为 exact 测评目标。
- 切换测评目标会清空本地 pass/fail 草稿，避免把 current run 的判断误带到 candidate。
- 新增 candidate verification banner，可从测评页直接进入 `设为当前版本评审`。
- 验证：`uv run pytest` 71 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 22 passed。
- 截图：`.agent/screenshots/TASK-008-1.png`。

### 2026-05-10 16:11 CST - TASK-007 手工测评执行队列

- 将测评页 pass/fail 区升级为 review queue，支持全部/未确认/通过/不通过筛选、点击结果后自动前进、未确认批量标为通过、清空草稿和键盘 `p/f/j/k`。
- 新增 `EvalReviewControls`，把进度、筛选和批量动作从巨型工作台组件中抽出，降低 UI 腐化。
- 更新手工测评视觉基线，修复 controls 三列布局在三栏工作台中横向裁切的问题。
- 验证：`uv run pytest` 71 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 21 passed。
- 截图：`.agent/screenshots/TASK-007-1.png`。

### 2026-05-10 15:55 CST - TASK-006 快速添加测试用例

- 在测评页新增单条/批量快速添加 case 面板，批量粘贴支持 `title | input | expected output | notes` 和 tab 分隔。
- 新增 `POST /api/eval-cases/batch`，一次批量写入只生成一个新的 `EvalSetVersion`，并保持 case version 快照语义。
- 新增 Playwright 覆盖：批量粘贴两条 case 后立即手工确认通过/不通过并记录 `EvalRun`。
- 验证：`uv run pytest` 71 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 19 passed；`git diff --check` passed。
- 截图：`.agent/screenshots/TASK-006-1.png`。
