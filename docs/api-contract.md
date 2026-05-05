# SkillHub Demo API Contract

这份文档把当前 demo 跑通后的模型和接口固化下来。它不是正式后端技术选型，只是领域契约。

## 核心判断

- `Skill` 是入口，不是最终内容。
- `Variant` 是某组 tags 下由维护者人为认可和维护的当前解。
- `VariantVersion` 是不可变内容快照。
- `EvalCase` 是稳定测试场景入口。
- `EvalCaseVersion` 是完整测试用例快照：`input + expected_output`。
- `EvalSetVersion` 是测评集快照，必须引用具体的 `EvalCaseVersion`。
- `EvalRun` 必须绑定 `VariantVersion + EvalSetVersion`。
- `CaseResult` 是某个 case 在某次 run 中的最终 `pass/fail`。

## 对象字段

### Skill

`Skill` 只负责稳定入口和默认分发，不承载具体内容。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 内部唯一 ID。 |
| `slug` | string | hub 上展示和搜索用的稳定名称，例如 `code-reviewer`。 |
| `owner_ref` | string | 所有者引用。demo 阶段只是占位，正式版接权限系统。 |
| `default_variant_ref` | string | 默认入口指向的 `Variant.id`。 |
| `created_at` | ISO datetime | 创建时间。 |

### TagSet

`TagSet` 是变体约束集合。Variant 不直接存 tags，而是引用一个规范化后的 tag set。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 内部唯一 ID。 |
| `tags_hash` | string | 排序去重后的 tags 连接值，用于复用同一组约束。 |
| `tags` | string[] | 约束标签，例如 `["codex", "gpt5.4"]`。 |

### Variant

`Variant` 是某组约束下当前被认可的解。它不是计算结果，而是维护者显式创建和更新的对象。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 内部唯一 ID。 |
| `skill_ref` | string | 所属 `Skill.id`。 |
| `name` | string | 变体短名称，例如 `Variant A`。 |
| `label` | string | 人类可读标题，例如 `Codex baseline`。 |
| `summary` | string | 当前变体的用途和适用场景说明。 |
| `tag_set_ref` | string | 指向 `TagSet.id`。 |
| `current_version_ref` | string | 当前发布版本，指向 `VariantVersion.id`。 |
| `created_at` | ISO datetime | 创建时间。 |

### VariantVersion

`VariantVersion` 是不可变内容快照。历史版本不是另一个页面类型，只是同一个 Variant 页面查看不同 version。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 内部唯一 ID。 |
| `variant_ref` | string | 所属 `Variant.id`。 |
| `version` | string | 线性版本号，例如 `v1`、`v2`。 |
| `content_ref` | ContentRef | skill 内容的位置和摘要。demo 用 inline 占位，正式版可接 git/blob。 |
| `change_note` | string | 本次更新说明，可提到针对哪些 case 或指标变化。 |
| `created_at` | ISO datetime | 创建时间。 |

### ContentRef

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `kind` | enum | `inline_bundle`、`skill_bundle`、`artifact`、`git`、`external_repo`。 |
| `locator` | string | 内容定位符，例如 bundle 名、artifact id、git commit、bundle id。 |
| `digest` | string | 内容摘要，用于判断内容是否变化。 |
| `path` | string? | 可选路径，git 或 repo 类型会用到。 |

正式 skill 内容应按标准文件夹建模，而不是只存一段 prompt。`skill_bundle` 表示平台已经接收并固化了一整个 skill 文件夹快照；MVP demo 仍可继续用 `inline_bundle` 占位。

### EvalCorpus / EvalCase / EvalCaseVersion / EvalSetVersion

`EvalCorpus` 是 skill 的测评资产容器；`EvalCase` 是稳定测试场景入口；`EvalCaseVersion` 是一个完整测试用例快照；`EvalSetVersion` 是 case version 列表快照。

MVP 约束：

- `EvalCaseVersion` 视为不可变；修正 input 或 expected output 时新建 case version。
- `EvalSetVersion` 必须能解析出它包含的具体 case 内容。仅展示 case 数量不够。
- `EvalSetVersion` 引用 `EvalCaseVersion`，而不是只引用 `EvalCase`。

| 对象 | 字段 | 类型 | 说明 |
| --- | --- | --- | --- |
| `EvalCorpus` | `id` | string | 内部唯一 ID。 |
| `EvalCorpus` | `skill_ref` | string | 所属 `Skill.id`。 |
| `EvalCorpus` | `created_at` | ISO datetime | 创建时间。 |
| `EvalCase` | `id` | string | 内部唯一 ID。 |
| `EvalCase` | `corpus_ref` | string | 所属 `EvalCorpus.id`。 |
| `EvalCase` | `title` | string | case 标题，例如一个 PR 场景。 |
| `EvalCase` | `source_type` | enum | `manual`、`bad_case`、`imported`、`generated`。只表示来源，不影响判定层级。 |
| `EvalCase` | `current_version_ref` | string | 当前维护版本，指向 `EvalCaseVersion.id`。 |
| `EvalCase` | `origin_ref` | string? | 可选来源引用，例如反馈、issue、外部导入 ID。 |
| `EvalCase` | `created_at` | ISO datetime | 创建时间。 |
| `EvalCaseVersion` | `id` | string | 内部唯一 ID。 |
| `EvalCaseVersion` | `case_ref` | string | 所属 `EvalCase.id`。 |
| `EvalCaseVersion` | `version` | string | 线性版本号，例如 `v1`、`v2`。 |
| `EvalCaseVersion` | `input_artifact_ref` | string | 输入内容 artifact。 |
| `EvalCaseVersion` | `expectation_artifact_ref` | string | 期望输出 artifact。 |
| `EvalCaseVersion` | `grader_ref` | string | 判定策略引用。MVP 固定为人工 pass/fail。 |
| `EvalCaseVersion` | `expectation` | string | 简短期望说明，方便列表展示。 |
| `EvalCaseVersion` | `notes` | string? | 可选人工上下文。 |
| `EvalCaseVersion` | `created_at` | ISO datetime | 创建时间。 |
| `EvalSetVersion` | `id` | string | 内部唯一 ID。 |
| `EvalSetVersion` | `corpus_ref` | string | 所属 `EvalCorpus.id`。 |
| `EvalSetVersion` | `version` | string | 测评集版本，例如 `v1`、`v2`。 |
| `EvalSetVersion` | `case_version_refs` | string[] | 本快照包含的 `EvalCaseVersion.id` 列表。 |
| `EvalSetVersion` | `created_at` | ISO datetime | 创建时间。 |

### EvalRun / CaseResult

`EvalRun` 记录一次测评结论；`CaseResult` 只记录每条 case 的最终通过/不通过。

| 对象 | 字段 | 类型 | 说明 |
| --- | --- | --- | --- |
| `EvalRun` | `id` | string | 内部唯一 ID。 |
| `EvalRun` | `variant_version_ref` | string | 被测 `VariantVersion.id`。 |
| `EvalRun` | `eval_set_version_ref` | string | 使用的 `EvalSetVersion.id`。 |
| `EvalRun` | `strategy_ref` | string | 测评策略引用，例如 `manual-eval-v1`。 |
| `EvalRun` | `run_config_hash` | string | 策略配置摘要，保证同策略不同配置可区分。 |
| `EvalRun` | `status` | enum | `queued`、`running`、`finished`、`failed`。 |
| `EvalRun` | `started_at` | ISO datetime | 开始时间。 |
| `EvalRun` | `finished_at` | ISO datetime? | 结束时间。 |
| `EvalRun` | `result_artifact_ref` | string? | 可选，复杂测评报告 artifact。 |
| `CaseResult` | `run_ref` | string | 所属 `EvalRun.id`。 |
| `CaseResult` | `case_version_ref` | string | 对应 `EvalCaseVersion.id`。 |
| `CaseResult` | `passed` | boolean | MVP 最终结论。 |
| `CaseResult` | `score` | number | MVP 中 `pass=1`、`fail=0`，后续可扩展但不改变 pass/fail 主线。 |

## CRUD 策略

不是所有对象都应该完整 CRUD。

| 对象 | Create | Read | Update | Delete |
| --- | --- | --- | --- | --- |
| `Skill` | 需要 | 需要 | 可更新元数据和默认指针 | 不硬删，后续做 archive |
| `Variant` | 需要 | 需要 | 可更新元数据 | 不硬删，后续做 archive/deprecate |
| `VariantVersion` | 需要 | 需要 | 不更新，append-only | 不硬删 |
| `EvalCase` | 需要 | 需要 | 可更新标题、状态和当前版本指针 | 不硬删 |
| `EvalCaseVersion` | 需要 | 需要 | 不更新，append-only | 不硬删 |
| `EvalSetVersion` | 自动创建 | 需要 | 不更新，append-only | 不硬删 |
| `EvalRun` | 需要 | 需要 | 状态可变，finished 后不改事实 | 不硬删 |
| `CaseResult` | 随 run 创建 | 需要 | 不更新，重跑生成新 run | 不硬删 |

所以 demo 阶段的目标不是机械实现全 CRUD，而是实现：

- 创建和读取核心对象。
- 允许更新少量 metadata。
- 对版本、测评集、测评结果保持 append-only。
- 不做硬删除；Skill / Variant 已支持轻量 archive/deprecate。

## 当前 Demo Endpoint 覆盖矩阵

这里把“是否已经闭环”按资源拆开。`Read` 不是必须每个对象都有独立详情接口；只要当前产品视图需要的数据能被稳定读出，就算 MVP 已覆盖。

| 资源 | Create | Read | Update | Delete / Archive | MVP 结论 |
| --- | --- | --- | --- | --- | --- |
| `AppData` | seed / reset | `GET /api/state` | 不直接更新 | `POST /api/reset` 仅 demo 用 | 已覆盖 demo 同步 |
| `Skill` | `POST /api/skills` | `GET /api/skills`、`GET /api/skill` | `PATCH /api/skills` | `PATCH lifecycle_status=archived` | 已覆盖 |
| `Variant` | `POST /api/variants` | `GET /api/skill`、`GET /api/variant-page` | `PATCH /api/variants` | `PATCH lifecycle_status=archived` | 已覆盖 |
| `VariantVersion` | `POST /api/variant-versions` | `GET /api/variant-page` | 不允许原地更新 | 不允许硬删 | 已覆盖 append-only |
| `skill_bundle` artifact | `POST /api/skill-bundles` | `GET /api/skill-bundle` | 不允许原地更新 | 不允许硬删 | 已覆盖导入和读取 |
| `EvalCase` | `POST /api/eval-cases` | `GET /api/eval-set` | 不建议原地更新 | 未实现，正式版做 archive | 已覆盖 append-only |
| `EvalCaseVersion` | `POST /api/eval-case-versions` | `GET /api/eval-set` | 不允许原地更新 | 不允许硬删 | 已覆盖 append-only |
| `EvalSetVersion` | 由 `POST /api/eval-cases` 自动创建 | `GET /api/eval-set` | 不允许原地更新 | 不允许硬删 | 已覆盖快照 |
| `EvalRun` | `POST /api/eval-runs` | `GET /api/eval-result`、`GET /api/variant-page` | finished 后不改事实 | 不允许硬删 | 已覆盖测评记录 |
| `CaseResult` | 随 `POST /api/eval-runs` 创建 | `GET /api/eval-result` | 不允许原地更新 | 不允许硬删 | 已覆盖 pass/fail |

刻意不做完整 CRUD 的对象：

- `VariantVersion`、`EvalCaseVersion`、`EvalSetVersion`、`EvalRun`、`CaseResult` 都是事实记录，正式版也应默认 append-only。
- `EvalCase` 是稳定场景入口；修正文案或输入时新建 case version，并生成新的 `EvalSetVersion`。
- 删除会影响可追溯性；MVP 对 `Skill` / `Variant` 使用 `lifecycle_status` 做 archive/deprecate，而不是硬删。

## 最小闭环调用链

### 新建一个 skill 并跑通测评

1. `POST /api/skills` 创建 `Skill + EvalCorpus + EvalSetVersion v1 + 默认 Variant + VariantVersion v1`。
2. `POST /api/eval-cases` 添加测试用例，创建 `EvalCase + EvalCaseVersion v1`，并自动生成新的 `EvalSetVersion`。
3. `POST /api/eval-runs` 选择某个 `VariantVersion + EvalSetVersion`，记录每条 case 的 pass/fail。
4. `GET /api/eval-result` 查看这次组合的详细结果。
5. `GET /api/variant-page` 回到变体页面，查看当前版本在所有测评集版本上的验证状态。

### 更新一个 skill 内容并验证不破坏历史

1. 可选：`POST /api/skill-bundles` 导入标准 skill 文件夹快照，得到 `content_ref`。
2. `POST /api/variant-versions` 发布新 `VariantVersion`，并移动 `Variant.current_version_ref`。
3. 旧 `EvalRun` 仍绑定旧 `VariantVersion`，不会被新版本覆盖。
4. 对新 `VariantVersion` 调用 `POST /api/eval-runs`，形成新的测评事实。
5. `GET /api/variant-page` 对比当前版本、历史版本、验证状态和 bundle diff。

## Demo 持久化

当前 Python demo 通过 Repository 边界保存完整对象图：

- 默认 Repository：SQLite，路径 `demo-backend/data/skillhub-demo.sqlite3`。
- 兼容 Repository：JSON 文件，使用 `--store json --data-file /tmp/skillhub-demo.json`。
- 服务启动时：SQLite 有快照则读取快照；没有快照但存在 legacy JSON 时导入 JSON；否则使用 seed data。
- 每次 `POST` / `PATCH` 成功后：HTTP 层通过 Repository `mutate` 边界加载当前状态、执行业务变更、写回完整 `AppData`。
- SQLite 写入方式：保存 `app_state` 快照，并刷新一份规范化关系表。
- skill bundle 内容写入 `ArtifactStore`，Repository 状态只保留 artifact 元数据、hash 和 locator；旧 inline bundle 仍兼容读取。
- SQLite 读路径：`GET /api/skills`、`GET /api/skill`、`GET /api/variant-page`、`GET /api/eval-set` 和 `GET /api/eval-result` 已经通过 SQL read model 返回。
- SQLite schema：`schema_meta` 记录当前 schema version，初始化流程已预留 migration hook。
- JSON 写入方式：先写临时文件，再替换目标文件，避免半写入。

这只是 demo 层实现，不改变领域模型。正式版可以继续沿用同一套 Repository 契约，逐步把高价值读写路径替换成 SQL。

## Endpoints

### Health

```http
GET /health
```

返回：

```json
{ "ok": true }
```

### Full State

```http
GET /api/state
```

返回当前内存态完整对象图。前端 demo 目前用它做核心对象图同步；标准 skill 文件内容通过 `GET /api/skill-bundle` 按需读取。

### Skill List

```http
GET /api/skills
```

返回每个 skill 默认 variant 的摘要视图。

### Skill Detail

```http
GET /api/skill?skill_id=skill-code-reviewer
```

返回：

- `skill`
- `variants`
- `eval_set_version`

### Create Skill

```http
POST /api/skills
Content-Type: application/json

{
  "slug": "api-reviewer",
  "owner_ref": "skillhub-lab",
  "default_variant": {
    "name": "Variant A",
    "label": "API baseline",
    "summary": "审查 API 兼容性、鉴权边界和错误响应泄露。",
    "tags": ["codex"],
    "change_note": "初始 API review 版本。"
  }
}
```

行为：

- 创建 `Skill`。
- 创建对应 `EvalCorpus`。
- 创建空的 `EvalSetVersion v1`。
- 创建默认 `Variant` 和初始 `VariantVersion v1`。
- 设置 `Skill.default_variant_ref` 指向这个默认变体。

### Update Skill Metadata

```http
PATCH /api/skills
Content-Type: application/json

{
  "skill_id": "skill-code-reviewer",
  "slug": "code-reviewer-v2",
  "owner_ref": "skillhub-lab",
  "default_variant_ref": "variant-b"
}
```

行为：

- 更新 skill 元数据。
- 如果提供 `default_variant_ref`，必须指向同一个 skill 下的 variant。
- 不创建新版本，因为入口指针不是内容快照。

### Variant Page

```http
GET /api/variant-page?variant_id=variant-a&version_id=version-a-v1&eval_set_version_id=evalset-v1
```

返回同一个页面模板需要的数据：

- `variant`
- `variant_version`
- `tags`
- `history`
- `eval_set_version`
- `score`
- `result_counts`
- `content_ref`
- `verification_runs[]`
  - `eval_set_version`
  - `eval_run`
  - `score`
  - `result_counts`

`version_id` 可以省略。省略时读取 `Variant.current_version_ref`。

### Create Variant

```http
POST /api/variants
Content-Type: application/json

{
  "skill_id": "skill-code-reviewer",
  "name": "Variant C",
  "label": "OpenCode tuned",
  "summary": "OpenCode 环境下维护的当前认可解。",
  "tags": ["opencode", "minimax2.7"],
  "change_note": "初始 OpenCode 版本。"
}
```

行为：

- 规范化 tags，并复用或创建 `TagSet`。
- 创建 `Variant`。
- 创建初始 `VariantVersion v1`。
- 设置 `Variant.current_version_ref` 指向初始版本。

### Update Variant Metadata

```http
PATCH /api/variants
Content-Type: application/json

{
  "variant_id": "variant-a",
  "summary": "新的说明"
}
```

只更新 variant 元数据，不创建新 `VariantVersion`。

### Publish Variant Version

发布 mock 内容：

```http
POST /api/variant-versions
Content-Type: application/json

{
  "variant_id": "variant-a",
  "change_note": "加强 token 泄露审查",
  "content": "optional content snapshot"
}
```

发布标准 skill bundle：

```http
POST /api/skill-bundles
Content-Type: application/json

{
  "name": "code-reviewer-bundle",
  "files": {
    "SKILL.md": "---\nname: code-reviewer\ndescription: Review pull requests for bugs and missing tests.\n---\n\n# Code Reviewer\n",
    "references/checklist.md": "- Check authorization filters.\n"
  }
}
```

返回：

```json
{
  "content_ref": {
    "kind": "skill_bundle",
    "locator": "artifact-skill-bundle-code-reviewer-bundle-abc123",
    "digest": "sha-abc123...",
    "path": "/"
  },
  "metadata": {
    "name": "code-reviewer",
    "description": "Review pull requests for bugs and missing tests."
  },
  "files": ["SKILL.md", "references/checklist.md"]
}
```

然后把返回的 `content_ref` 传给 `POST /api/variant-versions`：

```json
{
  "variant_id": "variant-a",
  "change_note": "发布标准 skill bundle。",
  "make_current": false,
  "content_ref": {
    "kind": "skill_bundle",
    "locator": "artifact-skill-bundle-code-reviewer-bundle-abc123",
    "digest": "sha-abc123...",
    "path": "/"
  }
}
```

行为：

- 创建新的 `VariantVersion`。
- 如果传入 `content_ref`，新版本直接引用该不可变内容快照。
- 如果 `make_current=true`，更新 `Variant.current_version_ref`。
- 如果 `make_current=false` 或省略，新版本仍是可测评的不可变候选版本，但不会成为当前默认版本。
- 旧版本和旧 run 保留。

### Skill Bundle Detail

```http
GET /api/skill-bundle?artifact_id=artifact-skill-bundle-code-reviewer-bundle-abc123
```

返回：

- `artifact`
- `metadata`
  - `name`
  - `description`
- `files[]`
  - `path`
  - `content`

行为：

- `artifact_id` 必须指向 `kind=skill_bundle` 的 artifact。
- 返回的是不可变 bundle 快照中的实际文件内容。
- 平台可以用这个接口展示 `SKILL.md`、`references/`、`scripts/` 等标准 skill 文件。

### Eval Set Detail

```http
GET /api/eval-set?eval_set_version_id=evalset-v1
```

返回：

- `eval_set_version`
- `cases[]`
  - `title`
  - `input`
  - `expected_output`

### Create Eval Case

```http
POST /api/eval-cases
Content-Type: application/json

{
  "skill_id": "skill-code-reviewer",
  "title": "PR: token 写入错误响应",
  "input": "diff ...",
  "expected_output": "应指出 token 泄露风险。"
}
```

行为：

- 创建 `EvalCase`。
- 创建 `EvalCaseVersion v1`。
- 创建 input / expected artifacts。
- 基于当前最新测评集创建新的 `EvalSetVersion`。

### Create Eval Case Version

```http
POST /api/eval-case-versions
Content-Type: application/json

{
  "case_id": "case-null",
  "input": "diff ...",
  "expected_output": "不应再报告 nickname 为空导致 toUpperCase 崩溃。",
  "make_current": true
}
```

行为：

- 创建新的 `EvalCaseVersion`。
- 创建 input / expected artifacts。
- 如果 `make_current=true` 或省略，更新 `EvalCase.current_version_ref`。
- 基于当前最新测评集创建新的 `EvalSetVersion`，用新 case version 替换同一 case 的旧 version。
- 旧 `EvalSetVersion`、旧 `EvalRun` 和旧 `CaseResult` 保持不变。

### Eval Result Detail

```http
GET /api/eval-result?variant_version_id=version-a-v1&eval_set_version_id=evalset-v1
```

返回：

- `variant`
- `variant_version`
- `eval_set_version`
- `score`
- `result_counts`
- `cases[]`
  - case detail
  - `result`

### Record Eval Run

```http
POST /api/eval-runs
Content-Type: application/json

{
  "variant_version_id": "version-a-v1",
  "eval_set_version_id": "evalset-v1",
  "results": {
    "case-null": true,
    "case-auth": false
  }
}
```

行为：

- 创建 `EvalRun`。
- 为 eval set 中每个 case 创建 `CaseResult`。
- 未提供的 case 默认 `false`，demo 阶段这样更容易暴露遗漏。
- `variant_version_id` 和 `eval_set_version_id` 必须属于同一个 skill，否则返回 400。

### Reset Demo State

```http
POST /api/reset
Content-Type: application/json

{}
```

行为：

- 用 seed data 重建内存状态。
- 通过当前 Repository 覆盖写回 demo 状态。
- 只用于 demo 清理，不是正式数据删除接口。

## 下一步接口缺口

正式化前还需要补：

- 持久化迁移：schema version、迁移脚本、SQL 化关键查询。
- 权限模型：谁能创建 skill、发布版本、切默认入口。
