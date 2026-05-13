# Run Matrix 表格语义设计

日期：2026-05-13

## 背景

History 页的 `Run matrix` 已经能展示多次 run 和多条 case 的通过/不通过关系，也能按 impact 过滤和分组。但完成度审计仍把“矩阵语义”列为 accessibility 深水区缺口：用户视觉上能看出这是一张 case x run 矩阵，读屏和自动化检查却还缺少稳定的表格名称、说明和单元格级语义。

## 外部实践

- WAI-ARIA APG Table Pattern 明确建议：如果只是静态表格，应优先使用原生 HTML `table`；`grid` 更适合需要单元格级键盘导航或编辑的交互组件。适配到 SkillHub：当前 run matrix 是分析视图，不是 spreadsheet，因此保持原生 `<table>`，不升级成 `grid`。来源：<https://www.w3.org/WAI/ARIA/apg/patterns/table/>
- WAI-ARIA APG Table Pattern 要求表格有可感知标签；列标题用 `columnheader`，行标题用 `rowheader`，必要时使用 `aria-rowindex` / `aria-colindex` 表示隐藏行列后的真实位置。适配到 SkillHub：用 `<caption>` 和 `aria-describedby` 给矩阵命名与说明，使用 `scope="col"` / `scope="row"`，按当前可见行列提供 row/col index。
- WAI-ARIA Sortable Table Example 说明：表格中的互动控件应保持原生 button/select 行为，表格本身不需要额外键盘处理。适配到 SkillHub：impact filter、group select 和 score checkbox 继续在表格外作为独立控件，不把每个单元格做成 Tab stop。来源：<https://www.w3.org/WAI/ARIA/apg/patterns/table/examples/sortable-table/>
- Vercel Web Interface Guidelines 强调优先使用原生元素、给控件准确名称，并在 accessibility tree 中验证。适配到 SkillHub：矩阵单元格用 `aria-label` 暴露“case、run、结果、impact”，避免只靠颜色 chip 表达。来源：<https://vercel.com/design/guidelines>

## 方案

1. `RunMatrixPanel` 给表格添加稳定 caption 和 description。视觉上仍保持当前布局，但 caption 使用 `.visuallyHidden`，避免重复占用空间。
2. 所有列标题使用 `<th scope="col">`；case 标题使用 `<th scope="row">`；impact 分组行使用 `<th scope="rowgroup" colSpan=...>`，让分组不是普通数据格。
3. 数据单元格保留视觉 chip，同时添加完整 `aria-label`：例如 `PR: missing tenant scope 在 Primary v2 / Primary cases v1 的结果：通过`。
4. Impact 单元格添加完整 `aria-label`：例如 `PR: missing tenant scope 的对照候选影响：修复`。
5. 表格增加 `aria-rowcount` / `aria-colcount`，行和单元格增加 `aria-rowindex` / `aria-colindex`，让过滤和横向滚动后的结构更可解释。
6. 不引入可编辑 grid 和方向键导航。本轮目标是读屏可理解，不改变矩阵使用方式。

## 非目标

- 不做列配置、自定义指标列、CSV 导出。
- 不保存对照/候选 run 指针。
- 不重构 History 页整体布局。
- 不做人工读屏全验收；本轮只加自动化语义回归。

## 验收

- 新增 E2E 先红后绿：能按 table 名称找到 run matrix；列标题和行标题可被 role 查询；pass/fail/missing 和 impact 单元格有完整可读名称。
- 原有 run matrix、saved view、run comparison E2E 继续通过。
- 完整验证通过：API pytest、web typecheck、web build、web E2E、`git diff --check`。
