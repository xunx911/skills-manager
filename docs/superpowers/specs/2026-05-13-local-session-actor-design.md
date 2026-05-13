# 本地 Session Actor 设计

日期：2026-05-13

## 背景

当前后端已经不信任 JSON body 里的 `actor`，但前端仍在每个 mutation 上硬编码 `X-SkillHub-Actor: product-operator`。这比 body actor 好，但仍然是客户端直接声明身份。成熟产品应该把身份来源收敛到服务端 session/token；本轮先做本地 session actor，为后续 OIDC/SSO 留出边界。

## 外部实践

- OWASP Session Management 建议 session identifier 使用 `HttpOnly`、`Secure`、`SameSite` 等 cookie 属性，避免 JavaScript 直接读取 session。适配到 SkillHub：本地 actor token 用后端签名 cookie，前端只调用 session endpoint，不拼 actor header。来源：<https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html>
- MDN Set-Cookie 说明 `HttpOnly` 会阻止 JavaScript 读取 cookie，`SameSite` 能降低跨站请求风险；跨 origin fetch 要带 credentials 才会保存和发送 cookie。适配到 SkillHub：API 开启本地 CORS credentials，前端 fetch 使用 `credentials: "include"`。来源：<https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite>
- MDN Secure cookie configuration 建议 session cookie 使用 `HttpOnly`、`SameSite`，生产环境使用 `Secure` 和 host-only 范围。适配到 SkillHub：本地 HTTP 默认 `secure=false`，生产可通过 `SKILLHUB_SESSION_COOKIE_SECURE=1` 打开。来源：<https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Cookies>

## 方案

采用“后端签名 cookie + 本地 actor switcher”：

- 后端新增 `skillhub_actor` cookie，内容是 `actor.signature`，signature 用 HMAC-SHA256 和 `SKILLHUB_SESSION_SECRET` 签名。
- `actor_dependency` 优先读取 cookie；如果没有 cookie，兼容读取 `X-SkillHub-Actor`；两者都没有时仍使用 `product-operator`，保证一键启动可用。
- 如果 cookie 存在但签名无效，直接返回 400，不回退 header。
- 新增 `/api/session`：
  - `GET` 返回当前 actor。
  - `POST` 接收 `{ "actor": "release-manager" }`，校验 actor 格式后设置 cookie。
  - `DELETE` 清除 cookie。
- 前端新增 `LocalSessionPanel`，展示当前 actor，并允许切换本地 actor。`apiSend` / client `apiGet` 使用 `credentials: "include"`，删除硬编码 actor header。

## 非目标

- 不做 OAuth/OIDC/SSO。
- 不做密码、用户表、session 表。
- 不做 CSRF token；当前本地 CORS 只允许 localhost/127.0.0.1，后续正式部署需要补 CSRF 或 BFF 策略。

## 测试策略

- API 测试：`POST /api/session` 后创建 skill，owner 是 cookie actor；没有 cookie 时仍回退默认 actor；篡改 cookie 返回 400。
- E2E 测试：用户在 LocalSessionPanel 切换 actor 后导入 skill，访问控制面板显示新 actor 为 Owner。
- 视觉回归：新增 local session panel snapshot。
