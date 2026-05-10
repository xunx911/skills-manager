# Skills Manager

这是一个带测评证据的 SkillHub 产品工作区，用来管理标准 Skill bundle、约束变体、不可变版本、评测集版本、手工测评结果，以及“是否设为当前版本”的证据化决策。

## 当前产品闭环

- `Skill` 是 SkillHub 中稳定可搜索的入口。
- `Variant` 是某组 tag 约束下人工维护的当前最优解。
- `VariantVersion` 是不可变内容快照，可以是标准 Skill 文件夹或 zip 导入后的 `skill_bundle` artifact。
- `EvalSetVersion` 是测试用例版本快照。
- `EvalRun` 记录一次 exact `VariantVersion + EvalSetVersion` 的通过/不通过结果。
- `AcceptedVerification` 是当前 variant 在某个 eval set snapshot 上认可的测评依据，只指向不可变 `EvalRun`。
- 候选 `VariantVersion` 可以先测评，但不立刻成为 current。
- “设为当前版本评审”会把候选版本、当前版本、目标评测集版本、逐 case 修复/回退、文件 diff 和风险说明放到同一个决策页面。
- 外部 runner 可以导入标准 eval result JSON，并得到同样的 `EvalRun + CaseResult` 记录。
- 工作台内可以查看 bundle 文件内容、版本 diff、run 历史、run-to-run 比较、accepted verification、case 版本历史和 promotion review。
- 工作台支持 `Cmd/Ctrl+K` 上下文命令菜单，可搜索并执行导入、创建、测评、历史、差异等高频动作。
- `测评` 页支持单条快速添加和批量粘贴 case；批量写入会生成一个新的 `EvalSetVersion`，避免逐条添加制造版本噪音。
- `测评` 页的手工确认区是 review queue：可按全部/未确认/通过/不通过筛选，点击通过/不通过后自动前进到下一条未确认 case，并支持把未确认项批量标为通过。

## 快速开始

正式产品工作区位于 `apps/api` 和 `apps/web`。

### 一键本地运行

```bash
bash scripts/dev.sh
```

这个命令会启动：

- API: `http://127.0.0.1:8000`
- Web: `http://127.0.0.1:3000/skills`

脚本使用 `uv` 运行 Python API，并在 `apps/web/node_modules` 缺失时安装前端依赖；它不会污染全局 Python 环境。
本地 API 数据默认持久化到 `.data/skillhub.sqlite3`。可以用 `SKILLHUB_DATABASE_URL` 或 `SKILLHUB_DATA_DIR` 覆盖。

### 手动运行

终端 1：

```bash
cd apps/api
mkdir -p ../../.data
SKILLHUB_DATABASE_URL=sqlite:///$PWD/../../.data/skillhub.sqlite3 \
uv run uvicorn skillhub.api.main:app --host 127.0.0.1 --port 8000
```

终端 2：

```bash
cd apps/web
npm install
SKILLHUB_API_URL=http://127.0.0.1:8000 \
NEXT_PUBLIC_SKILLHUB_API_URL=http://127.0.0.1:8000 \
npm run dev -- --hostname 127.0.0.1 --port 3000
```

### 建议试用路径

1. 打开 `http://127.0.0.1:3000/skills`。
2. 用左侧 catalog 切换 skill。
3. 用右侧 inspector 或 `Cmd/Ctrl+K` 命令菜单创建 skill、导入标准 Skill bundle、创建 variant、添加测试用例、编辑 case version，并记录手工通过/不通过测评。
4. 在 `测评` 页可以直接用快速添加面板录入单条 case，或切到 `批量` 后粘贴多行 `title | input | expected output | notes`。
5. 在 `测评` 页用 `未确认` 筛选处理剩余 case；点击 `通过` / `不通过` 会自动选中下一条未确认 case，也可以用 `未确认标为通过` 快速完成低风险批次。
6. 在 `导入 bundle` 中上传以下任一来源：
   - 根目录包含 `SKILL.md` 的文件夹，或
   - 根目录文件夹包含 `SKILL.md` 的 zip。
7. `SKILL.md` 必须以 frontmatter 开头：

```markdown
---
name: security-reviewing
description: Review pull requests for auth and data access regressions.
---

# Security Reviewing
```

导入后的 bundle 会作为不可变 `skill_bundle` artifact 保存，创建出的 variant version 指向这个 artifact。

继续试完整 promotion 闭环：

1. 在 `测评` 中添加 case，并给当前版本记录一次通过/不通过结果。
2. 在右侧 `追加版本` 中上传第二个标准 Skill bundle，取消 `设为 current`，让它成为候选版本。
3. 回到 `测评`，用 `测评目标版本` 下拉框选择候选版本，记录候选版本的通过/不通过结果。
4. 打开 `变体`，或在 `差异` 页选择 current -> candidate，然后点 `设为当前版本评审`。
5. 在评审页查看 readiness、逐 case 修复/回退、bundle diff；如果有风险，需要填写说明后才能 `接受风险并设为当前版本`。
6. 提交后，variant 历史列表会刷新，候选版本显示为 `Current`。

记录多次手工测评后，打开 `历史` 可按 exact variant version、eval set version、strategy、status 过滤 run。每条 run 都可以标为 `对照` 或 `候选`；当两条 run 绑定同一个 `EvalSetVersion` 时，右侧会显示通过率变化、逐 case `修复/回退/稳定通过/仍未通过`，并可把候选 run `接受为验证依据`。在 `测评` 中，每个 case 行都有 `历史`，可以查看旧 case version 的 input、expected output、notes，以及它进入过哪些 eval set snapshot。

### 验证命令

推送前运行：

```bash
cd apps/api
uv run pytest
```

```bash
cd apps/web
npm run typecheck
npm run build
npx playwright install chromium
npm run e2e
```

运行中的应用可用下面命令冒烟检查：

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:3000/skills
```

正式 API Alembic migration 位于 `apps/api/migrations`；第一版 migration 会执行
`apps/api/skillhub/infrastructure/db/schema.sql`。

### 旧原型

早期 proof-of-concept 保留在 `demo-backend`、`demo` 和 `prototype` 中作为参考。新的产品开发应以 `apps/api` 和 `apps/web` 为准。

### 外部测评导入冒烟

后端运行后：

```bash
cd demo-backend
. .venv/bin/activate
python -m skillhub_demo.external_runner \
  --variant-version-id version-a-v1 \
  --eval-set-version-id evalset-v1 \
  --fail-case-title-contains 仅重命名
```

如果要接入真实本地 evaluator，可以使用 `external_command` strategy。命令会从 stdin 接收
`{"eval_set": ...}`，并输出 `{ "results": { "<case_version_id>": true } }`。
[keyword_evaluator.py](examples/evaluators/keyword_evaluator.py) 是一个最小 evaluator 示例。

```bash
python -m skillhub_demo.external_runner \
  --variant-version-id version-a-v1 \
  --eval-set-version-id evalset-v1 \
  --strategy external_command \
  --external-command '../demo-backend/.venv/bin/python ../examples/evaluators/keyword_evaluator.py --keyword ownerId'
```

## 主要文档

- [MVP spec](docs/MVP_SPEC.md)
- [API contract](docs/api-contract.md)
- [Eval result import schema](schemas/eval-result-import.schema.json)
- [Eval result import fixture](fixtures/eval-result-import.code-reviewer.json)
- [Design spec](docs/mvp-design-spec.md)
- [SQLite schema spike](docs/sqlite-schema-spike.md)
- [Storage adapter contract](docs/storage-adapter-contract.md)
- [Formal tech stack](docs/formal-tech-stack.md)
- [Formal architecture v0.1](docs/formal-architecture-v0.1.md)
- [Formal UI design v0.1](docs/formal-ui-design.md)
- [Product completion audit](docs/product-completion-audit-2026-05-08.md)
- [Bundle diff workbench design](docs/superpowers/specs/2026-05-08-bundle-diff-workbench-design.md)
- [Roadmap](docs/roadmap.md)
- [1.0 architecture review](docs/architecture-review-1.0.md)
- [Ralph Loop 运行说明](RALPH.md)

## Ralph Loop

项目已安装 Ralph Loop 配置，任务定义在 `.agent/tasks.json` 和 `.agent/tasks/`。

当前 promotion review、run-to-run comparison 和 accepted verification 的后端契约与前端体验已经接入；后续 Ralph 任务应继续围绕产品打磨、文档审计和回归覆盖推进。

运行前需要 Docker Sandboxes 登录：

```bash
sbx login
```

如果使用项目本地下载的 `sbx` 二进制：

```bash
PATH="$PWD/.tools/sbx/bin:$PATH" ./ralph.sh --agent codex
```

当前 Codex 沙箱里需要把 `sbx` 状态写到可写目录：

```bash
HOME=/private/tmp/skillhub-sbx-home PATH="$PWD/.tools/sbx/bin:$PATH" sbx login
HOME=/private/tmp/skillhub-sbx-home PATH="$PWD/.tools/sbx/bin:$PATH" ./ralph.sh --agent codex
```

如果只想验证一轮：

```bash
PATH="$PWD/.tools/sbx/bin:$PATH" ./ralph.sh --agent codex --once
```
