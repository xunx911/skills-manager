# Project Build Log

`Current Status`
=================
**Last Updated:** YYYY-MM-DD HH:MM
**Tasks Completed:** TOTAL_NUMBER_OF_TASKS
**Current Task:** TASK-CURRENT_TASK_NUMBER Complete

----------------------------------------------

## Session Log

### 2026-05-13 19:31 CST - TASK-016 主工作区创建 Variant

- 在 `变体` 主工作区新增 `VariantCreationComposer`，可直接填写 label、tags、summary、change summary，并选择是否设为 default。
- 主区创建 variant 默认从当前 default variant 的 current version 复制内容引用，让新 variant 的 v1 有真实基线；右侧 inspector 创建路径保留。
- 新增 E2E 覆盖主工作区创建 variant，并新增 `variants-workspace-composers` 视觉基线。
- 已验证：`uv run pytest` 80 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 30 passed；`git diff --check` passed。
- 截图：`.agent/screenshots/TASK-016-1.png`。

### 2026-05-12 21:45 CST - TASK-015 主工作区追加 VariantVersion

- 在 `变体` 主工作区新增 `WorkspaceVersionComposer`，可直接选择 variant、上传标准 Skill 文件夹或 zip、填写 change summary，并选择是否直接设为 current。
- 复用现有 `POST /api/variant-versions` 和 candidate verification handoff；默认追加为候选版本，保存后自动进入 exact 测评目标。
- 收窄旧 E2E helper 的 inspector 定位器，避免主工作区 composer 与右侧 inspector 的文件输入冲突。
- 已验证：`uv run pytest` 80 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 28 passed；`git diff --check` passed。
- 截图：`.agent/screenshots/TASK-015-1.png`。

### 2026-05-10 20:55 CST - TASK-014 测评 case 详情内联编辑

- 新增 `EvalCaseDetailPanel`，在手工测评详情面板中直接查看并编辑当前 case 的 title、input、expected output 和 notes。
- 编辑保存复用现有 `PATCH /api/eval-cases/{case_id}`，继续生成新的 case version 和 EvalSetVersion，旧 inspector 编辑入口保持可用。
- 新增 E2E 覆盖不经过 inspector 的 inline edit 路径，并更新手工测评视觉基线。
- 已验证：`uv run pytest` 80 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 27 passed。

### 2026-05-10 20:10 CST - TASK-013 Run matrix 逐 case 影响态

- 在 History mode 的 Run matrix 中接入现有 `对照` / `候选` run 选择。
- 矩阵每个 case 行新增 impact chip，显示 `修复`、`回退`、`稳定通过`、`仍未通过`、`缺失` 或等待选择状态。
- 新增 E2E 覆盖候选 run 相对对照 run 的 `修复` 和 `稳定通过`。
- 已验证：`uv run pytest` 80 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 26 passed。

### 2026-05-10 19:45 CST - TASK-012 测评历史保存视图

- 新增 `saved_views` 持久化模型和 `GET /api/skills/{skill_id}/saved-views`、`POST /api/saved-views`、`DELETE /api/saved-views/{id}`。
- 在 History mode 增加保存视图控件，可保存当前 run filters、应用保存视图并同步刷新 run list 和 run matrix、删除不再需要的视图。
- 新增 repository/API/E2E 覆盖保存视图 round trip；文档已补充 README、产品审计和 UX 复盘。
- 已验证：`uv run pytest` 80 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 26 passed；视觉基线已更新。

### 2026-05-10 19:20 CST - TASK-011 测评结果矩阵视图

- 新增 `GET /api/skills/{skill_id}/eval-run-matrix`，复用 history filters 返回 case x run 矩阵 read model。
- 在 History mode 增加 `Run matrix`，显示当前筛选下每个 case 在每个 eval run 中的通过、不通过或未覆盖状态。
- 已新增 repository/API/E2E 覆盖，并更新 run comparison 视觉基线。
- 已验证：`uv run pytest` 77 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 25 passed；`git diff --check` passed。

### 2026-05-10 18:55 CST - TASK-010 Case 历史版本恢复

- 已新增 `POST /api/eval-cases/{case_id}/restores`，恢复旧 `EvalCaseVersion` 时创建新的当前版本，不覆盖历史。
- 已把 case history 面板抽到独立组件，并给非当前版本加 `恢复此版本`。
- 修复恢复后通用刷新链路会清空 case history 的状态问题，eval set 刷新时只在当前 case 不再属于 snapshot 时关闭历史面板。
- 已验证：`uv run pytest` 75 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 24 passed；`git diff --check` passed。

### 2026-05-10 16:48 CST - TASK-009 导入后验证引导

- 在概览页新增 `验证清单`，把导入 bundle 后的下一步组织为补 case、记录首轮测评、查看证据历史。
- 单条 case 创建成功后自动切到 `测评` tab 和 `记录测评` 上下文，减少从概览添加首条 case 后的断点。
- 新增 Playwright 覆盖导入后首轮验证路径：导入 -> 添加首条 case -> 手工通过 -> 记录 run -> 查看历史。
- 验证：`uv run pytest` 71 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 23 passed。
- 视觉截图：`.agent/screenshots/TASK-009-1.png`。

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
