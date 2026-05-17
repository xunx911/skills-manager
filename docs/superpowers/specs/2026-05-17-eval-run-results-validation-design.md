# EvalRun Results 精确字段校验设计

日期：2026-05-17

## 背景

`POST /api/eval-runs` 是测评事实落库入口。当前仓储层会为 `EvalSetVersion` 中的每个 case 创建 `CaseResult`，但如果 `results` 缺少某个 case version，会把它静默记为 `false`；如果 `results` 带了不属于当前 eval set version 的 key，也会被忽略。

这在 demo 阶段可以暴露遗漏，但对成熟产品不够严谨：用户和外部 runner 需要明确知道“每条 case 是否已经被确认”。遗漏结果不应该被平台猜成失败，脏 key 也不应该静默丢弃。

## 借鉴实践

- JSON:API error object 使用 `source.pointer` 表示错误在请求文档中的定位。SkillHub 继续保留现有 `field_errors.field`，但把嵌套 map key 表达成 `results.<case_version_id>`，让客户端能定位具体结果项。
- RFC 9457 Problem Details 强调错误响应要包含人读说明和机器可读结构。SkillHub 继续兼容 `detail + field_errors`，不让客户端解析自然语言。
- TestRail 一类测试管理工具的 test result 提交通常要求每条测试有明确 status。SkillHub 的手工测评 UI 已经要求每条 case 选择通过或不通过，API 也应该收紧到同一语义。

## 方案

### 行为规则

对 `POST /api/eval-runs`：

1. 先解析 `variant_version_id` 和 `eval_set_version_id`，并保持现有 not found / cross-skill 错误优先级。
2. 读取目标 `EvalSetVersion` 的 `case_version_ids`。
3. `results` 的 key 集合必须与 `case_version_ids` 完全一致。
4. 缺失 case version 返回 `FieldInvariantError`：
   - `field`: `results.<case_version_id>`
   - `message`: `确认该测试用例通过或不通过。`
   - `code`: `eval_run.result_required`
5. 不属于当前 eval set version 的 key 返回 `FieldInvariantError`：
   - `field`: `results.<case_version_id>`
   - `message`: `测试结果不属于当前 EvalSetVersion。`
   - `code`: `eval_run.result_unexpected`
6. 如果同时有缺失和多余 key，一次返回全部 `field_errors`，方便 API client 一次修正。
7. `results` 的 value 继续由 Pydantic 要求为 JSON boolean，不做字符串隐式转换。

### 前端影响

当前手工测评 UI 已经在 `recordEvalRun()` 中检查所有 case 都有 `boolean` 草稿，并提交完整 `results` map。因此本轮不改 UI，只增加 API / repository 防线和文档说明。

如果未来把测评结果编辑成表格型 form，可以复用同一字段路径：

```text
results.casever-auth-v1
```

### 文档影响

- `docs/api-contract.md` 删除“未提供的 case 默认 false”的描述，改为“必须完整提供每条 case 的结果”。
- README 表单/字段错误说明中补充 `results.<case_version_id>` 这类嵌套字段错误。
- 产品完成度审计记录 TASK-069 的增量验证。

## 成功标准

1. API 红测先证明缺失 case result 当前会被接受或静默记 false。
2. 绿色后缺失 case result 返回 `400`，包含 `field_errors[0].field = results.<missing_case_version_id>` 和 `code = eval_run.result_required`。
3. 绿色后未知 case result 返回 `400`，包含 `code = eval_run.result_unexpected`。
4. 仓储层也有同等 invariant 测试，避免绕过 API 时写入脏 `CaseResult`。
5. 现有前端手工测评闭环不受影响，全量 API、Web unit、typecheck、build、audit、E2E、diff check 和任务 JSON 检查通过。

## 非目标

- 不实现 `POST /api/eval-result-imports`。
- 不改变 run matrix、history 或 comparison 的读取模型。
- 不新增前端结果表格编辑器。
- 不引入 JSON Pointer 新字段；本轮先保持 `field_errors.field` 的兼容契约。

## 参考

- JSON:API Error Objects: <https://jsonapi.org/format/#error-objects>
- RFC 9457 Problem Details: <https://www.rfc-editor.org/rfc/rfc9457>
