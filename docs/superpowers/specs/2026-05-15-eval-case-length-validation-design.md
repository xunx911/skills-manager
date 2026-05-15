# Eval case 文本长度校验设计

## 背景

测评集是 SkillHub 可靠性的核心资产。当前前端会要求 case 标题、Input 和 Expected output 非空，但直连 API 仍可以写入超长标题、超大 expected output 或过长 notes。这样会带来三个问题：列表和详情页难以扫读、artifact 存储被误用成大文件通道、后续测评结果和 diff 页渲染压力变大。

## 外部依据

- GOV.UK / MOJ form validation：错误应在提交后清晰指出字段，而不是提前打扰输入。
- MDN Constraint validation：客户端校验能改善体验，但服务端仍必须是权威规则来源。
- GitHub / Linear 类工作流产品：标题用于列表扫描，正文承载长上下文；产品应限制标题长度，但给正文足够空间。

## 方案

只约束 eval case 相关写入路径，不扩大到所有产品字段：

- `title` 最多 160 个字符，用于列表、case 详情 header 和 run matrix 行标题。
- `input_text` 最多 20000 个字符，允许常见 diff / prompt /上下文。
- `expected_output` 最多 10000 个字符，允许详细判定标准，但避免误粘贴整份日志。
- `notes` 最多 2000 个字符，保留来源、维护说明和风险备注。

服务端通过 Pydantic `Field(max_length=...)` 实施规则，沿用 `detail + field_errors`：

- 单条 case 或 case version 更新返回 `title`、`input_text`、`expected_output`、`notes`。
- 批量 case 返回 `cases[n].field`。
- 中文文案明确上限，例如 `标题最多 160 个字符。`、`第 1 行 Input 最多 20000 个字符。`

## 范围

本阶段覆盖：

- `POST /api/eval-cases`
- `POST /api/eval-cases/batch`
- `POST /api/eval-case-versions`
- `PATCH /api/eval-cases/{case_id}`

暂不覆盖：

- 前端 `maxlength` 字符计数器。
- 自动截断。超限必须失败，避免用户误以为完整内容已保存。
- Skill/Variant/Promotion 其他字段的长度约束。

## 验收

- API 红测覆盖单条 case 过长标题、批量 case 过长 input、case version 过长 expected output。
- 绿色后错误响应包含稳定 `field_errors`、中文上限文案和 `request.string_too_long`。
- 既有批量行级错误和 tags 映射测试继续通过。
