# Workbench Inspector 组件抽离规格

## 背景

`DecisionWorkbench` 仍超过 2600 行，主组件同时承担数据编排、主区渲染、右侧操作表单和焦点交接。右侧 Inspector 是稳定的产品区域，包含 verification 摘要、本地 actor、action menu，以及导入、新建、追加版本、测试用例和记录测评等表单。

本任务只做结构性拆分，不改变用户可见行为。

## 用户可见行为

用户仍然在右侧看到同一套 Inspector：

- Verification 卡片显示最近 accepted run 的状态、分数、VariantVersion 和 EvalSetVersion。
- 本地 Session Actor 可继续切换当前 actor。
- action menu 仍包含 `Skill 设置`、`导入 bundle`、`新建 skill`、`新建 variant`、`追加版本`、`新增 case`、`编辑 case`、`记录测评`。
- 空 skill 状态下，除 `新建 skill` 和 `导入 bundle` 外的 action 继续禁用。
- 从目录、命令菜单或主区触发 action 时，Inspector 仍把焦点交接到当前表单第一个可操作控件。
- 所有表单字段名保持不变，后端 mutation 继续由 `DecisionWorkbench` 的现有 handler 处理。

## 组件边界

新增 `WorkbenchInspector`：

- 输入：当前 action、skill detail、default variant、eval run、case 列表、draft 统计、busy 状态、actor 和 import preview。
- 输出：通过回调通知父组件执行 mutation 或更新选择。
- 组件内部只处理右侧展示、action menu、表单 DOM 和焦点交接。
- 组件不直接调用 API，不维护 skill/eval/run 数据状态。

`DecisionWorkbench` 保留：

- 所有 API mutation 和查询。
- 当前 skill、当前 case、action mode、mode、draft 测评状态。
- 选择 action 后决定是否切换主区 mode。

## 非目标

- 不重做 Inspector 视觉。
- 不改变表单字段、文案或 className。
- 不把每个表单进一步拆小。
- 不新增用户功能。

## 验收标准

- `apps/web/components/inspector/workbench-inspector.tsx` 存在。
- `DecisionWorkbench` 中不再存在内联 `function Inspector`。
- `DecisionWorkbench` 行数显著减少，`WorkbenchInspector` 文件保持在 300 行以内。
- TypeScript、构建、API 测试和 E2E 全部通过。
