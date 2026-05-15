# 保存视图名称字段级校验设计

## 背景

History / Run matrix 已经支持保存筛选视图，但 `保存为` 名称目前仍是薄弱点：前端只靠按钮禁用挡空值，后端重复名称只返回全局错误，超长名称没有明确上限。用户在保存常用矩阵视角时，如果误用重复名或粘贴过长文本，应该直接看到字段旁错误，而不是读一个和输入框脱节的 toast。

## 外部依据

- GOV.UK Error Summary 要求验证失败时同时显示顶部错误摘要和字段旁错误，摘要链接应指向对应字段：https://design-system.service.gov.uk/components/error-summary/
- GOV.UK Validation pattern 建议提交后再验证，保留用户已输入内容，并把焦点移到错误摘要：https://design-system.service.gov.uk/patterns/validation/
- GOV.UK Character count 指出只有在有技术或产品理由时才限制字符数，且不要静默截断用户输入：https://design-system.service.gov.uk/components/character-count/
- MOJ Alert 指南明确警告不要用普通 error alert 处理表单验证错误，应继续使用字段级错误消息：https://design-patterns.service.justice.gov.uk/components/alert/

## 方案

本阶段只处理 saved run view name，不扩大到所有产品字段：

- `CreateSavedViewPayload.name` 增加服务端上限：80 字符。
- 空白名称、重复名称和超长名称都返回字段 `name`，让前端可以回填到 `保存视图名称`。
- 重复名称继续由 repository 捕获唯一约束，但改为 `FieldInvariantError`，返回稳定 code `saved_view.name_conflict`。
- 前端 `SavedRunViews` 改用 `ValidatedForm`，保存按钮走 submit；重复名或超长名由现有 `field_errors` 机制显示错误摘要、字段旁错误和 `aria-invalid`。
- 不增加实时 character counter。这个字段是短名称，提交后字段级错误足够，实时计数会让简单保存动作显得笨重。

## 范围

本阶段覆盖：

- `POST /api/saved-views` 的 `name` 长度、空白和重复字段错误。
- History 页保存视图表单的错误摘要和字段回填。
- API 与 E2E 红绿测试。
- README、体验审计、完成度审计和任务记录更新。

暂不覆盖：

- 保存视图重命名。
- 保存视图服务端分页。
- 其他 note / reason / summary 字段的长度上限。
- 服务器端个性化 command menu。

## 验收

- API 红测先失败于重复 saved view 只有 `detail` 没有 `field_errors`，超长名称不会被拒绝。
- E2E 红测先失败于保存重复名称后 `.savedRunViews .formErrorSummary` 不存在。
- 绿色后重复名称和超长名称都能定位到 `name` 字段；前端保留用户输入并把焦点移到错误摘要，摘要链接能回到 `保存视图名称` 输入框。
