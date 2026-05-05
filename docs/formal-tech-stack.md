# 正式版技术栈建议

本文档定义 SkillHub 正式版 v0.1 的技术栈方向。目标不是选择“最流行”的组合，而是选择最适合当前产品本质的组合：版本化内容、可追溯测评、可替换执行策略、后续可接 Git 协作。

## 1. 结论

推荐技术栈：

| 层 | 选择 | 作用 |
| --- | --- | --- |
| Web | Next.js App Router + React + TypeScript | 正式 Hub、Variant、Eval Set、Eval Run、管理台 |
| UI | Tailwind CSS + shadcn/ui + TanStack Table + React Flow | 快速搭出可靠后台产品；后续支持多维表格和变体地图 |
| API | Python FastAPI + Pydantic v2 | 领域 API、命令接口、外部 runner/import 契约 |
| 数据库 | PostgreSQL | 事实、关系、权限、查询索引、读模型 |
| ORM / Migration | SQLAlchemy 2.0 + Alembic | 显式 schema、可迁移、适合 Python 团队 |
| Artifact | S3-compatible object storage，本地用 MinIO | skill bundle、case input、expected output、eval report、日志、二进制资产 |
| Git adapter | 独立内容适配器，后续接 Git repo/commit | 文件树 diff、review、fork/PR 协作，不作为主数据库 |
| Worker | Python worker 进程 | eval strategy、外部脚本、导入、后续升级实验 |
| Job orchestration | v0.1 用数据库 job table，后续再考虑 Temporal | 先简单闭环，复杂工作流成熟后再升级 |
| Package | uv + pnpm | Python 和前端依赖都清晰可复现 |
| Auth | v0.1 单用户/本地账号，后续 OIDC | 先保留权限模型接口，不阻塞单用户闭环 |

一句话版本：

```text
Postgres 记录事实和指针，Object Storage 记录不可变内容，Git 是可插拔的协作/内容适配器，FastAPI 和 Worker 负责把测评闭环跑起来，Next.js 负责把证据展示清楚。
```

## 2. 为什么不是直接做 GitHub 式仓库

Git 很适合：

- 存标准 skill 文件夹。
- 做文件级 diff。
- 做 review、fork、PR、merge。
- 通过 commit 固定内容快照。

但 SkillHub 的核心事实不在 Git 里：

- 哪个 `Skill` 默认指向哪个 `Variant`。
- 哪个 `Variant` 当前指向哪个 `VariantVersion`。
- 哪个 `VariantVersion` 在哪个 `EvalSetVersion` 上跑过。
- 每条 `EvalCaseVersion` 的 pass/fail 是什么。
- 哪次 promotion 是基于什么证据发生的。
- 谁有权限 publish、archive、run eval。

所以正式版不应该把 Git 当主数据库。更好的边界是：

```text
DB: 身份、关系、权限、指针、测评事实、查询索引
ArtifactStore: 不可变内容和报告
GitAdapter: 可选的人类可编辑文件树、diff、协作入口
```

这样未来可以同时支持三类用户：

- 只想在平台上点点点管理 skill 的用户。
- 想导入/导出标准 skill 文件夹的用户。
- 想用 Git fork/PR 工作流协作的高级用户。

## 3. 后端选择

### FastAPI

选择 FastAPI 的原因：

- 用户会 Python，demo 后端也已经是 Python，迁移成本低。
- Pydantic 适合把 `EvalRun`、`EvalResultImport`、`ContentRef` 这种契约做成明确 schema。
- 对外接脚本、LLM judge、自动升级器、实验 runner 都自然。
- 足够轻，不会逼我们过早进入重型企业框架。

不建议现在选 Django 作为主框架：

- Django Admin 对 CRUD 很方便，但本产品的核心不是普通 CRUD，而是 append-only 事实、不可变版本、artifact 指针、策略执行。
- 权限、查询、后台管理可以后续补；v0.1 更需要领域边界清晰。

### SQLAlchemy + Alembic

选择 SQLAlchemy 2.0 + Alembic：

- 表结构要被认真设计，不能藏在黑盒 ORM 里。
- `VariantVersion`、`EvalCaseVersion`、`EvalSetVersion`、`EvalRun` 都需要严格不可变语义。
- Alembic 迁移能让 demo 的 SQLite 原型逐步迁到 PostgreSQL。

## 4. 前端选择

### Next.js App Router

正式 UI 不应该沿用 demo 的单页拼接方式。推荐 Next.js：

- Hub、Skill/Variant、Eval Set Version、Eval Run、Management Console 都天然适合路由化。
- 服务端数据加载适合读页面，客户端 mutation 适合管理操作。
- 后续权限、登录、组织空间、公开页面和私有页面可以自然扩展。

### UI 组件

推荐组合：

- `shadcn/ui`：基础表单、弹窗、tabs、sidebar、command menu。
- `TanStack Table`：后续做用户想要的“多维表格”，让用户按 skill、variant、tags、eval set、strategy 查询。
- `React Flow`：变体地图。注意这个图表达 tags 约束空间，不表达 parent/child 血缘。

正式版前端的关键不是炫，而是把证据链展示清楚：

```text
Skill -> Variant -> VariantVersion -> EvalSetVersion -> EvalRun -> CaseResult
```

## 5. 数据库选择

### PostgreSQL

PostgreSQL 是主库，原因：

- 关系模型强，适合 version pointer、eval membership、权限 scope。
- JSONB 可以保存 strategy config、metadata、外部导入原始摘要，但不能滥用成主模型。
- 后续全文搜索、向量索引、物化视图、队列表都能自然扩展。

v0.1 不建议引入太多专用数据库：

- 不先上 Elasticsearch，先用 Postgres FTS。
- 不先上向量库，等 skill 搜索和相似 case 真的需要。
- 不先上图数据库，variant tags 查询用关系表足够。

### 数据库负责的事实

- `Skill`
- `Variant`
- `VariantVersion`
- `EvalSet`
- `EvalSetVersion`
- `EvalCase`
- `EvalCaseVersion`
- `EvalRun`
- `CaseResult`
- `Artifact`
- `RoleAssignment`
- `Job`

### 数据库不负责的大内容

- skill bundle 文件内容。
- 大型输入输出。
- eval 原始日志。
- LLM judge 完整 transcript。
- 生成报告。
- 二进制附件。

这些都放到 artifact store，数据库只存 locator、digest、media type、size、owner。

## 6. Artifact 和 Git

### v0.1 默认 ArtifactStore

先实现 S3-compatible artifact store：

- 开发环境用本地文件系统或 MinIO。
- 正式部署可换 S3/R2/OSS/MinIO。
- 所有内容按 digest 固化，不原地修改。

核心接口保持小：

```python
class ArtifactStore(Protocol):
    def put_tree(self, namespace: str, tree: SkillBundleTree) -> ArtifactRef: ...
    def put_blob(self, namespace: str, bytes: bytes, media_type: str) -> ArtifactRef: ...
    def get(self, ref: ArtifactRef) -> bytes: ...
    def diff(self, left: ArtifactRef, right: ArtifactRef) -> ArtifactDiff: ...
```

### GitAdapter 放在第二步

GitAdapter 不是 v0.1 主链路的前置条件，但接口要预留：

- `VariantVersion.content_ref` 可以指向 Git commit。
- Git commit locator 必须是不可变 commit SHA，不能是 branch name。
- 分支、fork、PR 是协作层对象，不要污染 variant 语义。

推荐策略：

1. v0.1 用 object/file artifact store 存规范化 skill 文件树。
2. v0.2 做 Git-backed adapter，把同样的文件树写入 Git commit。
3. v0.3 再做 fork/PR/ChangeProposal。

## 7. Worker 和策略执行

测评和升级不能塞进 Web API 进程。

v0.1 采用简单 worker：

```text
API 写入 Job
Worker 拉取 queued Job
Worker 执行 EvalStrategy
Worker 写入 EvalRun / CaseResult / Artifact
API 页面读取结果
```

初始策略：

- `manual_pass_fail`：用户手工提交 pass/fail。
- `external_result_import`：用户导入标准结果。
- `external_command`：平台调用本地命令，结果按标准 schema 回写。

后续策略：

- `script_runner`
- `llm_judge`
- `human_review_queue`
- `upgrade_agent`
关键原则：

- 策略是插件。
- 平台先记录标准化结果，不强制统一测评方法。
- 每次测评都必须绑定 exact `VariantVersion + EvalSetVersion`。

## 8. Job Orchestration

不建议 v0.1 直接上 Temporal。

原因：

- 现在还在确定领域边界，Temporal 会让部署和本地开发复杂很多。
- 手工测评、导入、外部命令三类 job 用数据库表足够。
- 真正需要长工作流、重试、补偿、人工中断恢复时，再引入 Temporal 更稳。

v0.1 job table 最小字段：

| 字段 | 说明 |
| --- | --- |
| `id` | job id |
| `type` | `eval.external_command`、`eval.import`、`upgrade.propose` |
| `status` | queued/running/succeeded/failed/canceled |
| `payload` | JSONB command payload |
| `result_ref` | artifact 或 domain id |
| `created_by` | actor |
| `created_at` / `started_at` / `finished_at` | 时间 |
| `error` | 失败摘要 |

## 9. 部署形态

### 本地开发

```text
pnpm dev:web
uv run api
uv run worker
docker compose up postgres minio
```

### v0.1 单机部署

```text
Next.js
FastAPI
Worker
Postgres
MinIO 或 S3-compatible storage
```

### 后续云部署

- Web: Vercel 或容器。
- API/Worker: Fly.io、Render、Railway、ECS、Kubernetes 均可。
- DB: Managed Postgres。
- Object Storage: S3/R2/OSS。

v0.1 不把部署商写死。

## 10. Monorepo 结构

推荐：

```text
apps/
  web/        # Next.js
  api/        # FastAPI
  worker/     # Python worker
packages/
  contracts/  # OpenAPI / JSON Schema / shared generated clients
  fixtures/   # 稳定 demo fixtures
docs/
  ...
```

Python 包可以先放在 `apps/api` 和 `apps/worker` 里共享一个 `skillhub` 包，等边界稳定后再拆：

```text
apps/api/skillhub/
  domain/
  application/
  infrastructure/
  api/
```

## 11. 第一阶段不做什么

v0.1 不做：

- GitHub 替代品。
- 完整 fork/PR。
- 复杂推荐系统。
- 自动升级闭环一键上线。
- 多租户商业权限。
- LLM judge 精细 rubric 平台。
- 正式 UI 视觉大重构。

v0.1 必须做：

- 标准 skill bundle 文件树入库。
- 不可变 `VariantVersion`。
- 不可变 `EvalCaseVersion`。
- 不可变 `EvalSetVersion`。
- `EvalRun` 绑定 exact version。
- 外部测评结果导入。
- 简单 worker 执行策略。
- Hub/Variant/EvalSet/EvalRun 基础正式页面。

## 12. 技术决策记录

| 决策 | 结论 | 原因 |
| --- | --- | --- |
| 主库 | PostgreSQL | 关系事实和权限查询是核心 |
| 内容存储 | Object storage first | 简单、稳定、适合不可变 artifact |
| Git | adapter，不是主模型 | Git 做文件树和协作，DB 做产品事实 |
| 后端 | FastAPI | Python 友好，契约清晰，适合策略执行 |
| 前端 | Next.js | 页面路由和正式产品 IA 更自然 |
| Worker | Python 独立进程 | eval/upgrade 不阻塞 API |
| Orchestration | job table first | v0.1 简单闭环优先 |
| 权限 | scoped role assignment | 后续 fork/PR 和组织空间需要 |
