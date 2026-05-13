# Skill 治理与审计面板设计

日期：2026-05-13

## 背景

SkillHub 的主工作区已经承担了导入、验证、设置和访问控制，但低频危险操作仍藏在右侧 inspector：`归档 skill` 没有清晰的后果说明，也没有显式 owner 权限保护和审计入口。成熟产品里，危险动作应该低频、可预期、有确认仪式，并且和审计证据放在一起。

## 外部实践

- GitHub 把 archive repository 放在 Settings 的 Danger Zone，并要求用户阅读警告、输入 repository 名称后再确认。适配到 SkillHub：归档 skill 要从普通编辑表单移到主区危险区，要求输入当前 skill slug。来源：<https://docs.github.com/en/enterprise-cloud@latest/repositories/archiving-a-github-repository/archiving-repositories>
- Vercel 在 Project Settings 中把 delete project 放到底部的 Delete Project section，并要求在弹窗里确认项目名。适配到 SkillHub：危险动作不和常规设置按钮混放，必须有单独 visual treatment 和二次确认。来源：<https://vercel.com/docs/projects/managing-projects>
- Linear 的 Audit Log 放在 Workspace Settings > Administration 下，只给 owner 访问，并支持按事件类型、actor、metadata 查询。适配到 SkillHub：本轮先显示最近 skill 级治理事件，后续再扩展过滤和导出。来源：<https://linear.app/docs/audit-log>
- Stripe Workbench 会记录 API 和 Dashboard 发起的请求，并支持按 source、resource ID 和错误筛选。适配到 SkillHub：后续可以把 run、promotion、runner 请求纳入统一 activity log；本轮只先让治理事件可见。来源：<https://docs.stripe.com/development/dashboard/request-logs>

## 方案

采用“主区治理卡片 + 后端审计 read model”的小步方案。

### 后端

- `archive_skill(skill_id, actor)` 要求 actor 在该 skill 上拥有 `owner` 角色。
- 归档成功写入 `audit_events`：`action=skill.archived`、`resource_type=skill`、`resource_id=skill_id`。
- 新增 `GET /api/skills/{skill_id}/audit-events?limit=10`，返回最近 skill 级 audit events。
- `skill_detail` 直接带 `audit_events`，避免概览页再多一次请求。

### 前端

- 新增 `SkillGovernancePanel`，放在概览页 `访问控制` 后面。
- 面板分三块：
  1. `Governance posture`：显示 lifecycle、owner/maintainer 数、最近审计动作。
  2. `Audit trail`：列最近事件的 action、actor、时间和简短 payload 摘要。
  3. `Danger zone`：输入当前 skill slug 后才允许点击 `归档 skill`。
- 右侧 inspector 中的普通 `归档 skill` 按钮移除，避免危险动作和普通编辑混在一起。

### 非目标

- 不做 unarchive。
- 不做全量 audit search/filter/export。
- 不做组织级审计或 SIEM webhook。
- 不把 promotion/accepted verification 事件迁移到 skill resource；这需要单独设计跨资源 activity feed。

## 测试策略

- API 测试：viewer 不能归档 skill；owner 能归档；归档后 skill detail 仍可读且包含 `skill.archived` audit event。
- API 测试：`GET /api/skills/{skill_id}/audit-events` 返回最近 skill 级事件。
- E2E 测试：导入 skill 后概览页出现治理面板；归档按钮在输入错误 slug 时禁用；输入正确 slug 后可归档，catalog 进入空状态。
- 视觉回归：新增 `skill-governance-panel.png`，覆盖面板布局和危险区。
