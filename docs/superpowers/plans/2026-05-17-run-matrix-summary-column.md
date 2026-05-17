# Run matrix 结果摘要列计划

## 目标

给 Run matrix 增加一个内置指标列 `Summary`，减少用户横向心算成本，并打通列配置、URL、saved view 和 CSV。

## 步骤

1. 写红灯测试
   - CSV unit 期望 Summary 列。
   - Run matrix E2E 期望 Summary 列和隐藏行为。
   - URL E2E 期望 `matrix_summary=false`。
   - saved view E2E 期望恢复 `Summary column`。
   - API/Repository 期望 saved view config 保留 `matrix_show_summary`。

2. 实现数据与 UI
   - Run matrix helper 增加 case result summary。
   - RunMatrixControls 增加 `matrix_show_summary`。
   - RunMatrixPanel 渲染 Summary header/cell 和 checkbox。
   - CSV 导出遵循 Summary 列可见性。

3. 接入持久化配置
   - URL state 增加 `matrix_summary`。
   - saved view config allowlist/type/helper 增加 `matrix_show_summary`。

4. 文档和视觉
   - 更新 README、产品审计和摩擦审计。
   - 更新 run comparison 视觉基线。

5. 完整验证
   - API、Web unit、build、typecheck、audit、E2E、diff check、任务 JSON。
