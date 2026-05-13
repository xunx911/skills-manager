# 本地 Session Actor 实施计划

> **给执行代理的说明：** 按任务逐项执行，步骤用 checkbox（`- [x]`）追踪。

**目标：** 用后端签名 cookie 承载本地 actor session，移除前端 mutation 中硬编码的 actor header。

**架构：** 后端 `auth.py` 负责签名、校验和 cookie 设置；FastAPI 暴露 `/api/session`。前端新增 `LocalSessionPanel`，工作台维护当前 actor 状态，所有 API fetch 使用 credentials。

**技术栈：** FastAPI、HMAC-SHA256、Next.js client components、Playwright E2E、pytest。

---

### Task 1: 红色 API 测试

**涉及文件：**
- 修改：`apps/api/tests/test_api_commands.py`

- [x] **步骤 1：写 session cookie 测试**

新增测试：无默认 header 的 TestClient 调用 `POST /api/session` 设置 actor，再创建 skill，断言 owner role 是 session actor。

- [x] **步骤 2：写 tamper 测试**

新增测试：手工设置坏 cookie 后调用 mutation，返回 400，错误包含 invalid session。

- [x] **步骤 3：验证红灯**

运行：

```bash
cd apps/api && uv run pytest tests/test_api_commands.py -k "session_actor" -q
```

预期失败，因为 session endpoint 和 cookie dependency 尚未实现。

### Task 2: 后端 session actor

**涉及文件：**
- 修改：`apps/api/skillhub/api/auth.py`
- 修改：`apps/api/skillhub/api/main.py`

- [x] **步骤 1：实现签名工具**

在 `auth.py` 增加 actor 校验、HMAC 签名、校验、set/delete cookie helper。

- [x] **步骤 2：扩展 actor_dependency**

优先读取 `skillhub_actor` cookie；没有 cookie 再读 `X-SkillHub-Actor`；cookie 无效时抛 `InvariantError`。

- [x] **步骤 3：新增 session endpoints**

`GET /api/session`、`POST /api/session`、`DELETE /api/session`。

- [x] **步骤 4：开启本地 credentials CORS**

`allow_credentials=True`。

- [x] **步骤 5：验证 API 绿色**

运行：

```bash
cd apps/api && uv run pytest tests/test_api_commands.py -k "session_actor" -q
```

### Task 3: 前端 session 面板

**涉及文件：**
- 新增：`apps/web/components/session/local-session-panel.tsx`
- 修改：`apps/web/components/decision-workbench.tsx`
- 修改：`apps/web/app/globals.css`

- [x] **步骤 1：新增 LocalSessionPanel**

显示当前 actor，提供输入框和 `切换 actor` 按钮。

- [x] **步骤 2：工作台加载 session**

`DecisionWorkbench` mount 时 `GET /api/session`，切换时 `POST /api/session` 后刷新当前 skill。

- [x] **步骤 3：移除硬编码 header**

删除 `ACTOR` 常量；`apiSend` 不再发送 `X-SkillHub-Actor`，改为 `credentials: "include"`；client `apiGet` 同样带 credentials。

- [x] **步骤 4：样式**

新增 `.localSessionPanel` 样式，放在 inspector verification 后，作为低频本地开发身份设置。

### Task 4: E2E、视觉、文档和提交

**涉及文件：**
- 修改：`apps/web/e2e/skills-workbench.spec.ts`
- 修改：`apps/web/e2e/visual-workbench.spec.ts`
- 新增：`apps/web/e2e/visual-workbench.spec.ts-snapshots/local-session-panel-chromium-darwin.png`
- 修改：`README.md`
- 修改：`docs/api-contract.md`
- 修改：`docs/product-ux-review.md`
- 修改：`docs/product-completion-audit-2026-05-08.md`
- 修改：`.agent/logs/LOG.md`
- 修改：`.agent/tasks.json`
- 新增：`.agent/tasks/TASK-024.json`

- [x] **步骤 1：写 E2E**

切换 actor 为 `release-manager`，导入 skill，断言访问控制面板显示 `release-manager Owner`。

- [x] **步骤 2：新增视觉基线**

新增 local session panel snapshot。

- [x] **步骤 3：完整验证**

运行：

```bash
cd apps/api && uv run pytest
cd apps/web && npm run typecheck
cd apps/web && npm run build
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e
git diff --check
```

- [x] **步骤 4：提交**

设置 TASK-024 complete / passes true，提交：

```bash
git commit -m "feat: add local session actor"
```
