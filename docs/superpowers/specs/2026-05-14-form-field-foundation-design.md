# 表单字段基础件第一阶段设计

## 背景

当前高频写入路径里，`SkillLaunchpad` 和 `WorkbenchInspector` 直接散落大量原生 `<input>` / `<textarea>` / `<select>`。这些控件虽然能用，但字段语义、`autocomplete`、hint、焦点样式和 label 结构靠每个表单各自维护，后续继续加表单会自然腐化。

本轮只做第一阶段：把最核心的导入、新建 skill、variant、version、case 入口收敛到共享字段组件，并把局部 `:focus` 改为 `:focus-visible`。不做全站所有表单迁移，也不重做视觉风格。

## 外部实践

- [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines) 要求 focusable element 有可见 focus ring，优先用 `:focus-visible`，并给 input 设置有意义的 `name` 与 `autocomplete`。
- [MDN autocomplete attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete) 说明 `autocomplete` 是浏览器理解字段语义、决定是否提供自动填充帮助的标准属性。
- [W3C WCAG Focus Visible](https://www.w3.org/TR/UNDERSTANDING-WCAG20/navigation-mechanisms-focus-visible.html) 要求键盘可操作控件在获得焦点时有可见焦点指示。
- [VA.gov Forms Accessibility Guidelines](https://design.va.gov/templates/forms/accessibility-guidelines) 强调 label、instructions 和 error message 必须和字段建立程序化关联。

## 产品设计

第一阶段新增 `WorkbenchField` 系列组件：

- `TextField`: 负责 label、input、hint、`aria-describedby`、默认 `autoComplete="off"`。
- `TextAreaField`: 负责 label、textarea、hint、`aria-describedby`、默认 `autoComplete="off"`。
- `SelectField`: 负责 label、select、hint、`aria-describedby`。
- `FileField`: 负责 file input 的 label/hint 结构，保留 `webkitdirectory` / `directory` 这类目录上传属性。

为什么默认 `autocomplete="off"`：SkillHub 的 `owner_ref`、`tags`、`slug`、`variant_label`、`change_summary` 等都是产品内业务字段，不应该被浏览器姓名、邮箱、地址、公司等个人资料误填。后续如果接入真实登录、邮箱、组织账单信息，再对那些字段使用 `email`、`organization`、`name` 等语义值。

## 范围

本轮迁移：

- `apps/web/components/skills/skill-launchpad.tsx`
- `apps/web/components/inspector/workbench-inspector.tsx`

本轮不迁移：

- `QuickAddCases`、`EvalCaseDetailPanel`、`SkillSettingsPanel`、`SkillAccessPanel`、History filters、Run matrix controls。它们留给后续批次，避免一次性改动过大。

## 验收标准

- E2E 证明 first-run `SkillLaunchpad` 的 owner/tags/variant/slug/summary 等业务字段显式 `autocomplete="off"`。
- E2E 证明 inspector 的导入表单 owner/tags/variant 字段显式 `autocomplete="off"`，且焦点仍会交接到 owner 字段并显示可见焦点。
- 现有导入 bundle、新建 skill、添加 case、手工测评流程不回归。
- `SkillLaunchpad` 和 `WorkbenchInspector` 不超过项目文件大小边界。
- 更新 README、产品体验评审、完成度审计和任务日志。
