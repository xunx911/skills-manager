# Workbench History Pane 组件抽离规格

## 背景

`DecisionWorkbench` 已经抽离 Catalog、Inspector、Overview 和 Evals，但历史页仍内联在主文件中。历史页承载 run history、saved views、run matrix、run comparison 和 accepted verification pointer，是测评证据链的核心区域。继续留在主文件里，会阻碍后续把实验记录管理做成更顺手的产品体验。

本任务只做结构性拆分，不改变用户可见行为。

## 用户可见行为

用户在 `历史` tab 仍能看到并操作：

- 保存视图：选择、命名保存、删除当前视图。
- run filters：按 VariantVersion、EvalSetVersion、strategy、status 过滤。
- Run matrix：impact filter、group by、score toggle、对照/候选影响态。
- run list：查看分数、版本绑定、策略、状态和时间。
- comparison actions：把 run 标为对照或候选。
- Run comparison：查看修复/回退/稳定通过/仍未通过，并接受候选 run 为 verification pointer。
- selected run detail：查看 exact bindings 和逐 case pass/fail 结果。
- 没有历史时仍显示去记录测评的空态入口。

## 组件边界

新增 `WorkbenchHistoryPane`：

- 输入：run history、run matrix、saved views、filters、comparison、selected run detail、variants、eval sets 和 loading/busy 状态。
- 输出：通过回调通知父组件更新 filters、保存视图、删除视图、选择 run、选择 comparison run、接受 comparison。
- 组件内部负责历史页展示派生：当前 selected row、filter options、版本列表和本页格式化显示。
- 组件不直接调用 API，不维护全局 workbench mode。

`DecisionWorkbench` 保留：

- API 查询和 mutation。
- run filters、saved view 状态、comparison 状态、selected run 状态。
- 从 saved view config 读写 filters 和 matrix controls 的逻辑。

## 非目标

- 不重做历史页视觉。
- 不改变 CSS class、按钮文案、筛选字段或 comparison 行为。
- 不拆分 `RunMatrixPanel`、`RunComparisonPanel` 或 `SavedRunViews`。

## 验收标准

- `apps/web/components/history/workbench-history-pane.tsx` 存在。
- `DecisionWorkbench` 中不再存在内联 `function HistoryPane`。
- `DecisionWorkbench` 行数减少，`WorkbenchHistoryPane` 文件保持在 300 行以内。
- TypeScript、构建、API 测试和 E2E 全部通过。
