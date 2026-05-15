# Accepted verification note 字段级校验设计

## 背景

`accepted verification` 是把某次 finished eval run 认定为当前 variant 在某个 eval set snapshot 上的可信验证指针。这个动作比普通备注更像发布证据：备注可以为空，但一旦填写，就应该保持短、可扫读、可审计。目前 API 和前端都没有长度上限，也没有把 note 的服务端错误回填到输入框。

## 外部依据

- GOV.UK Error Summary 要求提交失败后把错误汇总放在表单顶部，并链接回具体字段：https://design-system.service.gov.uk/components/error-summary/
- GOV.UK Validation pattern 建议提交后验证、保留用户输入，并把焦点移到错误摘要：https://design-system.service.gov.uk/patterns/validation/
- GOV.UK Character count 指出字符上限应该有明确理由，且不能静默截断用户输入：https://design-system.service.gov.uk/components/character-count/
- MOJ Alert 指南提醒表单验证错误不应该用普通 alert 替代字段级错误：https://design-patterns.service.justice.gov.uk/components/alert/

## 方案

本阶段只覆盖 accepted verification note，不处理 promotion decision note：

- `AcceptEvalRunVerificationPayload.note` 增加 1000 字符上限。
- 超长 note 返回字段 `note`，中文文案 `验证说明最多 1000 个字符。`。
- `RunComparisonPanel` 的 verification pointer 表单接入 `ValidatedForm` 和共享 `TextField`，输入框 `name="note"`，让 API `field_errors.note` 能自动回填。
- `acceptComparisonCandidate` 对 API 字段错误重新抛给表单，其他错误仍走全局 notice。
- 不做实时计数器。1000 字符是保护审计证据可读性的上限，不是用户需要精确经营的短标题。

## 范围

本阶段覆盖：

- `POST /api/eval-runs/accepted-verifications` 的 `note` 长度校验。
- History run comparison 中接受验证依据表单的字段级错误。
- API 与 E2E 红绿测试。
- README、API contract、产品审计和任务记录更新。

暂不覆盖：

- Promotion decision note 字段。
- accepted verification 的撤销或重写。
- 字符计数器。
- 服务器端个性化命令菜单。

## 验收

- API 红测先失败于 1001 字符 note 返回 200。
- E2E 红测先失败于超长 note 后没有 `.runCompareAcceptBar .formErrorSummary`。
- 绿色后前端保留用户输入，错误摘要聚焦，字段旁显示同一条错误，摘要链接能回焦到 `Accepted verification note` 输入框。
