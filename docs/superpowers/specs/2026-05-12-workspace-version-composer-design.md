# 主工作区追加版本设计

日期：2026-05-12

## 背景

SkillHub 当前已经能导入标准 Skill bundle、追加候选版本、测评 candidate、进入 promotion review。但“追加版本”仍主要藏在右侧 inspector 表单里。对一个 skill 管理平台来说，版本维护是核心动作，不应该像次级设置一样躲在侧边栏。

## 外部实践

- Linear 的创建 issue 文档强调常用创建动作有快捷键、顶部按钮、全屏创建等多个入口：<https://linear.app/docs/creating-issues>。适配到 SkillHub：追加版本应出现在用户正在查看 variant/version 的主面板。
- Airtable record detail layout 支持在记录详情中配置字段、按钮和动作，让用户围绕当前记录完成工作：<https://support.airtable.com/docs/es/airtable-interface-layout-record-detail>。适配到 SkillHub：variant card 附近应能直接追加该 variant 的新版本。
- Vercel import project 流程是“选择项目 -> 配置 -> 生成部署/预览”：<https://vercel.com/docs/getting-started-with-vercel/import>。适配到 SkillHub：追加版本应明确表达“选择 variant -> 上传 bundle -> 生成候选版本 -> 进入测评”。

## 设计目标

1. `变体` 主面板顶部增加一个版本追加 composer。
2. composer 支持选择 variant、上传标准 Skill 文件夹、填写 change summary、选择是否设为 current。
3. 默认不设为 current，把新版本当候选版本，保存后沿用现有交接：自动切到 `测评`，并选中新 candidate 作为 exact 测评目标。
4. 旧 inspector `追加版本` 入口继续保留，避免破坏现有路径和测试。
5. 不新增后端能力。所有写入仍走现有 `POST /api/variant-versions`。

## 非目标

- 不做多步骤 wizard。当前只需要把核心动作放到主上下文中，而不是增加流程页。
- 不做批量追加多个版本。
- 不做权限和审批。后续会和 promotion/accepted verification 的 scoped role 一起处理。

## 交互细节

- composer 标题为 `追加候选版本`，说明上传标准 Skill bundle 后会生成不可变版本。
- 默认选择 default variant；如果有多个 variant，用户可以切换。
- `设为 current` 默认不勾选，因为候选版本应先测评再 promotion。
- 保存 candidate 成功后展示现有 notice，并跳转到 `测评` 页的 candidate banner。
- 文件夹和 zip 互斥校验仍由 `createVariantVersion` 的现有逻辑负责。

## 测试策略

- 新增 E2E：导入 skill -> 打开 `变体` -> 使用主区 composer 上传新 bundle -> 不勾选 current -> 保存 -> 断言页面进入 `测评`、candidate banner 显示 v2、测评目标选择 v2。
- 完整回归继续跑 API pytest、web typecheck、web build、Playwright E2E 和 `git diff --check`。
