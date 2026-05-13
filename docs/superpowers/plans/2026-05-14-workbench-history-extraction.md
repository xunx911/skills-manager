# Workbench History Pane 组件抽离计划

## 红灯

- 运行 `test -f apps/web/components/history/workbench-history-pane.tsx`，确认目标组件尚不存在。
- 运行 `rg -n "function HistoryPane\\(" apps/web/components/decision-workbench.tsx`，确认旧内联组件仍存在。
- 运行 `wc -l apps/web/components/decision-workbench.tsx`，确认主组件仍过大。

## 实施步骤

1. 新增 `apps/web/components/history/workbench-history-pane.tsx`。
2. 将原 HistoryPane 的 saved views、filters、RunMatrixPanel、run list、RunComparisonPanel 和 run detail 迁入新组件。
3. 导出 `HistoryRunFilters`，让 `DecisionWorkbench` 复用同一筛选类型。
4. 从 `DecisionWorkbench` 删除内联 `HistoryPane`、`runFraction`、历史页本地日期格式化和只属于历史页的 imports。
5. 在 `DecisionWorkbench` 中用 `WorkbenchHistoryPane` 替换旧调用，保持 props 和 handler 语义不变。
6. 更新 `.agent/tasks.json`、`TASK-034.json` 和执行日志。

## 验证步骤

1. `cd apps/web && npm run typecheck`
2. `cd apps/web && npm run build`
3. `cd apps/api && uv run pytest`
4. `cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e`
5. `git diff --check`

## 回滚策略

如果历史页过滤、保存视图、run matrix 或 comparison 回归，恢复 `DecisionWorkbench` 原内联 HistoryPane，删除新组件和本任务文档。由于本任务不修改 API、数据库和 CSS，回滚只影响前端组件结构。
