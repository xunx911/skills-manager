# Run Comparison 与 Accepted Verification 设计规格

日期：2026-05-10

## 背景

Promotion review 已经解决“候选版本能否设为当前版本”的决策面，但 History 仍然只是 run 列表。用户现在能看到多次 `EvalRun`，却不能直接回答：

1. 两次测评到底修复了哪些 case？
2. 哪些 case 回退了？
3. 当前 SkillHub 首页展示的验证依据是哪一次 run？
4. 团队应该信任“最近一次 run”，还是某个明确接受过的 run？

因此下一步需要补两个能力：

- `Run comparison`：比较两个 finished run 在同一个 `EvalSetVersion` 上的逐 case 差异。
- `Accepted verification`：把某个 run 明确标记为当前变体在某个 eval set version 上的验证依据。

## 实践调研

- LangSmith 的 experiment comparison 允许选择多个 experiment，重点展示 regressions、improvements，并在两个实验时提供 side-by-side diff；它强调“同一 dataset 下比较变化”，而不是只看单次结果。参考：<https://docs.langchain.com/langsmith/compare-experiment-results>
- W&B 的 pinned/baseline runs 用 baseline run 作为比较参考点，并在表格和图里显示 metric deltas；它强调“显式 reference point”，避免用户在大量 runs 中迷路。参考：<https://docs.wandb.ai/models/runs/compare-runs>
- W&B Run Comparer 把 runs 以列形式展示配置和指标差异，适合横向比较少量候选。参考：<https://docs.wandb.ai/models/app/features/panels/run-comparer>
- Phoenix datasets & experiments 强调用同一批 inputs 和 evaluators 比较 prompt/model/application 变化，并通过 evaluator annotations 表示优化方向。参考：<https://arize.com/docs/phoenix/datasets-and-experiments/how-to-experiments/run-experiments>
- GitHub protected branch / required status checks 强调重要指针移动前必须有通过的检查；SkillHub 的 accepted verification 应该扮演类似“当前分发依据”的检查记录。参考：<https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches>

## 产品原则

1. **同一 EvalSetVersion 才能比较。** 如果 eval set version 不同，case 集合和 case version 都可能不同，第一版不做跨快照比较。
2. **Accepted verification 是指针，不是复制结果。** 它只指向一个 immutable `EvalRun`，不重写 run、case result 或 variant version。
3. **默认只接受 finished run。** queued/running/failed 不能成为 accepted verification。
4. **同一 variant + eval set version 只有一个 accepted run。** 新接受 run 时替换指针，并写 audit event。
5. **比较视图优先服务决策。** 第一版不做复杂 chart，只展示 score delta、修复/回退摘要、逐 case 对比和接受按钮。

## 用户故事

### Story 1：比较两次手工测评

用户在同一个 skill 上记录两次 run：

- Run A：当前版本在 Primary v2 上 0/1。
- Run B：候选版本在 Primary v2 上 1/1。

用户打开 `历史`，选择 Run A 作为 baseline，Run B 作为 candidate，点击 `比较 runs`。

页面显示：

- Baseline: 0%
- Candidate: 100%
- Delta: +100
- Case impact: `修复 1`、`回退 0`
- 逐 case 行：`PR: missing tenant scope` 标记为 `修复`

### Story 2：标记 accepted verification

用户确认 Run B 是当前可接受的验证依据，点击 `接受为验证依据`。

系统：

- 写入或更新 `accepted_verifications` 指针。
- 写入 `audit_events`。
- History row 显示 `Accepted`。
- Skill summary 优先显示 accepted run；没有 accepted run 时仍可显示 latest finished run，但文案要区分。

### Story 3：阻止不可比较 runs

用户选择两个不同 `EvalSetVersion` 的 run。

系统：

- 不返回比较结果。
- 显示“只能比较同一个 EvalSetVersion 的 runs”。
- 不允许把不匹配的 run 作为 accepted verification。

## 后端设计

### 新表：accepted_verifications

```sql
create table accepted_verifications (
  id text primary key,
  skill_id text not null,
  variant_id text not null,
  variant_version_id text not null,
  eval_set_version_id text not null,
  eval_run_id text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by text not null,
  constraint accepted_verifications_id_skill_unique unique (id, skill_id),
  constraint accepted_verifications_variant_eval_set_unique unique (variant_id, eval_set_version_id),
  constraint accepted_verifications_variant_skill_fkey foreign key (variant_id, skill_id) references variants(id, skill_id),
  constraint accepted_verifications_variant_version_skill_fkey foreign key (variant_version_id, skill_id) references variant_versions(id, skill_id),
  constraint accepted_verifications_eval_set_version_skill_fkey foreign key (eval_set_version_id, skill_id) references eval_set_versions(id, skill_id),
  constraint accepted_verifications_eval_run_skill_fkey foreign key (eval_run_id, skill_id) references eval_runs(id, skill_id)
);
```

语义：

- `variant_id + eval_set_version_id` 是业务唯一键。
- 替换 accepted run 时更新这行，而不是新增多行。
- 历史理由通过 `audit_events` 保留。

### Read model：Run Comparison

```http
GET /api/eval-runs/compare?baseline_run_id=evalrun-a&candidate_run_id=evalrun-b
```

校验：

- 两个 run 必须存在。
- 两个 run 必须属于同一个 skill。
- 两个 run 必须绑定同一个 `eval_set_version_id`。
- 两个 run 必须是 `finished`。

返回：

```json
{
  "skill": { "id": "skill-a", "slug": "code-reviewer" },
  "eval_set_version": { "id": "evalsetver-v2", "version_number": 2 },
  "baseline": {
    "eval_run": { "id": "evalrun-a", "summary": { "passed": 0, "total": 1 } },
    "variant": { "id": "variant-a", "label": "Imported" },
    "variant_version": { "id": "varver-a-v1", "version_number": 1 }
  },
  "candidate": {
    "eval_run": { "id": "evalrun-b", "summary": { "passed": 1, "total": 1 } },
    "variant": { "id": "variant-a", "label": "Imported" },
    "variant_version": { "id": "varver-a-v2", "version_number": 2 }
  },
  "summary": {
    "baseline_pass_rate": 0,
    "candidate_pass_rate": 100,
    "delta": 100,
    "fixed": 1,
    "regressed": 0,
    "stable_pass": 0,
    "stable_fail": 0,
    "missing_baseline": 0,
    "missing_candidate": 0
  },
  "case_comparisons": [
    {
      "case_title": "PR: missing tenant scope",
      "change": "fixed",
      "change_label": "修复",
      "baseline_passed": false,
      "candidate_passed": true
    }
  ],
  "candidate_accepted_verification": null
}
```

### Command：Accept Eval Run As Verification

```http
POST /api/eval-runs/accepted-verifications
Content-Type: application/json

{
  "eval_run_id": "evalrun-b",
  "note": "Primary v2 上修复 tenant scope 回归，作为当前验证依据。",
  "actor": "product-operator"
}
```

校验：

- run 必须是 `finished`。
- run 的 `variant_version` 必须属于某个 variant。
- run 的 `eval_set_version` 必须和 run 同 skill。
- 写入或替换 `(variant_id, eval_set_version_id)` 的 accepted pointer。
- 写入 `audit_events`，action 为 `eval_run.accepted_verification_set`。

## 前端设计

### HistoryPane 交互

在每个 history row 增加两个轻量按钮：

- `设为基线`
- `设为候选`

Toolbar 增加：

- Baseline chip
- Candidate chip
- `比较 runs`

当两个 run 都选中后，点击 `比较 runs` 进入 `run-compare` mode。

### RunComparePane

页面结构：

- 顶部摘要：Baseline score、Candidate score、Delta、EvalSetVersion。
- 逐 case impact：复用 promotion comparison 的视觉语言，但字段改成 baseline/candidate。
- 右侧决策卡：显示候选 run 是否已经 accepted；如果没有，允许填写 note 并 `接受为验证依据`。

### Skill summary 语义

第一版保持 `latest_accepted_eval_run` 字段兼容，但后端逻辑改为：

1. 如果 default variant current version + primary eval set current version 有 accepted verification，返回 accepted run。
2. 否则返回 latest finished run。

前端文案继续显示 `Verification`，后续再拆 `accepted` 和 `latest finished` 两种文案。

## 测试策略

### 后端

1. `run_comparison` 能比较两个同 eval set version 的 run，并返回 fixed/regressed summary。
2. 不同 eval set version 的 run 被拒绝。
3. accept verification 成功写入 pointer 和 audit event。
4. accept verification 拒绝 failed run。
5. skill summary 优先返回 accepted run。

### 前端

1. E2E：记录 baseline fail 和 candidate pass，History 选择两者，打开 compare，看到 `修复` 和 `+100`，点击 `接受为验证依据`，row 显示 `Accepted`。
2. 视觉基线：新增 run comparison ready 截图。

## 非目标

- 不做任意多 run matrix。
- 不做跨 eval set version 智能对齐。
- 不做 chart、趋势线、保存视图。
- 不做权限审批。
- 不做自动 runner 调度。

## 自检

- 范围聚焦：只做两个 run 的比较和一个 accepted pointer。
- 数据严谨：比较要求 same skill + same eval set version + finished。
- 与现有模型兼容：复用 `EvalRun`、`CaseResult`、`VariantVersion`、`EvalSetVersion`。
- 没有占位字段或待定术语。
