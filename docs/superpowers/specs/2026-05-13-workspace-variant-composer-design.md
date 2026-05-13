# 主工作区创建 Variant 设计

日期：2026-05-13

## 背景

SkillHub 现在已经能在 `变体` 主工作区追加候选版本，但创建新的 variant 仍主要依赖右侧 inspector。variant 是 SkillHub 的核心概念：它表达某组 tags 约束下的人为维护最优解。因此创建 variant 的动作应该靠近 variant map 和历史版本，而不是藏在设置侧栏。

## 外部实践

- Linear 将创建 issue 视为最高频动作，提供顶部入口、快捷键 `C`、全屏创建和模板创建。适配到 SkillHub：创建 variant 应在 `变体` 工作区可见，继续保留命令菜单和 inspector 作为备选入口。来源：<https://linear.app/docs/creating-issues>
- Figma variants 用属性和值表达组件变体，并要求同一 component set 内每个 variant 是唯一属性组合。适配到 SkillHub：variant 创建表单必须突出 tags，提示 tags 是约束空间，不是开发分支血缘。来源：<https://help.figma.com/hc/en-us/articles/360056440594>
- Airtable record detail layout 支持用户在记录详情上下文中查看字段、历史和按钮动作。适配到 SkillHub：用户在 variant map 附近创建 variant，创建后立刻在同一空间看到新增卡片和版本起点。来源：<https://support.airtable.com/docs/es/airtable-interface-layout-record-detail>

## 设计目标

1. 在 `变体` 主面板增加 `新建约束 variant` composer。
2. 支持填写 label、tags、summary、change summary、是否设为 default。
3. 默认从当前 default variant 的 current version 复制内容引用，让新 variant 的 v1 有真实基线；如果没有 current version，则回退到现有 inline content_ref 摘要。
4. 保留右侧 inspector `新建 variant`，避免破坏命令菜单和老路径。
5. 新增 E2E 覆盖主工作区创建 variant 后，variant map 立即出现新卡片。

## 非目标

- 不新增后端接口。
- 不在创建 variant 时上传新 bundle；上传新版本已经由 `追加候选版本` composer 处理。
- 不实现 tag 唯一性校验 UI。后端目前允许相同 tag 组合，后续再讨论是否强制唯一。
- 不重做整个 variant map 布局。

## 交互细节

- composer 放在 `变体空间` 标题区下方，`追加候选版本` composer 上方；默认折叠成动作条，避免把 variant map 挤出首屏。
- 左侧说明文案强调 `tags = 约束组合`，避免用户把 variant 理解成 Git branch。
- 点击 `新建约束 variant` 后原地展开表单。表单使用两列布局：label/tags 在第一行，summary/change summary 横跨整行，底部放 default checkbox 和创建按钮。
- `从当前版本复制基线` 默认开启；这让新 variant 的第一个版本不是假的空内容，而是有明确来源的可追踪基线。
- 提交成功后沿用现有 notice `Variant 已创建。`，刷新 detail 后新 variant 出现在 map 中。

## 测试策略

- 先新增红色 E2E：导入 skill -> 打开 `变体` -> 使用 `.variantCreationComposer` 填写新 variant -> 创建 -> 断言 `.variantMapCard` 中出现该 variant，并出现 `v1`。
- 完整回归继续跑 API pytest、web typecheck、web build、Playwright E2E 和 `git diff --check`。
