# Run Matrix Impact 列配置设计

日期：2026-05-17

## 背景

Run matrix 已经支持 impact filter、按 impact 分组、隐藏 run header 分数，并且这些控制项会进入 URL 和 saved views。但完成度审计仍指出：它还不是完整多维表格，缺少列配置、自定义指标和导出。

本轮只做列配置的第一条：`Impact` 列可隐藏。原因是 `Impact` 对“对照/候选”分析很有价值，但当用户只想扫 `case x run` 原始 pass/fail 时，这列会占用横向空间，尤其在中等宽度和移动端横向滚动里更明显。

## 借鉴实践

- Airtable grid view 支持隐藏字段，隐藏字段只改变视图，不改变底层记录。SkillHub 适配为隐藏 `Impact` 列，但不改变 `EvalRun`、`CaseResult` 或 impact 计算。
- W&B Tables 用列、筛选和样本行组织 experiment evidence。SkillHub 继续把 row 定义为 case、run 定义为动态列，本轮只增加列可见性。
- Linear custom views 把筛选和显示偏好保存成 view。SkillHub 适配为 URL state 与 saved run view 都保存 `matrix_show_impact`。

参考：

- Airtable Grid View: <https://support.airtable.com/airtable-grid-view>
- W&B Tables: <https://docs.wandb.ai/guides/tables/>
- Linear Custom Views: <https://linear.app/docs/custom-views>

## 方案

### 控制项

新增 `RunMatrixControls.matrix_show_impact: "true" | "false"`。

默认值是 `"true"`，与当前界面保持兼容。`RunMatrixPanel` 的控制条增加一个 checkbox：

```text
Impact column
```

关闭后：

- 表头不渲染 `Impact` 列。
- 每个 case 行不渲染 `runMatrixImpactCell`。
- `aria-colcount` 从 `runs.length + 2` 改为 `runs.length + 1`。
- group row `colSpan` 跟随列数变化。
- impact filter 和 group by 仍可使用，因为它们是视图筛选/分组，不依赖列可见。

### 持久化

- URL 参数：`matrix_impact_column=false`，默认不写入。
- saved view config key：`matrix_show_impact`。
- `runMatrixControlConfig` 继续只保存非默认值。

### 非目标

- 不实现任意列拖拽、排序或自定义指标列。
- 不实现 CSV/JSON 导出。
- 不把 table 升级成 interactive grid；当前仍是 read-only 分析表。
- 不修改后端 run matrix read model。

## 成功标准

1. E2E 红测先证明当前 `Run matrix` 没有 `Impact column` 控制。
2. 关闭 `Impact column` 后，表格没有 `Impact` 列，`aria-colcount` 变成 `runs.length + 1`，pass/fail 单元格仍可读。
3. URL state 会写入 `matrix_impact_column=false`，刷新后保持隐藏。
4. saved run view 会保存并恢复 `matrix_show_impact=false`。
5. saved view API 允许 `matrix_show_impact`，仍过滤未知 config key。
6. 全量 API、Web unit、typecheck、build、audit、E2E、视觉基线、diff check 和任务 JSON 检查通过。
