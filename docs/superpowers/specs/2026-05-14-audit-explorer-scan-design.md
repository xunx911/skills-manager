# Audit Explorer 扫读重构设计

## 背景

`docs/product-ux-friction-audit-2026-05-14.md` 指出当前 Audit Explorer 像“日志查看器”：列表行容易截断，右侧默认展示 Raw JSON，用户必须点开每条才能知道“谁改了什么、影响了谁”。这不符合成熟治理产品的扫读体验。

本轮只做当前 skill 范围内的 Audit Explorer 信息架构重构，不做跨组织审计、导出、SIEM、日期范围、分页或 URL 深链。

## 外部实践

- [Linear Audit Log](https://linear.app/docs/audit-log) 把审计作为 workspace events：先展示 recent events，可按 event type 过滤；复杂查询走 API。
- [GitHub Enterprise audit log](https://docs.github.com/en/enterprise-server@3.20/admin/managing-accounts-and-repositories/managing-users-in-your-enterprise/auditing-users-across-your-enterprise) 强调 audit row 要回答 actor、action、resource 和 time，并支持 actor/action/created 等限定符。
- [Stripe request logs](https://docs.stripe.com/development/dashboard/request-logs) 先提供常用过滤和单条日志下钻，payload 是排障详情，不是列表的第一视觉层。
- [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines) 要求状态可读、长内容韧性、键盘可操作、不要只靠颜色表达状态。

## 产品设计

Audit Explorer 改成三层：

1. **Quick filters:** 从当前事件中提取 action 计数，显示 action chip。点击 chip 会写入已有 `Action filter`，不新增后端契约。
2. **Readable timeline:** 每条事件用两行扫读：action chip、中文动作标题、payload 摘要、actor/resource/time metadata。行内容允许换行，不再把关键字段全部塞进三列 ellipsis。
3. **Structured detail:** 右侧先显示结构化摘要：动作、actor、resource、time、summary，以及 payload 中最重要的键值。Raw JSON 放进 `details` 折叠区，用户需要排障时再展开。

## 文案映射

- `role.assigned` -> `Access role assigned`
- `role.revoked` -> `Access role revoked`
- `skill.archived` -> `Skill archived`
- `variant.promoted` -> `Variant promoted`
- `eval_run.accepted_verification_set` -> `Verification accepted`
- 未知 action 保留原 action。

## 验收标准

- E2E 证明 Audit Explorer 有 `role.assigned` quick filter，点击后 action input 变为 `role.assigned`，列表收窄到对应事件。
- E2E 证明 timeline row 可直接看到可读标题、actor 和 payload 摘要。
- E2E 证明 detail panel 默认显示结构化摘要，不默认展开 Raw JSON；展开 `Raw payload` 后仍能看到原始 payload。
- 更新视觉基线 `skill-audit-explorer.png`，确认 1280px 下不再是 Raw JSON 抢占第一视觉层。
- 更新 README、产品 UX 文档、完成度审计和任务日志。
