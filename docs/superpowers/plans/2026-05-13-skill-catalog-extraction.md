# Skill Catalog 组件抽离计划

## 红灯

- 运行 `test -f apps/web/components/skills/skill-catalog.tsx`，确认组件尚不存在。
- 运行 `wc -l apps/web/components/decision-workbench.tsx`，确认主工作台仍是超大文件。

## 实施步骤

1. 新增 `apps/web/components/skills/skill-catalog.tsx`。
2. 将左侧 catalog 的 JSX、通过率展示和空态展示迁移到 `SkillCatalog`。
3. 在 `DecisionWorkbench` 中引入 `SkillCatalog`，只传状态和回调。
4. 保持原有 className、文案、按钮和选择行为不变。
5. 更新 `.agent/tasks.json`、`TASK-030.json` 和执行日志。

## 验证步骤

1. `cd apps/web && npm run typecheck`
2. `cd apps/web && npm run build`
3. `cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e`
4. `cd apps/api && uv run pytest`
5. `git diff --check`

## 回滚策略

如果 E2E 发现目录入口行为变化，恢复 `DecisionWorkbench` 原内联 JSX，并只保留任务文档说明失败原因。由于本任务不涉及 API 和存储迁移，回滚成本低。
