# 移动端 First-Run Inspector 去重设计

## 背景

产品操作摩擦审计指出：移动端空工作台先展示主区 `SkillLaunchpad`，继续向下又展示右侧 inspector 的完整 `导入标准 Skill` 表单。同一主任务出现两份入口，违背“first-run 只给一个最清晰下一步”的原则。

本轮只解决移动端 first-run 的重复主路径，不处理桌面端证据视图宽度、URL state 或 inspector 全局抽屉化。

## 产品决策

- 空工作台移动端默认保留 `SkillLaunchpad` 作为唯一导入/创建主路径。
- inspector 仍显示 `Verification` 和 `Local session`，因为它们解释当前状态和本地 actor，不是重复主操作。
- inspector 的 action menu 和 action form 在移动端 first-run 初始态折叠。
- 用户如果点击 catalog 的 `导入` / `新建`，或通过命令菜单显式请求 action，inspector 表单重新展开，并沿用已有焦点交接。
- 桌面端保持现状，避免影响已有 keyboard 和 visual 回归。

## 实现边界

- `DecisionWorkbench` 给根节点增加 `data-first-run`，给 inspector aside 增加 `data-action-requested`。
- CSS 只在 `max-width: 900px` 且 `data-first-run="true"`、`data-action-requested="false"` 时隐藏 `.actionMenu` 和 `.inspectorForm`。
- 不引入 viewport JS 监听，不增加全局 drawer 状态；这保持行为简单，也让后续 TASK-041 可以独立设计 inspector 响应式折叠。

## 验收标准

- 移动端空工作台能看到 `SkillLaunchpad` 和导入表单。
- 初始状态下 inspector 内没有可见的 `导入标准 Skill` 表单。
- 点击 catalog `导入` 后 inspector 导入表单可见，焦点进入 `owner_ref`。
- mobile empty 视觉基线更新后不空白、不重叠、不横向溢出。
- 全量验证通过后提交。
