# Local Login Gate 设计

日期：2026-05-17

## 背景

SkillHub 已经把 actor 从 mutation body 收敛到请求级 `ActorContext`，并用签名 HttpOnly cookie 保存本地 actor。但右侧 `Local session` 仍然允许任意输入 actor 后直接切换，这对 demo 很方便，却不像一个成熟产品：用户无法区分“真正登录”与“开发期模拟身份”，权限测试也容易被误读。

本轮不直接接 OIDC/JWT。真实身份系统牵涉用户目录、token rotation、org membership、邀请和审计保留策略，不适合塞进一个小任务。第一阶段先把“自由切换 actor”变成“本地登录码门禁”，让 UI 体验和 API 边界更接近后续真实登录。

## 外部实践

- OWASP Session Management 建议 session id 由服务端签发，并使用 `HttpOnly`、`Secure`、`SameSite` 等 cookie 属性降低泄露风险。来源：<https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html>
- OWASP Authentication 建议认证失败不要泄露过多细节，并且认证和授权要集中处理。来源：<https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html>
- GitHub / GitLab / Linear 这类协作产品都把身份切换表达为 account/session 动作，而不是把 actor 当成普通业务字段。SkillHub 适配为：前端登录本地 actor 后，后续权限仍然只消费后端 capabilities。

## 本轮方案

新增本地登录码：

- `POST /api/session` 请求体从 `{ actor }` 变成 `{ actor, access_code }`。
- `access_code` 与环境变量 `SKILLHUB_LOCAL_SESSION_CODE` 比较；本地默认值为 `skillhub-dev`，保证一键启动仍可试用。
- 比较使用 `hmac.compare_digest`。
- 错误码：错误登录码返回 `403 Invalid local session access code.`。
- 成功后沿用现有签名 `skillhub_actor` HttpOnly cookie。

前端：

- `LocalSessionPanel` 改为“本地登录”语义。
- 表单增加 `access_code` password 字段，并用 `ValidatedForm + WorkbenchField` 展示 required 错误。
- 按钮文案从 `切换 actor` 改为 `登录 actor`。
- 登录成功后继续刷新当前 actor、capabilities 和页面数据。

## 不做

- 不强制所有 API 都必须登录；直接 API 调用仍可用 `X-SkillHub-Actor` 兼容自动化脚本。
- 不做用户注册、密码哈希表、OIDC、JWT、刷新 token 或 org 级 membership。
- 不隐藏本地默认 actor；无 cookie 时仍显示 `product-operator`，这是本地 demo 的降级身份。
- 不把登录码写入审计 payload。

## 成功标准

1. `POST /api/session` 缺少或错误 `access_code` 不能设置 actor cookie。
2. 正确 `access_code` 能设置 actor cookie，并影响后续创建 skill 的 owner。
3. UI 中切换 actor 必须填写本地登录码，成功后仍展示状态通知。
4. 权限能力 E2E 仍能通过登录到 viewer actor 验证 disabled action。
5. 完整测试、构建、E2E 通过。
