# Workbench Diff Pane 组件抽离计划

## 红灯

- 运行 `test -f apps/web/components/diff/workbench-diff-pane.tsx`，确认目标组件尚不存在。
- 运行 `rg -n "function DiffPane\\(" apps/web/components/decision-workbench.tsx`，确认旧内联组件仍存在。
- 运行 `wc -l apps/web/components/decision-workbench.tsx`，确认主组件仍过大。

## 实施步骤

1. 新增 `apps/web/components/diff/workbench-diff-pane.tsx`。
2. 将原 DiffPane 的版本选择器、summary metrics、filter bar、file rail、binary notice 和 line-level diff 迁入新组件。
3. 导出 `DiffFilter`，让 `DecisionWorkbench` 复用同一筛选类型。
4. 从 `DecisionWorkbench` 删除内联 `DiffPane`、diff-only helpers 和不再使用的 imports。
5. 在 `DecisionWorkbench` 中用 `WorkbenchDiffPane` 替换旧调用，保持 props 和 handler 语义不变。
6. 更新 `.agent/tasks.json`、`TASK-035.json` 和执行日志。

## 验证步骤

1. `cd apps/web && npm run typecheck`
2. `cd apps/web && npm run build`
3. `cd apps/api && uv run pytest`
4. `cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e`
5. `git diff --check`

## 回滚策略

如果版本选择、文件筛选、line-level diff 或 promotion review 入口回归，恢复 `DecisionWorkbench` 原内联 DiffPane，删除新组件和本任务文档。由于本任务不修改 API、数据库和 CSS，回滚只影响前端组件结构。
