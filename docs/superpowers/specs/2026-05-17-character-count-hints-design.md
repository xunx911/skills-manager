# 低频长文本字符计数设计

日期：2026-05-17

## 背景

SkillHub 已经为 variant summary、version change summary、accepted verification note 和 promotion decision note 增加了服务端长度上限，并能把超限错误回填到字段。但用户只有提交后才知道自己超了多少，这对低频但重要的审计/发布说明不够顺手。

本轮只做“上限可见性”：让有明确服务端上限的低频长文本字段在输入时显示剩余或超出字符数。不新增校验规则，不截断用户输入，不改变服务端权威校验。

## 借鉴实践

- GOV.UK Character count 强调字符上限必须有明确理由，并且组件应该告诉用户还剩多少或超出多少，而不是静默截断。
- Material Design text field 的 character counter 放在 helper/supporting text 区域，属于字段局部辅助信息，不应该升级成全局通知。

SkillHub 的适配：

- 只给短审计说明类字段显示计数：variant summary、change summary、verification note、promotion decision note。
- 不给 case input / expected output 这类长资产字段显示实时计数；它们的上限是资产保护，不是用户日常精确经营的短文本。
- 不设置 HTML `maxLength`，避免浏览器截断用户输入；超限仍由后端返回字段错误，前端计数只做预防提示。

## 方案

为共享 `TextAreaField` 增加可选 `characterLimit`：

- 未传入时行为不变。
- 传入时，在字段下方显示：
  - 未超限：`还可输入 N 个字符`
  - 超限：`已超出 N 个字符`
- 计数节点加入 `aria-describedby`，聚焦 textarea 时辅助技术能读到当前限制。
- 超限时只改变计数文本颜色，不自动标记 `aria-invalid`；真正的 invalid 仍来自 `ValidatedForm` 字段错误。

## 首批接入字段

| 页面 | 字段 | 上限 |
| --- | --- | --- |
| Launchpad 新建 skill | 简介、初始版本说明 | 1000 |
| Inspector 新建 skill / variant / version | 简介、说明、版本说明、初始版本说明 | 1000 |
| 变体主区新建 variant | Summary、Change summary | 1000 |
| 变体主区追加候选版本 | Change summary | 1000 |
| History run comparison | Verification note | 1000 |
| Promotion review | 设为当前版本说明 | 1000 |

## 成功标准

1. 打开 `变体` 页的新建约束 variant composer，Summary 字段显示 `还可输入 1000 个字符`。
2. 输入 1001 个字符后，同一字段显示 `已超出 1 个字符`。
3. 字符计数的 DOM id 出现在 textarea 的 `aria-describedby` 中。
4. 现有字段错误摘要、字段旁错误和后端超限回填仍然通过 E2E。
5. 全量 API、Web unit、typecheck、build、audit、E2E、diff check 和任务 JSON 检查通过。

## 非目标

- 不做通用字符计数器配置面板。
- 不给所有 text input 加计数。
- 不截断输入。
- 不改变服务端字段上限。
- 不做多语言 pluralization 抽象；中文文案固定为“个字符”。
