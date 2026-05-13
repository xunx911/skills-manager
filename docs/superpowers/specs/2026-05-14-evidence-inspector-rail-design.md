# 证据视图 Inspector Rail 设计

## 背景

`docs/product-ux-friction-audit-2026-05-14.md` 指出：1280px 桌面宽度下，工作台固定三栏 `292px / 1fr / 372px` 会让 promotion、diff、history、audit 这类证据视图偏窄。用户在这些模式里的主要任务是看 diff、run matrix、case impact 或 audit payload，而不是持续操作右侧表单。

本轮只解决中等桌面宽度的空间分配，不做全局 drawer、不改 API、不引入复杂 inspector 状态机。

## 借鉴与适配

- Linear 的项目/issue 工作台会根据上下文把详情和操作分离；在需要看列表、活动或关系图时，主内容优先。
- GitHub PR review 把文件 diff 作为主工作面，右侧辅助信息不能抢走代码审查空间。
- Vercel deployment / promotion 流程强调先 inspect/test/log，再 promote；SkillHub 的 promotion review 也应该优先展示证据，而不是普通设置表单。

适配到 SkillHub：`overview/variants/evals` 继续使用完整 inspector，因为它们仍有创建和设置动作；`diff/history/audit/promotion` 在 1041-1440px 下使用 compact verification rail，只保留当前验证分数/状态。

## 产品行为

- 1280px 左右的桌面宽度中，进入 `history` 后 inspector 宽度不超过 128px，主工作区大于 850px。
- `overview` 仍保留 320px 以上的完整 inspector，不影响导入、创建、session 和低频设置。
- compact rail 隐藏 `Local session`、`action menu` 和 action forms，保留深色 `Verification` mini card。
- 1040px 以下继续走已有两栏/单栏响应式规则，不叠加 rail。
- 1440px 以上暂时保留完整三栏，避免过度收缩大屏信息。

## 验收标准

- 新增 E2E 证明 overview 完整 inspector 与 history compact rail 的宽度差异。
- promotion review、run comparison、audit explorer 视觉基线更新后非空、不重叠，主证据区更宽。
- 不破坏移动端 first-run 去重。
- 全量验证通过后提交。
