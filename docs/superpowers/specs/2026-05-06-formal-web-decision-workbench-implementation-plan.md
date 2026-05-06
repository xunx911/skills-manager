# SkillHub 正式版 Decision Workbench 实现计划

日期：2026-05-06

状态：按已确认 spec 执行

## 目标

把 `/skills` 从普通列表页改成 Decision Workbench：

- 左侧：高密度 skill catalog。
- 中间：当前选中 skill 的用途、默认 variant、使用入口和 bundle 预览。
- 右侧：latest accepted eval run、exact binding、风险提示。
- 底部：variant / eval matrix preview。

## 实现步骤

1. 新增客户端工作台组件，负责 `/skills` 页面的 in-place skill selection。
2. `/skills/page.tsx` 改为加载 skills 与默认 skill detail，然后渲染工作台。
3. 保留现有 detail routes，不改变后端/API 契约。
4. 扩展 CSS，给首页建立独立的 workbench layout 和 evidence rail 视觉语言。
5. 运行 `npm run typecheck` 和 `npm run build` 验证。

## 非目标

- 不做真实 artifact API。
- 不做真实 diff engine。
- 不做多维查询构建器。
- 不做 promotion/auth/permission UI。
- 不把 demo 数据模型扩大成正式后端模型。

## 验收

- `/skills` 在一个屏幕内可看到 catalog、selected skill、evidence、matrix。
- 点击 catalog 行能原地切换选中 skill。
- 默认 variant 像普通 skillhub 一样是主入口。
- 证据区显示 exact VariantVersion + EvalSetVersion 绑定。
- 视觉层级明显优于旧列表页，不再像临时后台。
- `apps/web` 下 typecheck/build 通过。
