# **Critical Steering Work**

## 当前关键约束

- 不要跳过 `.agent/tasks.json`。每次只处理一个未通过任务，提交后停止。
- 不要把所有 UI 逻辑继续塞进 `decision-workbench.tsx`；promotion review 相关组件放到 `apps/web/components/promotion-review/`。
- 不要把产品文档写成英文；README、规格、计划、审计、API 契约更新默认使用中文。
- 不要提交 `.tools/`、`.data/`、构建产物、Playwright 报告或本机缓存。
- 如果 Docker Sandboxes 内部缺少依赖，优先使用项目既有命令修复：`cd apps/api && uv sync`、`cd apps/web && npm install`。
