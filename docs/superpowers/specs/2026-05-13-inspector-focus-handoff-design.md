# Inspector Action 焦点交接设计

日期：2026-05-13

## 背景

SkillHub 工作台已经有 skip link、可见 focus ring、命令菜单 trap 和 Run matrix 表格语义。但完成度审计仍保留“完整 focus order”缺口。当前三栏布局中，用户在左侧 catalog 或 `Cmd/Ctrl+K` 触发 `导入 bundle`、`新建 skill`、`添加 case` 等 action 后，右侧 Inspector 会切换表单；如果焦点仍停在旧触发按钮，键盘用户需要继续 Tab 很长一段才能到达刚刚请求的表单。这个顺序虽然不一定破坏 DOM，但会让操作意图和焦点位置脱节。

## 外部实践

- WCAG 2.4.3 Focus Order 要求焦点顺序保留意义和可操作性；动态界面不能让用户在触发某个操作后迷失。适配到 SkillHub：用户显式触发 Inspector action 后，焦点应进入该 action 的表单。来源：<https://www.w3.org/WAI/WCAG22/Understanding/focus-order>
- WAI-ARIA APG Keyboard Interface 强调 tab sequence 和读屏阅读顺序应保持逻辑、可预测；复合组件内部可管理焦点，但不要靠正 `tabindex` 重排页面。适配到 SkillHub：只对动态出现的 Inspector 表单做一次程序化 focus，不创建全局 Tab 顺序。来源：<https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/>
- Vercel Web Interface Guidelines 强调准确名称、键盘可操作和在 accessibility tree 中验证。适配到 SkillHub：用 Playwright role/label 断言表单字段真正获得焦点，不只验证 CSS。来源：<https://vercel.com/design/guidelines>

## 方案

1. 在 `DecisionWorkbench` 中增加 `inspectorFocusRequest` 计数器。
2. `chooseAction(action, { focusInspector })` 默认触发一次 focus handoff；初始空数据加载和普通 skill 切换显式传 `focusInspector: false`。
3. `Inspector` 接收 `actionFocusRequest`。当计数器变化时，在下一帧查找当前 `.inspectorForm` 中第一个可操作控件并 focus。
4. 不使用正 `tabindex`，不在初始页面加载抢焦点，不把所有静态内容放入 Tab 序列。
5. E2E 覆盖两条路径：
   - catalog `导入` button -> Inspector `owner_ref` 输入框获得焦点。
   - command menu 搜索 `添加 case` -> Inspector `title` 输入框获得焦点。

## 非目标

- 不做全站人工读屏验收。
- 不改变三栏布局和 Inspector 内容。
- 不接入真实认证。
- 不重写所有焦点路径；本轮只锁住动态 action handoff。

## 验收

- 新增 E2E 先红后绿，证明当前缺口确实存在。
- 完整验证通过：API pytest、web typecheck、web build、web E2E、`git diff --check`。
