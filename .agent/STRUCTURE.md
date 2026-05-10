# 项目结构

只列核心目录，忽略依赖、构建产物和工具缓存。

- `apps/api/`：FastAPI 后端。核心包在 `apps/api/skillhub/`，测试在 `apps/api/tests/`。
- `apps/web/`：Next.js 前端。页面、组件、E2E 和类型检查都在这里。
- `docs/`：中文产品文档、API 契约、架构审计和阶段审计。
- `examples/`：示例 skill bundle。
- `fixtures/`：测试 fixture。
- `schemas/`：标准 skill bundle schema。
- `scripts/dev.sh`：一键启动后端和前端开发服务。
- `.agent/`：Ralph Loop 的任务、提示词、日志和截图目录。
- `ralph.sh`：Ralph Loop 启动脚本。

常用命令：

- 后端测试：`cd apps/api && uv run pytest`
- 前端类型检查：`cd apps/web && npm run typecheck`
- 前端构建：`cd apps/web && npm run build`
- 前端 E2E：`cd apps/web && npm run e2e`
- 一键开发服务：`bash scripts/dev.sh`
