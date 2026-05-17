# Identity Field Validation 设计

日期：2026-05-17

## 背景

SkillHub 已经把高频写入字段逐步迁移到字段级错误体验，但低频身份字段还不够严谨：`owner_ref` 和 role `subject_id` 仍然可以通过 API 写入包含空格、不可查询符号或超长内容的值。成熟产品里，身份引用会进入 catalog、审计日志、capability 展示和权限判断，不能让脏数据靠后续人工清理。

本轮不做真实认证，也不引入用户目录。目标是先定义“本地身份引用”的稳定格式，让当前单用户/本地账号阶段的数据保持可迁移、可搜索、可审计。

## 外部实践

- GitHub username / handle 这类协作产品身份标识通常避免空格，偏向可 URL 化、可搜索、可复制的短 token。SkillHub 适配为：本地身份引用允许字母、数字、点、下划线、`@` 和连字符，兼容用户名、服务账号和 email-like actor。
- GOV.UK / MOJ 表单错误模式要求错误摘要和字段旁错误一致，并把焦点带回出错字段。SkillHub 已有 `ValidatedForm + WorkbenchField`，本轮继续复用，不新增特殊交互。
- 当前后端 actor cookie 已使用同类字符规则；`owner_ref` 和 `subject_id` 应与本地 actor 规则对齐，避免“可以登录但不能授权”或“可以授权但不能登录”的割裂。

## 本轮方案

新增共享身份引用类型：

- `IdentityRef = Annotated[str, Field(min_length=1, max_length=120, pattern=IDENTITY_REF_PATTERN)]`
- `IDENTITY_REF_PATTERN = r"^[A-Za-z0-9._@-]{1,120}$"`
- 应用于 `CreateSkillPayload.owner_ref`、`ImportSkillPayload.owner_ref`、`UpdateSkillPayload.owner_ref` 和 `AssignSkillRolePayload.subject_id`。

错误文案：

- `owner_ref`：`归属只能使用字母、数字、点、下划线、@ 和连字符，最多 120 个字符。`
- `subject_id`：`成员只能使用字母、数字、点、下划线、@ 和连字符，最多 120 个字符。`

前端：

- `SkillSettingsPanel` 改为 `ValidatedForm`，让保存 skill 设置时的 `owner_ref` API 字段错误回到 `归属` 字段。
- `SkillAccessPanel` 改为 `ValidatedForm`，让添加成员时的 `subject_id` API 字段错误回到 `成员` 字段。
- `DecisionWorkbench.assignSkillRole` 对 API field errors 使用 `rethrowFieldErrors`，与其他已迁移表单一致。

## 不做

- 不新增用户目录、自动补全、邀请流程、OIDC/JWT 或 service account 管理。
- 不校验 `owner_ref` 必须存在，因为当前还没有真实 identity store。
- 不修改历史数据；本地 seed 和测试数据已经符合新规则。
- 不改变 `X-SkillHub-Actor` fallback 和本地登录码门禁。

## 成功标准

1. API 创建/导入/更新 skill 时，非法 `owner_ref` 返回 `422 + field_errors.owner_ref`。
2. API 添加 role assignment 时，非法 `subject_id` 返回 `422 + field_errors.subject_id`。
3. 概览页 `身份与默认分发` 保存非法归属时显示 error summary，`归属` 字段 `aria-invalid=true`。
4. 概览页 `访问控制` 添加非法成员时显示 error summary，`成员` 字段 `aria-invalid=true`。
5. 完整后端、前端、E2E、构建和文档校验通过。
