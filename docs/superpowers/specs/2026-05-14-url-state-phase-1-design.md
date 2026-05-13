# URL State 第一阶段设计

## 背景

产品操作摩擦审计指出：`/skills` 的核心工作状态还停留在本地 React state，用户无法把“某个 skill 的历史页”发给同事，也无法刷新后回到相同上下文。Vercel Web Interface Guidelines 明确建议把 tabs、filters、pagination、expanded panels 等状态放入 URL；GitHub issues/PR 列表也把筛选查询作为可分享 URL。

本轮只做第一阶段：`skill + mode`。更细的 diff pair、history filters、selected run/case、promotion candidate context 留给下一阶段。

## 产品行为

- `/skills?skill=<slug>&mode=history` 会打开指定 skill，并选中 `历史` tab。
- `skill` 支持 slug 或 id；URL 显示时优先写 slug，方便人读和分享。
- `mode=overview` 不写入 URL；其他可分享 mode 写入 `mode`。
- 支持的第一阶段 mode：`overview`、`variants`、`evals`、`diff`、`history`、`audit`。
- `promotion` 不进入第一阶段，因为它需要候选版本、目标测试集和 evidence run 共同确定上下文。
- 用户点击 tab 或切换 skill 后，URL 会同步更新。
- 浏览器 Back/Forward 会按 URL 恢复 selected skill 和 mode。

## 实现边界

- `apps/web/app/skills/page.tsx` 在服务端读取 `searchParams`，从 `listSkills()` 中按 id/slug 匹配初始 skill，并把 `initialSkillId`、`initialMode` 传给 `DecisionWorkbench`。
- `DecisionWorkbench` 用 `history.pushState/replaceState` 同步 URL，不触发整页重取数据。
- `popstate` 监听只恢复第一阶段状态，不解析后续深层状态。

## 验收标准

- E2E 证明直接打开 `/skills?skill=<beta>&mode=history` 不会落到默认 skill 或 overview。
- E2E 证明点击 `历史` 后 URL 出现 `skill=<slug>&mode=history`。
- E2E 证明回到 `概览` 后 URL 保留 skill，但移除 `mode=history`。
- E2E 证明浏览器 Back 可以从 `overview` URL 回到 `history` URL，并恢复 `历史` tab。
- 全量验证通过后提交。
