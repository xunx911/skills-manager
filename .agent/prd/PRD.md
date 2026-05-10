# SkillHub 设为当前版本评审 PRD

## 目标

把 `Variant.current_version_id` 的移动从普通更新升级为可验证、可解释、可审计的评审流程。

用户在设为当前版本前应能看到：

- 当前版本和候选版本分别是什么。
- 候选版本相对当前版本改了哪些 skill 文件。
- 候选版本在什么 `EvalSetVersion` 上完成了测评。
- 每条 case 相对当前版本是修复、回退、稳定通过、仍未通过，还是缺少对照。
- 是否可设为当前版本；如果有风险，为什么仍要接受。
- 设为当前版本后留下结构化决策记录。

## 范围

第一版只做单用户本地工作台，不做多人审批、权限、灰度、线上监控、自动优化或复杂策略规则。

详细规格见：

- `docs/superpowers/specs/2026-05-09-promotion-decision-surface-design.md`

## 验收

- 后端提供 promotion review read model。
- 后端提供 promotion command，并写入 `promotion_decisions` 与 `audit_events`。
- 前端在 skill/variant 工作台内提供“设为当前版本评审”入口。
- 评审界面展示文件 diff、case 对比、准备情况和确认理由。
- 测试覆盖无回退、有回退、未验证、证据不匹配、理由缺失、成功设为当前版本。
- README、API 契约和产品审计文档用中文更新。
