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
- `AcceptedVerification` 是验证指针，只指向一次不可变 `EvalRun`，用于说明当前 variant 在某个 eval set snapshot 上认可哪次测评。
- `RoleAssignment` 是 skill 作用域授权，保护 promotion、accepted verification 和角色管理等高风险动作。
- `AuditEvent` 是 append-only 治理事实，记录角色变更、发布决策和归档等动作。

## 对象字段

### Skill

`Skill` 只负责稳定入口和默认分发，不承载具体内容。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 内部唯一 ID。 |
| `slug` | string | hub 上展示和搜索用的稳定名称，例如 `code-reviewer`。 |
| `owner_ref` | string | 所有者引用，用于展示和筛选；真实动作权限由 `RoleAssignment` 判定。 |
| `default_variant_ref` | string | 默认入口指向的 `Variant.id`。 |
| `created_at` | ISO datetime | 创建时间。 |

### RoleAssignment

`RoleAssignment` 显式绑定到某个 skill，不做组织级隐式继承。本地前端通过后端签名的 `skillhub_actor` HttpOnly cookie 表示当前 actor；直接调 API 的脚本仍可用 `X-SkillHub-Actor` 请求头作为兼容 fallback。正式认证接入后，这个 actor context 应由服务端 session/token 注入。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 内部唯一 ID。 |
| `subject_type` | string | 当前支持 `user`。 |
| `subject_id` | string | 用户或服务账号标识。 |
| `resource_type` | string | 当前支持 `skill`。 |
| `resource_id` | string | 所属 `Skill.id`。 |
| `role` | enum | `owner`、`maintainer`、`evaluator`、`viewer`。 |
| `created_by` | string | 授权人 actor。 |

本轮权限：

| 动作 | 需要角色 |
| --- | --- |
| 管理 skill role assignment | `owner` |
| `POST /api/variants/promotions` | `owner` 或 `maintainer` |
| `POST /api/eval-runs/accepted-verifications` | `owner` 或 `maintainer` |
| `DELETE /api/skills/{skill_id}` 归档 skill | `owner` |

### AuditEvent

`AuditEvent` 是不可变审计事实。产品详情页只读取最近事件，用于让用户理解 skill 的治理状态；审计 Explorer 可以读取当前 skill 关联的 skill、variant 和 eval_run 事件。导出、保留策略和组织级日志属于后续版本。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 内部唯一 ID。 |
| `actor_ref` | string | 操作者 actor。 |
| `action` | string | 动作，例如 `role.assigned`、`role.revoked`、`skill.archived`、`variant.promoted`。 |
| `resource_type` | string | 当前治理面板读取 `skill` 级事件。 |
| `resource_id` | string | 所属 `Skill.id`。 |
| `payload` | object | 动作上下文，例如 subject、role、reason 或 skill_id。 |
| `created_at` | ISO datetime | 事件写入时间。 |

### Actor Context

所有 mutation endpoint 的操作者身份来自请求级 actor context，而不是 JSON body。读取优先级：

1. `skillhub_actor` HttpOnly cookie，值由后端 HMAC 签名。
2. `X-SkillHub-Actor` header，仅用于直接 API 调用和自动化脚本兼容。
3. 缺省本地 actor：`product-operator`。

如果 cookie 存在但签名无效，后端返回 `400 Invalid actor session.`，不会回退到默认 actor。旧客户端如果继续在 body 中传 `actor`，后端会忽略；审计字段 `created_by`、`actor_ref` 和权限判断都以请求级 actor context 为准。正式认证版本应把这个 dependency 替换为真实 session、JWT 或 OIDC token 校验。

### Error Response

错误响应保留历史兼容的 `detail` 字段；当错误可以定位到请求字段时，额外返回 `field_errors`。前端表单使用 `field` 匹配控件 `name`，不要解析 `detail` 文案推断字段。

```json
{
  "detail": "Skill ID 已存在：code-reviewer",
  "field_errors": [
    {
      "field": "slug",
      "message": "Skill ID 已存在：code-reviewer",
      "code": "skill.slug_conflict"
    }
  ]
}
```

当前第一阶段覆盖：

- `POST /api/skills` 重复 `slug`：`400`，`field_errors[0].field = "slug"`。
- `PATCH /api/skills/{skill_id}` 重复 `slug`：`400`，`field_errors[0].field = "slug"`。
- `POST /api/skill-imports` 解析标准 Skill bundle 失败：`400`，folder 导入回填 `folder_files`，zip 导入回填 `zip_file`。
- `POST /api/saved-views` 空白、重复或超长 `name`：`400/422`，`field_errors[0].field = "name"`。
- `POST /api/eval-runs/accepted-verifications` 超长 `note`：`422`，`field_errors[0].field = "note"`。
- `POST /api/variants/promotions` risky promotion 空白或超长 `decision_note`：`400/422`，`field_errors[0].field = "decision_note"`。
- FastAPI 请求体校验错误：`422`，按请求体字段生成 `field_errors`；数组 item 错误会优先回填到顶层表单字段，例如 `tags[0]` 映射为 `tags`。
- `POST /api/eval-cases/batch` 的 `cases[]` 请求体错误保留行号，例如第 2 行缺少 `expected_output` 会返回 `field = "cases[1].expected_output"`。

当前基础格式规则：

| 字段 | 规则 | 错误字段 |
| --- | --- | --- |
| `slug` | `^[a-z0-9][a-z0-9-]{0,63}$`，小写字母、数字、连字符，必须以字母或数字开头，最多 64 字符。 | `slug` |
| `tags[]` | 每个 tag 1-64 字符，只能使用字母、数字、`.`、`_`、`-`。 | `tags` |
| Eval case `title` | 1-160 字符。 | `title` 或 `cases[n].title` |
| Eval case `input_text` | 1-20000 字符。 | `input_text` 或 `cases[n].input_text` |
| Eval case `expected_output` | 1-10000 字符。 | `expected_output` 或 `cases[n].expected_output` |
| Eval case `notes` | 可空；最多 2000 字符。 | `notes` 或 `cases[n].notes` |
| Saved view `name` | 1-80 字符；trim 后不能为空，同一 skill + view type 下不能重复。 | `name` |
| Accepted verification `note` | 可空；最多 1000 字符。 | `note` |
| Promotion `decision_note` | 有风险时 trim 后必填；最多 1000 字符。 | `decision_note` |

当前批量 case 字段错误：

| 场景 | `field` | `message` | `code` |
| --- | --- | --- | --- |
| 第 1 行标题为空 | `cases[0].title` | `第 1 行填写标题。` | `request.string_too_short` |
| 第 2 行缺少 Expected output | `cases[1].expected_output` | `第 2 行填写 Expected output。` | `request.missing` |
| 第 1 行 Input 超过 20000 字符 | `cases[0].input_text` | `第 1 行 Input 最多 20000 个字符。` | `request.string_too_long` |

`cases[n].title`、`cases[n].input_text` 和 `cases[n].expected_output` 是机器可读字段路径；`n` 是从 0 开始的请求数组索引，文案使用从 1 开始的用户行号。其他数组 item 错误仍按顶层字段回填，例如 `tags[0]` 映射为 `tags`。

当前 bundle 导入字段错误：

| 场景 | `field` | `code` |
| --- | --- | --- |
| folder 导入缺少根目录 `SKILL.md` | `folder_files` | `skill_import.skill_md_missing` |
| zip 导入缺少根目录 `SKILL.md` | `zip_file` | `skill_import.skill_md_missing` |
| `SKILL.md` 不是 UTF-8 | `folder_files` 或 `zip_file` | `skill_import.skill_md_not_utf8` |
| `SKILL.md` 缺少 YAML frontmatter | `folder_files` 或 `zip_file` | `skill_import.frontmatter_missing` |
| frontmatter 为空或未关闭 | `folder_files` 或 `zip_file` | `skill_import.frontmatter_empty` / `skill_import.frontmatter_unclosed` |
| frontmatter `name` 格式不合法 | `folder_files` 或 `zip_file` | `skill_import.name_invalid` |
| frontmatter 缺少 `description` 或过长 | `folder_files` 或 `zip_file` | `skill_import.description_required` / `skill_import.description_too_long` |
| zip 无法读取 | `zip_file` | `skill_import.zip_unreadable` |

后续如果要支持更深嵌套字段，可以在保持 `field` 的同时增加 JSON Pointer，但不能破坏 `detail + field_errors` 的兼容契约。

### Local Session

```http
GET /api/session
```

返回当前 actor。没有 cookie 或 header 时返回 `product-operator`。

```json
{
  "actor": "product-operator",
  "subject_type": "user"
}
```

设置本地 actor：

```http
POST /api/session
Content-Type: application/json

{
  "actor": "release-manager"
}
```

行为：

- 校验 actor 只能包含字母、数字、`.`、`_`、`@`、`-`，长度 1 到 120。
- 写入 `skillhub_actor` HttpOnly cookie，`SameSite=Lax`，默认 30 天有效。
- 返回设置后的 actor。

清除本地 actor：

```http
DELETE /api/session
```

行为：

- 删除 `skillhub_actor` cookie。
- 响应体回到本地默认 actor `product-operator`。

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

### AcceptedVerification

`AcceptedVerification` 不是新的测评结果，也不复制 case result。它只把 `(variant_id, eval_set_version_id)` 指向一个已经完成的 `EvalRun`，并写入 audit event。替换验证依据时更新同一指针，不改变旧 run。

写入或替换 `AcceptedVerification` 需要操作者在目标 skill 上拥有 `owner` 或 `maintainer` 角色。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 内部唯一 ID。 |
| `skill_id` | string | 所属 `Skill.id`。 |
| `variant_id` | string | 被验证的 variant。 |
| `variant_version_id` | string | 被接受 run 绑定的 variant version。 |
| `eval_set_version_id` | string | 被验证的 eval set snapshot。 |
| `eval_run_id` | string | 被接受的 finished run。 |
| `note` | string | 可选人工说明，最多 1000 字符；超限返回 `field_errors.note`。 |
| `created_at` | ISO datetime | 接受时间。 |
| `created_by` | string | 操作者。 |

## CRUD 策略

不是所有对象都应该完整 CRUD。

| 对象 | Create | Read | Update | Delete |
| --- | --- | --- | --- | --- |
| `Skill` | 需要 | 需要 | 可更新元数据和默认指针 | `owner` 可 archive，不硬删 |
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
| `Skill` | `POST /api/skills` | `GET /api/skills`、`GET /api/skills/{skill_id}` | `PATCH /api/skills/{skill_id}` | `DELETE /api/skills/{skill_id}` | 已覆盖 |
| `Variant` | `POST /api/variants` | `GET /api/skill`、`GET /api/variant-page` | `PATCH /api/variants` | `PATCH lifecycle_status=archived` | 已覆盖 |
| `VariantVersion` | `POST /api/variant-versions` | `GET /api/variant-page` | 不允许原地更新 | 不允许硬删 | 已覆盖 append-only |
| `skill_bundle` artifact | `POST /api/skill-bundles` | `GET /api/skill-bundle` | 不允许原地更新 | 不允许硬删 | 已覆盖导入和读取 |
| `EvalCase` | `POST /api/eval-cases` | `GET /api/eval-set` | 不建议原地更新 | 未实现，正式版做 archive | 已覆盖 append-only |
| `EvalCaseVersion` | `POST /api/eval-case-versions` | `GET /api/eval-set` | 不允许原地更新 | 不允许硬删 | 已覆盖 append-only |
| `EvalSetVersion` | 由 `POST /api/eval-cases` 自动创建 | `GET /api/eval-set` | 不允许原地更新 | 不允许硬删 | 已覆盖快照 |
| `EvalRun` | `POST /api/eval-runs`、`POST /api/eval-result-imports` | `GET /api/eval-result`、`GET /api/variant-page` | finished 后不改事实 | 不允许硬删 | 已覆盖手工记录和外部导入 |
| `CaseResult` | 随 `POST /api/eval-runs` 或 `POST /api/eval-result-imports` 创建 | `GET /api/eval-result` | 不允许原地更新 | 不允许硬删 | 已覆盖 pass/fail |
| `AcceptedVerification` | `POST /api/eval-runs/accepted-verifications` | `GET /api/skills/{skill_id}/eval-runs`、`GET /api/eval-runs/compare` | 替换同一 `(variant, eval set version)` 指针 | 不硬删 | 已覆盖验证依据 |
| `AuditEvent` | 由治理命令自动写入 | `GET /api/skills/{skill_id}/audit-events`、`GET /api/skills/{skill_id}` | 不允许原地更新 | 不允许硬删 | 已覆盖最近事件读取 |

刻意不做完整 CRUD 的对象：

- `VariantVersion`、`EvalCaseVersion`、`EvalSetVersion`、`EvalRun`、`CaseResult` 都是事实记录，正式版也应默认 append-only。
- `EvalCase` 是稳定场景入口；修正文案或输入时新建 case version，并生成新的 `EvalSetVersion`。
- 删除会影响可追溯性；MVP 对 `Skill` / `Variant` 使用 `lifecycle_status` 做 archive/deprecate，而不是硬删。

## 最小闭环调用链

### 新建一个 skill 并跑通测评

1. `POST /api/skills` 创建 `Skill + EvalCorpus + EvalSetVersion v1 + 默认 Variant + VariantVersion v1`。
2. `POST /api/eval-cases` 添加测试用例，创建 `EvalCase + EvalCaseVersion v1`，并自动生成新的 `EvalSetVersion`。
3. `POST /api/eval-cases/batch` 批量添加测试用例，一次请求创建多组 `EvalCase + EvalCaseVersion v1`，但只生成一个新的 `EvalSetVersion`。
4. `POST /api/eval-runs` 选择某个 `VariantVersion + EvalSetVersion`，手工记录每条 case 的 pass/fail；也可以用 `POST /api/eval-result-imports` 导入外部 runner 的标准结果。
5. `GET /api/eval-result` 查看这次组合的详细结果。
6. `GET /api/variant-page` 回到变体页面，查看当前版本在所有测评集版本上的验证状态。

### 更新一个 skill 内容并验证不破坏历史

1. 可选：`POST /api/skill-bundles` 导入标准 skill 文件夹快照，得到 `content_ref`。
2. `POST /api/variant-versions` 发布新 `VariantVersion`，并移动 `Variant.current_version_ref`。
3. 旧 `EvalRun` 仍绑定旧 `VariantVersion`，不会被新版本覆盖。
4. 对新 `VariantVersion` 调用 `POST /api/eval-runs` 或 `POST /api/eval-result-imports`，形成新的测评事实。
5. `GET /api/variant-page` 对比当前版本、历史版本、验证状态和 bundle diff。

## Demo 持久化

当前 Python demo 通过 Repository 边界保存完整对象图：

- 默认 Repository：SQLite，路径 `demo-backend/data/skillhub-demo.sqlite3`。
- 兼容 Repository：JSON 文件，使用 `--store json --data-file /tmp/skillhub-demo.json`。
- 服务启动时：SQLite 有快照则读取快照；没有快照但存在 legacy JSON 时导入 JSON；否则使用 seed data。
- 每次 `POST` / `PATCH` 成功后：HTTP 层通过 Repository `mutate` 边界加载当前状态、执行业务变更、写回完整 `AppData`。
- SQLite 写入方式：保存 `app_state` 快照，并刷新一份规范化关系表。
- skill bundle 内容写入 `ArtifactStore`，Repository 状态只保留 artifact 元数据、hash 和 locator；旧 inline bundle 仍兼容读取。
- SQLite 读路径：`GET /api/skills`、`GET /api/skills/{skill_id}`、`GET /api/skills/{skill_id}/audit-events`、`GET /api/variant-page`、`GET /api/eval-set` 和 `GET /api/eval-result` 已经通过 SQL read model 返回。
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
GET /api/skills/{skill_id}
```

返回：

- `skill`
- `variants`
- `eval_set_version`
- `role_assignments`
- `audit_events`

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
PATCH /api/skills/{skill_id}
Content-Type: application/json

{
  "slug": "code-reviewer-v2",
  "owner_ref": "skillhub-lab",
  "default_variant_id": "variant-b"
}
```

行为：

- 更新 skill 元数据。
- 如果提供 `default_variant_id`，必须指向同一个 skill 下的 variant。
- 不创建新版本，因为入口指针不是内容快照。

### Archive Skill

```http
DELETE /api/skills/{skill_id}
X-SkillHub-Actor: product-operator
```

行为：

- 调用者必须拥有该 skill 的 `owner` 角色。
- 把 skill lifecycle 标记为 archived，不硬删历史版本、测评集、测评结果或审计事件。
- 写入 `skill.archived` audit event。
- archived skill 不再出现在 `GET /api/skills` 的 active hub 列表中。

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

### Skill Role Assignments

创建或导入 skill 时，请求级 actor 会自动获得该 skill 的 `owner` 角色。

```http
GET /api/skills/{skill_id}/role-assignments
```

返回：

```json
[
  {
    "id": "role-abc",
    "subject_type": "user",
    "subject_id": "product-operator",
    "resource_type": "skill",
    "resource_id": "skill-abc",
    "role": "owner",
    "created_by": "product-operator"
  }
]
```

授予角色：

```http
POST /api/skills/{skill_id}/role-assignments
Content-Type: application/json
X-SkillHub-Actor: product-operator

{
  "subject_id": "qa-reviewer",
  "role": "evaluator"
}
```

撤销角色：

```http
DELETE /api/role-assignments/{role_assignment_id}
X-SkillHub-Actor: product-operator
```

规则：

- 授予和撤销需要 `owner`。
- 删除最后一个 `owner` 会被拒绝。
- 重复授予同一个 `subject + skill + role` 会返回已有记录。

### Skill Audit Events

```http
GET /api/skills/{skill_id}/audit-events?limit=50&actor=product-operator&action=role.assigned&resource_type=skill
```

返回当前 skill 作用域内的治理事件，按 `created_at desc, id desc` 排序。当前 skill 作用域包含：

- `resource_type=skill` 且 `resource_id={skill_id}`。
- `resource_type=variant` 且 `resource_id` 属于该 skill 的 variant。
- `resource_type=eval_run` 且 `resource_id` 属于该 skill 的 eval run。

查询参数：

| 参数 | 说明 |
| --- | --- |
| `limit` | 默认 50，服务端限制在 1..200。 |
| `actor` | 可选，精确匹配 `actor_ref`。 |
| `action` | 可选，精确匹配 `action`。 |
| `resource_type` | 可选，精确匹配 `skill`、`variant`、`eval_run` 等资源类型。 |

```json
[
  {
    "id": "audit-abc",
    "actor_ref": "product-operator",
    "action": "skill.archived",
    "resource_type": "skill",
    "resource_id": "skill-code-reviewer",
    "payload": { "skill_id": "skill-code-reviewer" },
    "created_at": "2026-05-13T20:00:00Z"
  }
]
```

这个 endpoint 只读审计事实，不负责权限变更；角色授权和撤销仍通过 role assignment endpoint 完成。`GET /api/skills/{skill_id}` 仍只内嵌最近 10 条，供概览治理面板快速展示。

### Promotion Review

正式版后端新增“设为当前版本评审”读模型。它不移动指针，只把候选版本、当前版本、目标测评集版本、最新测评结果、逐 case 影响和文件 diff 汇总成一个决策视图。

```http
GET /api/variants/{variant_id}/promotion-review?candidate_version_id=varver-v2&eval_set_version_id=evalsetver-v3
```

`eval_set_version_id` 可省略；省略时使用该 skill 的 Primary eval set 当前版本。

返回重点字段：

```json
{
  "variant": { "id": "variant-a", "tags": ["codex"] },
  "current_version": { "id": "varver-v1", "version_number": 1 },
  "candidate_version": { "id": "varver-v2", "version_number": 2 },
  "eval_set_version": { "id": "evalsetver-v3", "version_number": 3 },
  "candidate_run": { "id": "evalrun-candidate", "summary": { "passed": 2, "failed": 0, "total": 2 } },
  "current_run": { "id": "evalrun-current", "summary": { "passed": 1, "failed": 1, "total": 2 } },
  "readiness": {
    "status": "ready",
    "label": "可设为当前版本",
    "requires_note": false
  },
  "comparison_summary": {
    "fixed": 1,
    "regressed": 0,
    "stable_pass": 1,
    "stable_fail": 0,
    "missing_baseline": 0,
    "missing_candidate": 0
  },
  "case_comparisons": [
    {
      "case_title": "PR: missing tenant filter",
      "change": "fixed",
      "change_label": "修复",
      "current_passed": false,
      "candidate_passed": true
    }
  ],
  "bundle_diff": { "summary": { "changed": 1, "added": 0, "removed": 0 } }
}
```

`readiness.status` 取值：

| 状态 | 页面文案 | 含义 |
| --- | --- | --- |
| `ready` | 可设为当前版本 | 候选版本已完整测评，未发现回退或失败。 |
| `risky` | 有风险 | 存在回退、仍未通过或缺少当前版本对照。 |
| `unverified` | 未验证 | 候选版本没有目标测评集版本上的 finished run。 |
| `blocked` | 无法设为当前版本 | 测评不完整或候选版本没有可审查文件快照。 |

### Promote Variant Version

设为当前版本必须带证据，不能只传 `variant_id + version_id`。命令成功后移动 `Variant.current_version_id`，并写入 `promotion_decisions` 和 `audit_events`。
调用者必须在目标 skill 上拥有 `owner` 或 `maintainer` 角色。

```http
POST /api/variants/promotions
Content-Type: application/json
X-SkillHub-Actor: tester

{
  "variant_id": "variant-a",
  "version_id": "varver-v2",
  "evidence_eval_run_id": "evalrun-candidate",
  "eval_set_version_id": "evalsetver-v3",
  "decision_note": "v2 修复 tenant scope 漏报。",
  "accept_risk": false
}
```

校验规则：

- `version_id` 必须属于 `variant_id`。
- `evidence_eval_run_id` 必须绑定 `version_id + eval_set_version_id`。
- 证据 run 必须是最新的 finished candidate run。
- 如果评审存在回退或仍未通过，`decision_note` 不能为空，最多 1000 字符，且 `accept_risk` 必须为 `true`；缺失或超长会返回 `field_errors.decision_note`。

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
- `title`、`input_text`、`expected_output` 和 `notes` 使用服务端长度上限；超限返回字段级 `field_errors`，不会自动截断。

### Batch Create Eval Cases

```http
POST /api/eval-cases/batch
Content-Type: application/json
X-SkillHub-Actor: tester

{
  "skill_id": "skill-code-reviewer",
  "cases": [
    {
      "title": "PR: missing tenant scope",
      "input_text": "Project.all()",
      "expected_output": "应指出缺少 tenant scope。",
      "notes": "从历史 PR 整理。"
    },
    {
      "title": "PR: token logging",
      "input_text": "console.log(token)",
      "expected_output": "应指出 token logging 风险。"
    }
  ]
}
```

行为：

- 为每条输入创建 `EvalCase` 和 `EvalCaseVersion v1`。
- 为每条输入创建 input / expected artifacts。
- 基于当前最新测评集创建一个新的 `EvalSetVersion`，包含旧 case versions 和本批新增 case versions。
- 任一 case 缺少 title、input 或 expected output 时，整个请求失败，不写入部分数据。
- 请求体校验失败时返回行级 `field_errors`，例如 `cases[0].title` 或 `cases[1].expected_output`；客户端可把这些错误回填到批量录入控件或表格行。
- 任一 case 超过标题、Input、Expected output 或 Notes 长度上限时，整个请求失败，不写入部分有效数据。

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
    "casever-null-v1": true,
    "casever-auth-v1": false
  }
}
```

行为：

- 创建 `EvalRun`。
- 为 eval set 中每个 case 创建 `CaseResult`。
- 未提供的 case 默认 `false`，demo 阶段这样更容易暴露遗漏。
- `variant_version_id` 和 `eval_set_version_id` 必须属于同一个 skill，否则返回 400。

### Import Eval Result

标准 schema: [`schemas/eval-result-import.schema.json`](../schemas/eval-result-import.schema.json)

示例 fixture: [`fixtures/eval-result-import.code-reviewer.json`](../fixtures/eval-result-import.code-reviewer.json)

```http
POST /api/eval-result-imports
Content-Type: application/json

{
  "variant_version_id": "version-a-v1",
  "eval_set_version_id": "evalset-v1",
  "strategy_ref": "external-script-v1",
  "run_config_hash": "external-script-config",
  "results": {
    "casever-null-v1": true,
    "casever-auth-v1": false
  }
}
```

行为：

- 创建 `eval_result_import` artifact，保存外部导入的原始 JSON。
- 创建 `EvalRun`，`strategy_ref` 和 `run_config_hash` 来自导入 payload。
- 为 eval set 中每个 `EvalCaseVersion` 创建 `CaseResult`。
- `results` 的 key 必须属于该 `EvalSetVersion.case_version_refs`；未知 case version 返回 400。
- 外部 runner 应先读取目标 `GET /api/eval-set`，再按返回的 `case_version_refs` 生成 payload；不要硬编码历史 case id。
- `results` 的 value 必须是 JSON boolean，不做字符串 `"true"` / `"false"` 的隐式转换。
- 未提供的 case 默认 `false`。正式版可以把缺失结果升级成 `missing` 或导入校验错误；demo 阶段先保持与手工记录一致。
- `variant_version_id` 和 `eval_set_version_id` 必须属于同一个 skill，否则返回 400。

Demo runner:

```bash
cd demo-backend
python -m skillhub_demo.external_runner \
  --variant-version-id version-a-v1 \
  --eval-set-version-id evalset-v1 \
  --fail-case-title-contains 仅重命名
```

Demo runner 当前提供四个策略：`all_pass`、`title_contains_fail`、`expected_keyword`、`external_command`。其中 `external_command` 会把 `{"eval_set": ...}` 写入命令 stdin，并要求命令 stdout 返回 `{ "results": { "<case_version_id>": true } }`。最小 evaluator 示例见 [`examples/evaluators/keyword_evaluator.py`](../examples/evaluators/keyword_evaluator.py)。

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
- 真实认证：把本地 `X-SkillHub-Actor` 替换成 session、JWT 或 OIDC token。
- 更完整 capability：谁能创建 skill、发布版本、切默认入口仍需要从本地默认策略升级为可配置策略。
