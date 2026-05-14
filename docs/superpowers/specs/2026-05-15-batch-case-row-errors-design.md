# 批量 case 行级错误第一阶段设计

## 背景

测评页已经支持把多行 `title | input | expected output | notes` 或 tab 分隔文本批量加入评测集。旧体验会静默跳过无效行，只显示“跳过 N 行”。这对用户不够诚实：他们不知道哪一行错了，也可能误以为所有 case 都已经进入评测集。

## 外部依据

- GOV.UK Error Summary：提交失败时需要错误摘要、聚焦摘要，并链接到具体字段。
- Airtable 多行粘贴：用户可以从表格复制多行，但系统应在导入前展示可修正的问题。
- TestRail 测试用例导入：批量录入要保证测试资产质量，不能静默吞掉缺字段用例。

## 方案

第一阶段不引入复杂 CSV parser，也不改后端批量 API。前端 parser 从组件中抽到纯 TS 模块，返回：

- `valid`：可以提交的 case drafts。
- `invalidRows`：无效行明细，包含原始行号和中文原因。
- `invalidCount`：兼容现有计数展示。

批量表单改用 `ValidatedForm`，并通过新的 `validate(form)` 扩展点注入业务校验。有任意无效行时：

1. 阻止提交。
2. 错误摘要聚焦。
3. 摘要和字段旁错误都指向 `batch_cases` textarea。
4. textarea 设置 `aria-invalid="true"`。
5. 表单下方列出最多前三条行级错误，剩余数量用汇总说明。

## 范围

本阶段覆盖：

- 缺少 `title`、`input` 或 `expected output`。
- `|` 和 tab 分隔。
- 空行忽略。
- 有效行和无效行混合时，不再提交有效行并静默丢弃无效行。

暂不覆盖：

- CSV 引号、换行和转义规则。
- 服务端 JSON Pointer 行级错误。
- 导入前表格化编辑。
- 与已有 case 的重复检测。

## 验收

- Unit 红测先失败于 parser 模块缺失，绿色后返回行号和原因。
- E2E 红测先失败于批量表单没有 `.formErrorSummary`，绿色后 summary 聚焦、textarea 标记 `aria-invalid`，且不会创建部分有效 case。
