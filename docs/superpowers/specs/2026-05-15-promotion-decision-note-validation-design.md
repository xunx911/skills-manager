# Promotion decision note 字段级校验设计

## 背景

`promotion` 是把某个 candidate variant version 设为当前分发版本的发布动作。当前 risky promotion 已要求填写 `decision_note`，但主要依赖按钮禁用和 repository invariant；如果绕过前端或填写超长说明，用户不能稳定地在表单字段旁看到可修正错误。发布证据应该短、可审计、可回放，错误也应该贴近输入字段。

## 外部依据

- GOV.UK Error Summary 要求提交失败后展示错误摘要，并链接回具体字段：https://design-system.service.gov.uk/components/error-summary/
- GOV.UK Validation pattern 建议提交后验证、保留用户输入，并把焦点移到错误摘要：https://design-system.service.gov.uk/patterns/validation/
- GOV.UK Textarea pattern 要求多行文本字段也有清晰 label 和错误状态：https://design-system.service.gov.uk/components/textarea/
- GitHub protected branches 把发布前检查、评审和状态检查作为合并门禁：https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches

## 方案

- `PromoteVariantVersionPayload.decision_note` 增加 1000 字符上限，超长返回 `field_errors.decision_note`。
- 当 promotion review 有风险且 `decision_note` 为空时，repository 返回字段错误 `promotion.decision_note_required`，字段为 `decision_note`。
- `PromotionReviewPane` 的底部决策表单接入 `ValidatedForm` 和共享 `TextAreaField`。
- risky 状态下不再用禁用按钮解释缺失说明；允许提交，由 `ValidatedForm` 显示错误摘要、字段旁错误、`aria-invalid` 和摘要链接回焦。
- `promoteFromReview` 对 API 字段错误重新抛给表单；非字段错误继续走全局 notice。

## 范围

本阶段覆盖：

- `POST /api/variants/promotions` 的 `decision_note` 必填和长度字段错误。
- Promotion review 底部决策表单的本地 required 错误和服务端超长错误回填。
- API 与 E2E 红绿测试。
- README、API contract、产品审计和任务记录更新。

暂不覆盖：

- 字符计数器。
- promotion decision note 历史编辑。
- diff viewed state 服务端持久化。
- 真实认证。

## 验收

- API 红测先失败于 risky promotion 空说明缺少 `field_errors.decision_note`，以及 1001 字符说明被接受。
- E2E 红测先失败于 risky promotion 空说明按钮仍 disabled，无法显示 `.promotionDecisionBar .formErrorSummary`。
- 绿色后：空说明提交显示 `填写设为当前版本说明。`；超长说明显示 `设为当前版本说明最多 1000 个字符。`；两种错误都标记同一个 textarea，摘要链接能回焦。
