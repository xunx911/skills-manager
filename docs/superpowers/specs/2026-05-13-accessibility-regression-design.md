# Accessibility 回归护栏设计

日期：2026-05-13

## 背景

产品完成度审计里仍然把 accessibility 标为薄弱项：现在有键盘 smoke 和部分 label，但缺少系统化的 focus order、screen reader 状态提示和 reduced-motion 验证。SkillHub 是密集工作台，用户会长时间录入 case、切换 tab、查看矩阵和做发布评审；如果键盘路径和焦点反馈不稳定，产品会显得不成熟，也会直接影响可用性。

## 外部实践

- W3C WCAG 2.2 Focus Visible 要求键盘可操作 UI 必须有可见焦点指示，否则依赖键盘的用户不知道当前操作对象。适配到 SkillHub：全局交互元素要有强可见 `:focus-visible`，并用 E2E 检查关键路径上的焦点样式。来源：<https://www.w3.org/WAI/WCAG22/UNDERSTANDING/focus-visible.html>
- W3C Focus Appearance 建议焦点指示至少有清晰轮廓，并强调与相邻颜色有足够对比。适配到 SkillHub：使用双层 focus ring，避免浅蓝半透明边框在白色卡片上不明显。来源：<https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html>
- W3C Animation from Interactions 建议支持用户的 reduced motion 偏好，避免非必要动效造成不适。适配到 SkillHub：`prefers-reduced-motion: reduce` 下把非必要 transition/animation 收敛到近似无动画。来源：<https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html>
- Vercel Web Interface Guidelines 强调 skip link、表单 label、icon button label、`aria-live`、`:focus-visible` 和 `prefers-reduced-motion`。适配到 SkillHub：本轮优先补全可测试护栏，而不是只写文档说明。来源：<https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md>

## 方案

采用“低风险全局增强 + E2E 护栏”：

1. `AppShell` 增加 `跳到主要内容` skip link，指向 `main#main-content`。`main` 使用 `tabIndex={-1}`，让键盘用户进入页面后能直接跳过左侧导航和顶部栏。
2. 全局 `:focus-visible` 改为高对比双层 focus ring：深色外轮廓 + 浅蓝外扩阴影。保留现有局部焦点样式，但不允许局部 `outline: none` 让焦点不可见。
3. 新增 `@media (prefers-reduced-motion: reduce)`，把全局 animation / transition duration 收敛到 `0.01ms`，并关闭 smooth scroll。
4. `linearNotice` 增加 `role="status"` 和 `aria-live="polite"`，让保存、切换 actor、记录测评等异步结果能被读屏软件感知。
5. 新增 Playwright accessibility spec，覆盖：
   - 首次 Tab 聚焦 skip link，Enter 后焦点进入 main。
   - 关键按钮的 computed style 在 keyboard focus 下有 outline 或 box-shadow。
   - `prefers-reduced-motion: reduce` 下关键按钮 transition duration 被压低。
   - 切换本地 actor 后通知区域以 `status` 暴露。

## 非目标

- 不引入完整 axe 扫描依赖。
- 不一次性修完整个工作台的所有 ARIA 模式，例如 command menu 的 combobox/listbox 细节。
- 不重做视觉设计；本轮只补全可访问性护栏和测试。

## 验收

- 新增 E2E 先红后绿。
- `npm run e2e -- accessibility-workbench.spec.ts` 通过。
- 全量 `uv run pytest`、`npm run typecheck`、`npm run build`、`npm run e2e`、`git diff --check` 通过后才能提交。
