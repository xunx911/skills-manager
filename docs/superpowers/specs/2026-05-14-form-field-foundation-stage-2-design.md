# 表单字段基础件第二阶段设计

## 背景

TASK-044 已把 `SkillLaunchpad` 和 `WorkbenchInspector` 的高频写入字段迁移到 `WorkbenchField` 系列组件。现在剩余分散点集中在测评执行、case 详情、skill 设置、访问控制、历史筛选、矩阵控制和 diff 版本选择。它们都能用，但各自手写 `<label>`、`input/select/textarea`、`aria-label` 和样式，继续扩展会让字段语义、自动填充、焦点和错误态再次漂移。

第二阶段目标不是换视觉皮肤，而是把这些剩余工作台字段纳入同一字段契约，让用户在不同 pane 里获得一致的输入体验，也让后续错误展示和表单验证可以在一个组件层统一。

## 外部实践

- [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines) 对表单的要求包括：每个 control 都有 label、label 点击能聚焦、错误贴近字段、提交时聚焦第一个错误、设置合适的 `autocomplete/name`、使用 `:focus-visible`，且不要预先禁用提交来隐藏验证反馈。
- [GOV.UK Design System text input](https://design-system.service.gov.uk/components/text-input/) 把 `label`、`hint`、`errorMessage` 和 `aria-describedby` 作为同一个字段组件的核心选项，并通过 `autocomplete` 满足 WCAG 1.3.5。
- [GOV.UK error message](https://design-system.service.gov.uk/components/error-message/) 要求错误信息放在问题文本和 hint 后面、用红色边框连接字段、不要在显示错误时清空用户输入，并让错误文案直接包含字段问题。
- [USWDS Form](https://designsystem.digital.gov/components/form) 强调 DOM 顺序要和视觉顺序一致、验证信息要和输入字段视觉对齐，并对相关控件使用原生 fieldset/legend。
- [Material Design errors](https://m1.material.io/patterns/errors.html) 建议在用户提交或交互后展示不完整字段错误，并把字段状态和字段下方错误文案同时呈现。

对 SkillHub 的适配：表单字段不是装饰组件，而是“用户提交证据资产”的基础设施。字段壳层要统一 label/hint/error/describedby/autocomplete/focus；具体业务仍由现有 form submit handler 和后端校验负责。

## 产品设计

扩展 `WorkbenchField` 系列：

- `TextField`、`TextAreaField`、`SelectField`、`FileField` 支持可选 `error`。
- 有 `hint` 或 `error` 时，组件自动生成稳定的 `aria-describedby`。
- 有 `error` 时，control 标记 `aria-invalid="true"`，错误文案显示在字段下方，保留用户输入。
- `TextField` 和 `TextAreaField` 继续默认 `autoComplete="off"`；业务字段如 `slug`、`tags`、`owner_ref`、case input/expected output 不让浏览器个人资料误填。
- 新增 `CheckboxField`，用于 run matrix 这类 toggle，保证 checkbox 和 label 共享一个可点击 hit target。

第二阶段迁移范围：

- `QuickAddCases`：单条和批量 case 输入。
- `EvalCaseDetailPanel`：详情内联编辑 case。
- `SkillSettingsPanel`：Skill ID、归属、默认分发 variant。
- `SkillAccessPanel`：成员和角色。
- `SkillGovernancePanel`：危险区确认输入。
- `SavedRunViews`：保存视图选择和命名。
- `WorkbenchHistoryPane` 的 history filters：抽成 `HistoryRunFiltersBar`，避免主文件继续膨胀。
- `RunMatrixPanel`：impact/group/score controls。
- `WorkbenchDiffPane`：from/to version selectors。

## 范围控制

本轮不做：

- 不改变后端验证模型。
- 不把所有表单改成受控输入；继续优先使用原生 form 和 FormData，降低 keystroke 成本。
- 不实现复杂错误 summary；现阶段只把字段级 error API 和样式接好。
- 不改颜色体系、字体或整体信息架构。
- 不迁移命令菜单搜索框、catalog 搜索框、promotion decision note、local session actor；这些不是本轮审计列出的剩余表单批次。

## 架构

- `apps/web/components/forms/workbench-field.tsx` 继续是字段基础件唯一入口，新增 `error` 和 `CheckboxField`。
- 各业务组件只替换字段壳层，保留原有字段 `name`、`placeholder`、`required`、`value/defaultValue` 和 event handler。
- `apps/web/components/history/history-run-filters-bar.tsx` 新增为纯展示组件，接收 filter state、version options 和 `onFilterChange`。
- CSS 继续沿用现有容器 class，只把直接 `label/input/select/textarea` 选择器调整到 `.workbenchField` 和 `.workbenchCheckboxField`，避免视觉大跳。

## 验收标准

- 新增 E2E 先红后绿：证明 QuickAddCases、EvalCaseDetailPanel、SkillSettingsPanel、SkillAccessPanel、SavedRunViews、history filters、run matrix controls 和 diff selectors 都使用共享字段语义，关键业务 text/textarea 字段显式 `autocomplete="off"`。
- 现有 case 批量添加、case 内联编辑、skill 设置、访问控制、历史筛选、矩阵控制、diff 比较不回归。
- `WorkbenchHistoryPane` 迁移后低于 300 行。
- 完整验证通过：web unit、typecheck、build、npm audit、API pytest、全量 Playwright E2E、`git diff --check`、任务 JSON 校验。
