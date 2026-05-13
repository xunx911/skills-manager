# Workbench Diff Pane 组件抽离规格

## 背景

`DecisionWorkbench` 已经抽离 Catalog、Inspector、Overview、Evals 和 History，但差异页仍内联在主文件中。差异页承载标准 Skill bundle 的版本比较、文件级筛选、行级 diff 和候选版本评审入口，是版本治理链路中最接近 Git review 心智的区域。

本任务只做结构性拆分，不改变用户可见行为。

## 用户可见行为

用户在 `差异` tab 仍能看到并操作：

- From / To 版本选择器：选择同一 variant 的两个不可变版本。
- summary metrics：查看 changed、added、removed、binary 文件数量。
- filter bar：按全部、修改、新增、删除、二进制筛选文件。
- file rail：选择某个 bundle 文件查看变化。
- text diff：查看旧行号、新行号和 added / removed / context 行。
- binary notice：二进制文件不展示文本 diff，但保留大小信息。
- 设为当前版本评审：对非当前版本触发 promotion review。
- 空态：少于两个版本时提示先追加版本。

## 组件边界

新增 `WorkbenchDiffPane`：

- 输入：当前 variant、bundle diff、左右版本 id、筛选状态、选中文件路径和 loading 状态。
- 输出：通过回调通知父组件更新版本 pair、筛选条件、选中文件和 promotion review。
- 组件内部负责差异页展示派生：排序后的版本列表、可评审右侧版本、筛选后的文件列表、选中文件 fallback 和文件大小文案。
- 组件不直接调用 API，不维护 workbench mode，也不决定何时预加载 diff。

`DecisionWorkbench` 保留：

- diff pair、diff filter、selected diff path 等状态。
- bundle diff API 查询和缓存。
- `defaultDiffPair`，因为它属于打开 diff tab 时的全局编排。
- promotion review 的 API 与状态编排。

## 非目标

- 不重做差异页视觉。
- 不改变 CSS class、按钮文案、筛选值、版本排序或 diff 展示语义。
- 不引入 diff editor、side-by-side diff 或 Git object storage。
- 不拆分 `VariantsPane`、`PromotionReviewPane` 或 bundle artifact 解析逻辑。

## 验收标准

- `apps/web/components/diff/workbench-diff-pane.tsx` 存在。
- `DecisionWorkbench` 中不再存在内联 `function DiffPane`。
- diff-only helpers 不再留在 `DecisionWorkbench`。
- `DecisionWorkbench` 行数减少，`WorkbenchDiffPane` 文件保持在 300 行以内。
- TypeScript、构建、API 测试、E2E 和 `git diff --check` 全部通过。
