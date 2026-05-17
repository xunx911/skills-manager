# Saved run view config helper 重构计划

## 目标

把 saved run view config 的纯逻辑从 `DecisionWorkbench` 抽出，降低主工作台组件继续膨胀的风险。

## 步骤

1. 写红灯单元测试
   - 测试 `buildSavedRunViewConfig`。
   - 测试 `runFiltersFromConfig`。
   - 测试 `runMatrixControlsFromConfig`。
   - 测试 `runComparisonFromConfig`。

2. 实现 helper
   - 新增 `saved-run-view-config.ts`。
   - 复用现有 defaults 和类型。

3. 接入主组件
   - `DecisionWorkbench` 删除本地 saved view config helper。
   - 保存和应用视图改为调用新 helper。

4. 验证
   - 目标 unit。
   - saved view E2E。
   - 完整 API、Web unit、build、typecheck、audit、E2E。
   - `git diff --check` 和任务 JSON 检查。
