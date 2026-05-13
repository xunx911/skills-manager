# Workbench Variants Pane 组件抽离规格

## 背景

`DecisionWorkbench` 已经抽离 Catalog、Inspector、Overview、Evals、History 和 Diff，但变体页仍内联在主文件中。变体页承载 variant map、版本列表、追加版本、比较版本和候选版本评审入口，是 Skill 分发与版本治理之间的核心区域。

本任务只做结构性拆分，不改变用户可见行为。

## 用户可见行为

用户在 `变体` tab 仍能看到并操作：

- toolbar：查看当前变体数量、历史版本数量和默认分发提示。
- 添加 variant：打开右侧 Inspector 的新建 variant 表单。
- 追加版本：打开右侧 Inspector 的追加版本表单。
- 比较版本：当默认 variant 至少有两个版本时进入 diff tab。
- VariantCreationComposer：在变体页直接创建新约束变体。
- WorkspaceVersionComposer：在变体页直接给某个 variant 追加版本。
- variant map cards：点击进入 variant 详情页，查看 label、summary、tags、current version 和版本数。
- version rows：当前版本显示 `Current`，非当前版本可进入设为当前版本评审。

## 组件边界

新增 `WorkbenchVariantsPane`：

- 输入：variants、defaultVariant 和 busy 状态。
- 输出：通过回调通知父组件执行新建 variant、追加版本、打开 diff、打开 promotion review 和切换 Inspector action。
- 组件内部负责变体页展示派生：historyCount、版本排序、当前版本判断和按钮禁用态。
- 组件不直接调用 API，不维护 workbench mode，不决定 diff pair，也不提交 promotion decision。

`DecisionWorkbench` 保留：

- `createVariant` 和 `createVariantVersion` mutation。
- `chooseAction`、mode 切换和 Inspector 焦点交接。
- `openDiffMode`、`defaultDiffPair` 和 bundle diff API 编排。
- `openPromotionReview` 和 promotion review 状态编排。

## 非目标

- 不重做变体地图视觉。
- 不改变 CSS class、按钮文案、链接、版本排序或 current version 标记。
- 不改变 variant/tag/current version 的领域语义。
- 不拆分 composer 子组件或 promotion review 组件。

## 验收标准

- `apps/web/components/variants/workbench-variants-pane.tsx` 存在。
- `DecisionWorkbench` 中不再存在内联 `function VariantsPane`。
- `DecisionWorkbench` 不再直接依赖 `VariantCreationComposer`、`WorkspaceVersionComposer`、`Link` 或 `Badge`。
- `DecisionWorkbench` 行数减少，`WorkbenchVariantsPane` 文件保持在 300 行以内。
- TypeScript、构建、API 测试、E2E 和 `git diff --check` 全部通过。
