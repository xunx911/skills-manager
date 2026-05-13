# Skill 治理与审计面板实施计划

> **给执行代理的说明：** 按任务逐项执行，步骤用 checkbox（`- [x]`）追踪。

**目标：** 把归档、审计和治理状态迁入概览主区，让危险操作有 owner 权限、审计记录和 slug 确认。

**架构：** 后端复用 `audit_events` 表，新增 skill 级 audit read model，并让 `archive_skill` 接收 actor、做 owner 权限检查、写 audit event。前端新增独立 `SkillGovernancePanel`，从 `SkillDetail.audit_events` 和 `role_assignments` 计算治理摘要，归档表单要求输入当前 slug。

**技术栈：** FastAPI、SQLAlchemy Core、Next.js client components、Playwright E2E、pytest。

---

### Task 1: 红色 API 测试

**涉及文件：**
- 修改：`apps/api/tests/test_api_commands.py`

- [x] **步骤 1：写归档权限和审计测试**

新增测试：创建 skill 后授予 `readonly-user viewer`；用 readonly header 删除 skill 返回 403；用 owner 删除返回 200；`GET /api/skills/{skill_id}` 返回 archived，并且 `audit_events[0].action == "skill.archived"`。

- [x] **步骤 2：写 audit events endpoint 测试**

新增测试：授予和撤销 `qa-reviewer evaluator` 后，`GET /api/skills/{skill_id}/audit-events` 返回 `role.revoked`、`role.assigned`，按 created_at 倒序排列。

- [x] **步骤 3：验证红灯**

运行：

```bash
cd apps/api && uv run pytest tests/test_api_commands.py -k "governance or audit" -q
```

预期：失败，因为 audit endpoint、detail 字段和 archive permission 尚未实现。

### Task 2: 后端治理实现

**涉及文件：**
- 修改：`apps/api/skillhub/infrastructure/db/repositories.py`
- 修改：`apps/api/skillhub/api/main.py`
- 修改：`apps/web/lib/types.ts`

- [x] **步骤 1：新增 list_skill_audit_events**

Repository 新增 `list_skill_audit_events(skill_id, limit=10)`，只读取 `resource_type=skill` 且 `resource_id=skill_id` 的事件，按 `created_at desc`。

- [x] **步骤 2：skill_detail 返回 audit_events**

在 `skill_detail` 结果中加入 `audit_events`，默认最近 10 条。

- [x] **步骤 3：archive_skill 加权限和 audit**

`archive_skill(skill_id, actor)` 调用 `_require_skill_permission(..., "role.manage")`，成功后写 `skill.archived` audit event。

- [x] **步骤 4：新增 API endpoint**

`GET /api/skills/{skill_id}/audit-events` 调 repository read model；`DELETE /api/skills/{skill_id}` 使用 `ActorContext`。

- [x] **步骤 5：验证 API 绿色**

运行：

```bash
cd apps/api && uv run pytest tests/test_api_commands.py -k "governance or audit" -q
```

预期：通过。

### Task 3: 前端治理面板

**涉及文件：**
- 新增：`apps/web/components/skills/skill-governance-panel.tsx`
- 修改：`apps/web/components/decision-workbench.tsx`
- 修改：`apps/web/lib/types.ts`
- 修改：`apps/web/lib/empty-state.ts`
- 修改：`apps/web/lib/mock-data.ts`
- 修改：`apps/web/app/globals.css`

- [x] **步骤 1：扩展类型和 mock**

新增 `AuditEvent` 类型；`SkillDetail` 增加 `audit_events: AuditEvent[]`；empty/mock detail 补字段。

- [x] **步骤 2：新增 SkillGovernancePanel**

组件显示 governance posture、audit trail、danger zone。danger zone 用内部 state 存确认 slug，只有等于当前 skill slug 才启用归档按钮。

- [x] **步骤 3：接入 overview 并移除 inspector 归档按钮**

OverviewPane 新增 `onArchiveSkill` prop，在 `SkillAccessPanel` 后渲染 `SkillGovernancePanel`。Inspector 的编辑 skill 表单保留保存按钮，移除普通归档按钮。

- [x] **步骤 4：样式**

新增 `.skillGovernancePanel`、`.governanceSummary`、`.auditTrailList`、`.dangerZone` 等样式，保持与设置/访问控制面板一致，但危险区使用克制红色边框。

### Task 4: E2E、视觉、文档和提交

**涉及文件：**
- 修改：`apps/web/e2e/skills-workbench.spec.ts`
- 修改：`apps/web/e2e/visual-workbench.spec.ts`
- 新增/更新：`apps/web/e2e/visual-workbench.spec.ts-snapshots/skill-governance-panel-chromium-darwin.png`
- 修改：`README.md`
- 修改：`docs/api-contract.md`
- 修改：`docs/product-ux-review.md`
- 修改：`docs/product-completion-audit-2026-05-08.md`
- 修改：`.agent/logs/LOG.md`
- 修改：`.agent/tasks.json`
- 新增：`.agent/tasks/TASK-022.json`

- [x] **步骤 1：写 E2E 红灯**

新增 E2E：导入 skill，治理面板可见；确认输入错误 slug 时归档按钮禁用；输入正确 slug 后归档，catalog 显示空状态。

- [x] **步骤 2：实现后跑局部 E2E**

运行：

```bash
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e -- --grep "governance"
```

- [x] **步骤 3：新增视觉基线**

新增 governance panel visual baseline 并生成 snapshot。

- [x] **步骤 4：完整验证**

运行：

```bash
cd apps/api && uv run pytest
cd apps/web && npm run typecheck
cd apps/web && npm run build
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e
git diff --check
```

预期：全部通过。

- [x] **步骤 5：提交**

设置 TASK-022 complete / passes true，提交：

```bash
git commit -m "feat: add skill governance panel"
```
