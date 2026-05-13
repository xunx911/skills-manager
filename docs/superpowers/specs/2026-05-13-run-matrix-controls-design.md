# Run Matrix 多维控制设计

日期：2026-05-13

## 背景

SkillHub 已经有 run history、run matrix、run-to-run comparison 和 saved views。当前矩阵能展示 `case x run` 的 pass/fail，也能在选择对照/候选后显示逐 case impact，但它仍像一张固定报表：用户不能按 impact 聚焦，也不能把矩阵显示偏好保存为视图。下一步应该让它靠近用户之前提出的“多维表格”：不预设唯一比较视角，而是让用户按当前问题组织证据。

## 外部实践

- LangSmith experiment comparison 支持对比较结果应用过滤，也支持在列级别过滤数据，并在比较视图中突出 regressions/improvements。适配到 SkillHub：矩阵应允许按 `修复/回退/仍未通过/稳定通过` 聚焦 case，而不是只显示完整表。来源：<https://docs.langchain.com/langsmith/compare-experiment-results>
- W&B Tables 把 runs、samples 和指标放在可筛选表格中，用于跨版本分析具体样本。适配到 SkillHub：run matrix 的行是 case，列是 eval run，第一版先保留现有数据结构，但增加显示控制。来源：<https://docs.wandb.ai/guides/tables/>
- Airtable grid view 的核心是隐藏字段、排序、分组，并把这些看法组织成 view；隐藏字段不会改变底层数据。适配到 SkillHub：matrix 控制只改变阅读视角，不改变 EvalRun / CaseResult 事实。来源：<https://support.airtable.com/airtable-grid-view>
- Linear custom views 让用户把过滤后的工作视角保存下来。适配到 SkillHub：saved run view 不只保存 run filters，也应保存 matrix 的分组、impact filter 和显示字段。来源：<https://linear.app/docs/custom-views>

## 设计目标

1. Run matrix 增加 `Matrix controls`：impact filter、group by、show score。
2. impact filter 支持 `all`、`fixed`、`regressed`、`stable_fail`、`stable_pass`、`missing`、`waiting`。
3. group by 支持 `none` 和 `impact`；选择 impact 后按 impact 分组并显示组标题和数量。
4. show score 控制 run header 是否显示通过率，减少窄屏和多 run 场景的信息噪音。
5. Saved run views 持久化 matrix 控制项，应用视图时恢复 run filters 和 matrix controls。
6. 不改 EvalRunMatrix API 的事实数据结构；所有分组和过滤在前端根据现有 cells 计算。

## 非目标

- 不引入 TanStack Table 或大型表格引擎。
- 不做列拖拽、列冻结配置、CSV 导出。
- 不保存 baseline/candidate run id；对照/候选选择仍是当前会话操作。
- 不做后端 matrix aggregation。

## 交互细节

- 控制条位于 `Run matrix` 标题下方，样式紧凑，像 Airtable/Linear 的 view toolbar。
- 没有选择对照/候选时，impact 为 `waiting`；此时 impact filter 默认 all，用户可以看到提示。
- 选择对照/候选后，impact chip 的语义与 run comparison 保持一致。
- `Group by impact` 后表格中插入 `.runMatrixGroupRow`，例如 `修复 · 1 case`。
- 如果 impact filter 后没有 case，显示 `当前矩阵视图没有匹配 case`，而不是空白表格。
- 保存视图时，`matrix_group_by`、`matrix_impact`、`matrix_show_score` 和 run filters 一起进入 `saved_views.config`。

## 测试策略

- API：保存视图 config 允许 matrix 控制键，并继续清理空值和 `all`。
- E2E：在两次 run 的 matrix 中选择对照/候选，切换 `Group by impact`，断言出现 `修复 · 1 case` 和 `稳定通过 · 1 case`。
- E2E：选择 impact filter `修复`，断言只显示修复 case。
- E2E：关闭 score 显示，保存视图，改回默认，再应用保存视图，断言 matrix 控制恢复。
- 视觉：更新 run comparison 视觉基线，覆盖 matrix controls 和 grouped matrix。
