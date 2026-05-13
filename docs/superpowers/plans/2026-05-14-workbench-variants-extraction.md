# Workbench Variants Pane 组件抽离计划

## 红灯

- 运行 `test -f apps/web/components/variants/workbench-variants-pane.tsx`，确认目标组件尚不存在。
- 运行 `rg -n "function VariantsPane\\(" apps/web/components/decision-workbench.tsx`，确认旧内联组件仍存在。
- 运行 `wc -l apps/web/components/decision-workbench.tsx`，确认主组件仍过大。

## 实施步骤

1. 新增 `apps/web/components/variants/workbench-variants-pane.tsx`。
2. 将原 VariantsPane 的 toolbar、创建 composer、版本 composer、variant map cards 和 version rows 迁入新组件。
3. 在新组件中保留本页局部派生逻辑：historyCount、版本排序和当前版本判断。
4. 从 `DecisionWorkbench` 删除内联 `VariantsPane` 和不再使用的 imports。
5. 在 `DecisionWorkbench` 中用 `WorkbenchVariantsPane` 替换旧调用，保持 props 和 handler 语义不变。
6. 更新 `.agent/tasks.json`、`TASK-036.json` 和执行日志。

## 验证步骤

1. `cd apps/web && npm run typecheck`
2. `cd apps/web && npm run build`
3. `cd apps/api && uv run pytest`
4. `cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e`
5. `git diff --check`

## 回滚策略

如果变体创建、追加版本、版本比较或 promotion review 入口回归，恢复 `DecisionWorkbench` 原内联 VariantsPane，删除新组件和本任务文档。由于本任务不修改 API、数据库和 CSS，回滚只影响前端组件结构。
