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
- `差异` 和 `设为当前版本评审` 的文件 diff 支持会话级 `已查看` 标记与 `x/y reviewed` 进度，用户可以按文件推进审查，而不是靠记忆判断哪些 bundle 文件已经看完。
- 外部 runner 可以导入标准 eval result JSON，并得到同样的 `EvalRun + CaseResult` 记录。
- 空工作台主内容区提供 `SkillLaunchpad`，可直接导入标准 Skill bundle 或创建空白 skill，不需要先进入右侧 inspector。
- 移动端 first-run 默认只保留主区 `SkillLaunchpad` 作为导入/创建主路径；右侧 inspector 的 action menu/form 会折叠，用户从 catalog 或命令菜单显式触发后才展开并接收焦点。
- 中等桌面宽度下，`差异 / 历史 / 审计 / 评审` 这类证据视图会把右侧 inspector 压成 compact verification rail，把空间让给 diff、run matrix、audit payload 和 promotion evidence。
- 工作台内可以查看 bundle 文件内容、在主工作区编辑 skill 身份和默认分发 variant、管理 skill 作用域角色、创建约束 variant、追加候选版本、版本 diff、run 历史、run matrix、保存历史筛选视图、run-to-run 比较、accepted verification、case 详情内联编辑、case 版本历史、case 历史版本恢复和 promotion review。
- 创建或导入 skill 的本地 actor 会自动成为该 skill 的 `owner`；`promotion` 和 `accepted verification` 需要 `owner` 或 `maintainer`。前端本地开发身份来自后端签名的 HttpOnly cookie session，JSON body 中不再传 actor；直接调 API 的脚本仍可用 `X-SkillHub-Actor` 作为兼容 fallback。
- `概览` 页提供 `治理与审计` 面板，集中展示 lifecycle、角色态势、最近 audit events，并把归档收进需要输入当前 skill ID 的危险区；归档需要 `owner` 权限并写入 `skill.archived` audit event。治理面板也能打开 `审计 Explorer`，用 action quick filters、actor/action/resource_type 过滤、可读时间线和结构化详情追踪当前 skill 的治理、发布和验证事件，Raw payload 默认折叠在下钻区。
- 工作台支持 `Cmd/Ctrl+K` 上下文命令菜单，可搜索并执行导入、创建、测评、历史、差异等高频动作；菜单使用 `dialog + combobox + listbox` 语义，方向键移动 active option，Tab 会限制在弹层内，关闭后焦点回到触发按钮。菜单会根据当前 mode 排序：空工作台优先导入/新建，测评页优先 run/case，变体页优先 variant/version/diff。
- `/skills?skill=<slug-or-id>&mode=<mode>` 支持第一阶段 URL state：可以直达某个 skill 的 `概览 / 变体 / 测评 / 差异 / 历史 / 审计` 视图，刷新和浏览器 Back/Forward 会恢复 selected skill 与 mode；更细的 diff pair、history filters、selected run/case 和 promotion context 留给下一阶段深链。
- 工作台有基础 accessibility 护栏：键盘用户可用 skip link 直接进入主内容；全局 focus ring 更醒目；`prefers-reduced-motion` 会压低非必要动效；操作结果通过 `role=status` 暴露给读屏软件；命令菜单、Workbench mode tabs、Run matrix 和 Inspector action 焦点交接已有 E2E 回归。
- 高频写入表单第一阶段已统一字段基础件：`SkillLaunchpad` 和 `WorkbenchInspector` 使用共享 `TextField/TextAreaField/SelectField/FileField`，业务 text/textarea 默认显式 `autocomplete="off"`，局部焦点样式收敛到 `:focus-visible`。
- `测评` 页支持单条快速添加和批量粘贴 case；批量写入会生成一个新的 `EvalSetVersion`，避免逐条添加制造版本噪音。
- `测评` 页的手工确认区是 review queue：可按全部/未确认/通过/不通过筛选，点击通过/不通过后自动前进到下一条未确认 case，并支持把未确认项批量标为通过。
- 导入标准 Skill bundle 后，`概览` 会显示验证清单，引导用户补首批 case、记录首轮手工测评，再进入历史页沉淀证据。
- 追加 candidate 版本后会自动切到该版本的测评上下文，完成候选 run 后可直接从测评页进入“设为当前版本评审”。

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
本地开发默认 actor 是 `product-operator`；右侧 inspector 的 `Local session` 面板可以切换本地 actor，后端会写入签名的 HttpOnly `skillhub_actor` cookie。前端所有 API 请求都会带上 cookie，不再硬编码 actor header。直接调 API 时仍可用 `X-SkillHub-Actor` header 模拟不同用户，后续正式认证会把本地 session 替换成真实登录。

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
3. 右侧 inspector 顶部的 `Local session` 显示当前本地 actor。需要模拟另一个维护者时，输入如 `release-manager` 并点击 `切换 actor`，之后创建、导入、授权、promotion 和审计都会使用这个 actor。
4. 空工作台会在主内容区显示 `SkillLaunchpad`：可以直接导入标准 Skill bundle，也可以先创建空白 skill。移动端 first-run 默认不再重复展示右侧 inspector 的第二份导入表单；需要低频入口时，点左侧 catalog 或 `Cmd/Ctrl+K` 命令菜单即可展开 inspector 表单并把焦点送过去。已有 skill 时，也可以继续用右侧 inspector 或命令菜单触发同类动作。顶部工作区模式按 tablist 建模，聚焦当前模式后可用左右方向键、Home、End 在 `概览 / 变体 / 测评 / 差异 / 历史` 间移动；切换 skill 或 mode 后地址栏会同步为 `/skills?skill=<slug>&mode=<mode>`，方便复制当前工作区；中等桌面宽度下进入 `差异 / 历史 / 审计 / 评审` 时，右侧会自动收成 verification rail，方便扫读证据。
5. 导入 bundle 后先看 `概览` 里的 `验证清单`：没有 case 时点击 `添加首批 case`；有 case 但没有 run 时点击 `打开手工测评`；完成 run 后点击 `查看证据历史`。
6. 在 `概览` 页的 `身份与默认分发` 中可直接修改 skill ID、归属，并选择哪个 variant 作为默认分发入口。
7. 在 `概览` 页的 `访问控制` 中可查看当前 skill 的 owner/maintainer/evaluator/viewer，并添加或移除成员角色。
8. 在 `概览` 页的 `治理与审计` 中查看最近权限/发布/归档事件；点击 `查看全部审计` 可以进入 `审计 Explorer`，先用 action chip 快速收窄，再按 actor、action 和 resource type 精确过滤。选中事件后先看 actor/resource/time/summary 和 payload key/value，只有排障时再展开 `Raw payload`。确实要归档时，需要输入当前 skill ID 后才能执行。
9. 在 `测评` 页可以直接用快速添加面板录入单条 case，或切到 `批量` 后粘贴多行 `title | input | expected output | notes`。
10. 在 `变体` 页可直接用 `新建约束 variant` 创建新的 tags 组合；默认会从当前 default variant 的 current version 复制基线，创建后在同一张 variant map 中出现。
11. 在 `变体` 页可直接用 `追加候选版本` 上传新的标准 Skill 文件夹或 zip；默认不会设为 current，保存后会自动切到 candidate 的测评上下文。
12. 在 `测评` 页用 `未确认` 筛选处理剩余 case；点击 `通过` / `不通过` 会自动选中下一条未确认 case，也可以用 `未确认标为通过` 快速完成低风险批次。选中 case 后可直接在详情面板点击 `编辑`，保存时会生成新的 case version 和新的 `EvalSetVersion`，不用跳到右侧 inspector。
13. 在 `导入 bundle` 中上传以下任一来源：
   - 根目录包含 `SKILL.md` 的文件夹，或
   - 根目录文件夹包含 `SKILL.md` 的 zip。
14. `SKILL.md` 必须以 frontmatter 开头：

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
2. 在 `变体` 页的 `追加候选版本` 中上传第二个标准 Skill bundle，或使用右侧 `追加版本` 表单，取消 `设为 current`，让它成为候选版本。
3. 页面会自动切到 `测评` 并选中新 candidate；记录候选版本的通过/不通过结果。
4. 用测评页的 candidate banner 点击 `进入设为当前版本评审`，或在 `差异` 页选择 current -> candidate 后进入评审。
5. 在评审页查看 readiness、逐 case 修复/回退、bundle diff；逐个文件勾选 `已查看此文件` 后，header 会显示 `x/y reviewed`。如果有风险，需要填写说明后才能 `接受风险并设为当前版本`。
6. 提交后，variant 历史列表会刷新，候选版本显示为 `Current`。

记录多次手工测评后，打开 `历史` 可按 exact variant version、eval set version、strategy、status 过滤 run，并把当前筛选保存成命名视图，之后一键恢复同一组筛选。页面顶部的 `Run matrix` 会把当前筛选下的 runs 展成 case x run 矩阵，单元格显示 `通过`、`不通过` 或 `-` 未覆盖，并用原生 `table`、caption、列/行标题和完整单元格标签暴露给辅助技术。每条 run 都可以标为 `对照` 或 `候选`；选择两条 run 后，矩阵会在每个 case 行显示 `修复`、`回退`、`稳定通过`、`仍未通过` 或 `缺失`。矩阵还支持按 impact 过滤、按 impact 分组、隐藏 run header 分数；这些矩阵控制项会和历史筛选一起保存到命名视图里。当两条 run 绑定同一个 `EvalSetVersion` 时，右侧会显示通过率变化、逐 case `修复/回退/稳定通过/仍未通过`，并可把候选 run `接受为验证依据`。在 `测评` 中，每个 case 行都有 `历史`，可以查看旧 case version 的 input、expected output、notes，以及它进入过哪些 eval set snapshot；如果要回到旧 input/expected output，点击旧版本上的 `恢复此版本`，系统会创建一个新的当前 case version 和新的 `EvalSetVersion`，不会覆盖历史。

### 验证命令

推送前运行：

```bash
cd apps/api
uv run pytest
```

```bash
cd apps/web
npm run typecheck
npm run test:unit
npm run build
npm audit --omit=dev
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
