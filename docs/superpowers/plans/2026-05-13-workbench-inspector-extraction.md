# Workbench Inspector 组件抽离计划

## 红灯

- 运行 `test -f apps/web/components/inspector/workbench-inspector.tsx`，确认目标组件尚不存在。
- 运行 `rg -n "function Inspector\\(" apps/web/components/decision-workbench.tsx`，确认旧内联组件仍存在。
- 运行 `wc -l apps/web/components/decision-workbench.tsx`，确认主组件仍过大。

## 实施步骤

1. 新增 `apps/web/components/inspector/workbench-inspector.tsx`。
2. 将原 Inspector 的 Verification 卡片、LocalSessionPanel、action menu 和表单 JSX 移入新组件。
3. 在新组件中导出 `InspectorActionMode` 和 `InspectorImportPreview`，供父组件复用同一组 action 和 preview 类型。
4. 从 `DecisionWorkbench` 删除内联 `Inspector` 函数和只属于 Inspector 的文件上传 input props。
5. 在 `DecisionWorkbench` 中用 `WorkbenchInspector` 替换旧调用，保持 props 和 handler 语义不变。
6. 更新 `.agent/tasks.json`、`TASK-031.json` 和执行日志。

## 验证步骤

1. `cd apps/web && npm run typecheck`
2. `cd apps/web && npm run build`
3. `cd apps/api && uv run pytest`
4. `cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e`
5. `git diff --check`

## 回滚策略

如果抽离导致右侧表单或焦点交接回归，恢复 `DecisionWorkbench` 原内联 Inspector，删除新组件和本任务文档。由于本任务不修改 API、数据库和 CSS，回滚只影响前端组件结构。
