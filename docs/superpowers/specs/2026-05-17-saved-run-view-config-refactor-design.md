# Saved run view config helper 重构设计

## 背景

`DecisionWorkbench` 已经承担大量状态编排、API 调用和 mode orchestration。TASK-072 增加 saved view comparison 指针后，saved view config 的构建和读取逻辑继续留在主组件末尾，会让这个文件更难维护。

## 目标

把 saved run view 的 config 读写规则抽成独立 helper，用单元测试锁住行为。主组件只保留“什么时候保存/应用视图”的 orchestration，不再关心 config key 过滤和合法值判断。

## 范围

- 新增 `apps/web/components/saved-views/saved-run-view-config.ts`。
- 新增对应 Vitest 单元测试。
- 抽出以下行为：
  - 构建 saved view config。
  - 从 config 恢复 run filters。
  - 从 config 恢复 Run matrix controls。
  - 从 config 恢复 comparison 指针。
- `DecisionWorkbench` 改为调用 helper。

## 非范围

- 不改变 saved view API 契约。
- 不改变 UI 文案和视觉。
- 不拆分整个 `DecisionWorkbench`。
- 不引入状态管理库。

## 验收

- 单元测试覆盖默认值过滤、非默认矩阵控制、comparison 指针和非法 config 值忽略。
- 保存/应用 saved view 的 E2E 仍通过。
- 完整回归通过。
