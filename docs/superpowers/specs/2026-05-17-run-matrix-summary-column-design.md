# Run matrix 结果摘要列设计

## 背景

Run matrix 现在能显示每个 case 在每次 run 上的通过、不通过或未覆盖，但用户要判断“这个 case 整体表现如何”仍需要横向心算。随着 run 数增加，逐单元格扫读会变慢。

## 目标

新增一个默认显示的 `Summary` 指标列，按当前可见 runs 汇总每个 case 的结果：通过数、失败数和未覆盖数。它是 Run matrix 自定义指标列的第一步，先用内置指标验证列配置、saved view、URL 和 CSV 的完整链路。

## 范围

- Run matrix 新增 `Summary` 列，默认显示。
- `Summary` 列显示 `x/y 通过`，并在存在失败或未覆盖时追加 `n 不通过` / `n 未覆盖`。
- 控制区新增 `Summary column` checkbox。
- URL state 保存 `matrix_summary=false`。
- saved run view 保存 `matrix_show_summary=false`。
- CSV 导出遵循当前 Summary 列可见性。

## 非范围

- 不做用户自定义公式。
- 不做列拖拽排序。
- 不新增后端 read model 字段。
- 不改变 eval run 原始结果。

## 验收

- E2E 覆盖 Summary 列默认显示、隐藏、CSV 导出和 saved view 恢复。
- Unit 覆盖 CSV Summary 文案。
- API saved view allowlist 保留 `matrix_show_summary`。
- 完整回归通过。
