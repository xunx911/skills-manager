# SkillHub 设为当前版本评审设计规格

日期：2026-05-09

状态：已获用户口头确认，待用户审阅本文档后进入实现计划

## 1. 背景

当前正式版已经具备这些能力：

- 标准 skill folder / zip 导入。
- skill、variant、variant version、eval case、eval set version、eval run 的基础闭环。
- `VariantVersion` 是不可变内容快照。
- `EvalSetVersion` 是不可变测试集快照。
- `EvalRun` 精确绑定 `VariantVersion + EvalSetVersion`。
- 工作台可以查看 bundle 文件、比较两个 bundle 版本、查看测评历史、查看 case 历史。

但还有一个产品级缺口：维护者创建候选版本后，平台只知道“可以把 `Variant.current_version_id` 指过去”，却没有一个严谨、顺手、可审计的“是否应该设为当前版本”的决策面。

这会带来三个问题：

1. 用户可能只看总分，不知道新版本具体修了什么、坏了什么。
2. 用户可能把旧测评结果误当成新版本证据。
3. 以后回看历史时，只知道当前版本变了，不知道当时基于哪次测评、哪个测试集、什么理由做了决定。

本阶段要解决的是：把“设为当前版本”从一个裸按钮，升级成一个证据驱动的评审流程。

## 2. 中文术语

页面和文档默认使用中文术语，英文只保留在 API 字段、代码标识和必要产品引用里。

| 内部概念 | 页面中文文案 | 含义 |
| --- | --- | --- |
| `candidate version` | 候选版本 | 准备评审的新版本 |
| `current version` | 当前版本 | 该 variant 现在默认使用的版本 |
| `promotion review` | 设为当前版本评审 | 判断候选版本能不能成为当前版本 |
| `promote` | 设为当前版本 | 把 `Variant.current_version_id` 指向候选版本 |
| `regression` | 回退 | 当前版本通过，候选版本不通过 |
| `improvement` | 修复 | 当前版本不通过，候选版本通过 |
| `stable pass` | 稳定通过 | 当前版本和候选版本都通过 |
| `stable fail` | 仍未通过 | 当前版本和候选版本都不通过 |
| `unverified` | 未验证 | 没有可用的候选版本测评 |
| `risky` | 有风险 | 候选版本有测评，但存在回退或仍未通过 |
| `ready` | 可设为当前版本 | 候选版本已验证，且没有发现回退 |

## 3. 外部实践调研

### GitHub Required Checks

GitHub 的 required status checks 强调：合并前必须看最新提交对应的检查结果，旧提交上的检查不能代表新提交。

适配 SkillHub：

- 候选版本必须绑定它自己的 `EvalRun`，不能拿当前版本或旧候选版本的测评结果当证据。
- 评审页必须显示 exact binding：`VariantVersion + EvalSetVersion + EvalRun`。
- 如果候选版本没有对应测评，页面应显示“未验证”，主操作是“运行测评”，不是“设为当前版本”。

参考：https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks

### LangSmith Experiment Compare

LangSmith 的实验对比不是只看总分，而是突出每条样例的提升和回退。它支持将某个实验设为 baseline，并在对比中标出表现变好或变差的样例。

适配 SkillHub：

- 不能只显示 `41/42`，必须显示逐 case 的“修复 / 回退 / 稳定通过 / 仍未通过”。
- 当前版本测评是对比基线，候选版本测评是评审对象。
- 如果当前版本没有同一 `EvalSetVersion` 上的测评，可以展示候选版本结果，但不能计算修复/回退，只能标记为“缺少当前版本对照”。

参考：https://docs.langchain.com/langsmith/compare-experiment-results

### Langfuse Prompt Version Labels

Langfuse 的 prompt version 用 label 管理部署，例如 `production` 指向某个具体版本。回滚本质是把 label 重新指向旧版本。

适配 SkillHub：

- `Variant.current_version_id` 就是 SkillHub 里的当前版本指针。
- 设为当前版本必须被当成有意图的指针移动，而不是普通字段更新。
- 每次移动指针都应有决策记录，包括目标版本、证据测评、测试集版本、理由和风险摘要。

参考：https://langfuse.com/docs/prompt-management/features/prompt-version-control

### LaunchDarkly Approvals

LaunchDarkly 的 approvals 和 release 流程强调：变更可以先形成待确认状态，审阅后再 apply；生产环境可以要求审批、理由和风险控制。

适配 SkillHub：

- 第一版不做多人审批，但保留“确认风险并设为当前版本”的决策动作。
- 如果存在回退，允许维护者带理由继续设为当前版本，但必须留下说明。
- 未来可以在同一模型上扩展多人审核、环境、灰度和自动回滚。

参考：https://launchdarkly.com/docs/home/releases/approvals

## 4. 目标

本阶段让维护者在设为当前版本前能回答六个问题：

1. 候选版本和当前版本分别是什么？
2. 候选版本相对当前版本改了哪些 skill 文件？
3. 候选版本在哪个测试集版本上跑过测评？
4. 候选版本相对当前版本修复了哪些 case？
5. 候选版本造成了哪些回退？
6. 如果仍然要设为当前版本，当时的理由和证据是什么？

完成后，`Variant.current_version_id` 的每次变化都应该能被解释：谁在什么时候，基于哪次测评，接受了什么风险，把哪个版本设为了当前版本。

## 5. 非目标

第一版不做：

- 多人审批。
- 组织权限和审批规则。
- 环境区分，例如 dev / staging / production。
- 灰度发布和线上监控。
- 自动运行外部评测器。
- 自动生成优化后的 skill。
- 长期保存大规模实验矩阵。
- 复杂阈值策略，例如“必须通过率大于 95% 且关键 case 全通过”。

这些能力重要，但会把第一版决策面做重。第一版先把单用户证据链和审计链打通。

## 6. 方案比较

### 方案 A：只做设为当前版本前检查

页面只显示候选版本是否有测评：

```text
Baseline v4
main v6：41/42 通过
[设为当前版本]
```

优点：

- 实现最快。
- 不需要新增太多数据结构。

缺点：

- 用户仍然不知道具体修了什么、坏了什么。
- 没有文件 diff 和逐 case 对比。
- 容易把总分提升误认为一定可上线。

### 方案 B：做设为当前版本评审页

页面分成三块：

```text
左侧：文件变更
中间：测试用例对比
右侧：决策栏
```

优点：

- 能同时解释内容变化和测评变化。
- 与现有 bundle diff、run history、case history 自然衔接。
- 能支撑审计记录和后续审批扩展。
- 符合“可验证地更新 skill”的产品差异点。

缺点：

- 需要新增后端 read model、决策记录、前端页面和 E2E。

### 方案 C：做完整发布流水线

流程类似：

```text
草稿 -> 已测评 -> 已审批 -> 当前版本 -> 线上监控
```

优点：

- 长远最完整。

缺点：

- 第一版过重，会引入权限、环境、灰度、监控和多人协作。
- 当前产品还在单用户本地工作台阶段，不适合直接做 release pipeline。

### 推荐

采用方案 B。

它是当前最合适的产品切面：足够成熟，能把“文件差异 + 测评结果 + 设为当前版本”串成一个闭环；同时保持单用户和低复杂度，不提前引入企业级发布流水线。

## 7. 页面设计

### 7.1 入口

入口放在两个位置：

1. `差异` 面板：当用户正在比较当前版本和候选版本时，显示 `设为当前版本评审`。
2. `变体` 历史版本列表：候选版本旁边显示 `评审`。

示例：

```text
Baseline 历史版本

v3  当前版本
v4  候选版本    [设为当前版本评审]
```

第一版以 `/skills` 工作台内的模式切换实现，不强制新增独立路由。后续可以补：

```text
/variants/{variant_id}/versions/{candidate_version_id}/review
```

### 7.2 顶部摘要

顶部必须第一眼给出结论：

```text
设为当前版本评审：code-reviewer / Baseline v4

状态：有风险
原因：发现 1 个回退

当前版本：Baseline v3
候选版本：Baseline v4
测试集：main v6
候选版本测评：41/42 通过
当前版本测评：39/42 通过

[重新测评] [继续修改] [确认风险并设为当前版本]
```

状态规则：

| 状态 | 展示文案 | 主操作 |
| --- | --- | --- |
| `ready` | 可设为当前版本 | 设为当前版本 |
| `risky` | 有风险 | 确认风险并设为当前版本 |
| `unverified` | 未验证 | 运行测评 |
| `blocked` | 无法设为当前版本 | 查看阻塞原因 |

`blocked` 用于数据不合法，例如候选版本不属于该 variant、候选版本没有 bundle snapshot、选择的测评结果不是候选版本自己的测评。

### 7.3 文件变更

左侧展示 bundle 文件 diff 摘要，复用现有 artifact diff 能力：

```text
文件变更

SKILL.md                  已修改   +23 -8
examples/tenant.md        已修改   +14 -2
checklists/review.md      新增     +31
```

点开文件后展示文本 diff：

```diff
- 重点检查 SQL 注入和空值问题。
+ 重点检查权限边界、tenant scope、owner scope、SQL 注入。
+ 如果查询读取用户数据但没有 tenant_id / owner_id 过滤，必须指出。
```

用户要能回答：候选版本到底改了什么。

### 7.4 测试用例对比

中间展示逐 case 对比：

```text
用例对比

变化      测试用例                         当前版本   候选版本
修复      SQL 查询缺 tenant_id             不通过     通过
修复      GraphQL resolver 缺 owner check  不通过     通过
稳定通过  API 返回敏感字段                 通过       通过
回退      只重命名文件，不应误报            通过       不通过
仍未通过  批量导出权限边界                 不通过     不通过
```

变化计算规则：

| 当前版本结果 | 候选版本结果 | 中文变化 |
| --- | --- | --- |
| 不通过 | 通过 | 修复 |
| 通过 | 不通过 | 回退 |
| 通过 | 通过 | 稳定通过 |
| 不通过 | 不通过 | 仍未通过 |
| 无当前结果 | 通过 / 不通过 | 缺少对照 |
| 有当前结果 | 无候选结果 | 候选缺失 |

点开一条 case 后显示：

```text
测试用例：只重命名文件，不应误报

输入：
rename user.py -> account.py
no behavior change

期望输出：
不应该报告安全问题。

当前版本结果：
通过

候选版本结果：
不通过

说明：
候选版本可能把纯重命名误判成权限风险。
```

第一版的“说明”不做 AI 自动解释，只用固定模板描述变化；后续可以接入 LLM 辅助解释。

### 7.5 决策栏

右侧像 GitHub merge box，但使用中文业务语义：

```text
设为当前版本准备情况

风险项
- 发现 1 个回退
- 仍有 1 个仍未通过的用例

通过项
- 候选版本是不可变 bundle snapshot
- 候选版本在 main v6 上跑过完整测评
- 总通过数从 39/42 提升到 41/42
- 测评绑定的是 exact VariantVersion + EvalSetVersion

建议
先处理回退；如果确认可接受，必须填写理由。
```

按钮策略：

| 状态 | 按钮 |
| --- | --- |
| 可设为当前版本 | `设为当前版本` |
| 有风险 | `确认风险并设为当前版本` |
| 未验证 | `运行测评` |
| 无法设为当前版本 | 禁用主按钮，显示阻塞原因 |

### 7.6 确认理由

如果存在回退或仍未通过，用户点击主按钮时必须填写理由：

```text
确认风险

候选版本有 1 个回退、1 个仍未通过。
请说明为什么仍然要设为当前版本。

[ v4 修复两个高优先级权限漏报；纯重命名误报风险可接受，下一版补 case。 ]

[取消] [设为当前版本]
```

如果没有回退，但仍有“仍未通过”，也要求理由。因为它代表候选版本还没有完全解决测试集里的问题。

## 8. 数据契约

### 8.1 设为当前版本评审 read model

新增 endpoint：

```text
GET /api/variants/{variant_id}/promotion-review?candidate_version_id={variant_version_id}&eval_set_version_id={eval_set_version_id?}
```

参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `variant_id` | string | 目标 variant |
| `candidate_version_id` | string | 候选版本 |
| `eval_set_version_id` | string | 可选；不传时使用 primary eval set 的 current version |

返回结构：

```json
{
  "skill": { "id": "skill_123", "slug": "code-reviewer" },
  "variant": { "id": "variant_123", "label": "Baseline", "tags": ["codex"] },
  "current_version": { "id": "varver_v3", "version_number": 3 },
  "candidate_version": { "id": "varver_v4", "version_number": 4 },
  "eval_set": { "id": "evalset_main", "name": "main" },
  "eval_set_version": { "id": "evalset_v6", "version_number": 6 },
  "candidate_run": {
    "id": "evalrun_candidate",
    "summary": { "passed": 41, "failed": 1, "total": 42 },
    "status": "finished",
    "created_at": "2026-05-09T12:00:00Z"
  },
  "current_run": {
    "id": "evalrun_current",
    "summary": { "passed": 39, "failed": 3, "total": 42 },
    "status": "finished",
    "created_at": "2026-05-09T11:00:00Z"
  },
  "readiness": {
    "status": "risky",
    "label": "有风险",
    "reason": "发现 1 个回退",
    "requires_note": true,
    "risk_items": ["发现 1 个回退"],
    "blocking_items": [],
    "passing_items": ["候选版本在 main v6 上跑过完整测评"]
  },
  "comparison_summary": {
    "fixed": 2,
    "regressed": 1,
    "stable_pass": 38,
    "stable_fail": 1,
    "missing_baseline": 0,
    "missing_candidate": 0
  },
  "case_comparisons": [
    {
      "case_id": "case_123",
      "case_title": "只重命名文件，不应误报",
      "case_version_id": "casever_123",
      "change": "regressed",
      "change_label": "回退",
      "current_passed": true,
      "candidate_passed": false,
      "input_text": "rename user.py -> account.py",
      "expected_output_text": "不应该报告安全问题。"
    }
  ],
  "bundle_diff": {
    "summary": { "added": 1, "removed": 0, "changed": 2, "unchanged": 5, "binary": 0 },
    "files": []
  }
}
```

read model 规则：

- `candidate_version_id` 必须属于 `variant_id`。
- `current_version` 来自 `variant.current_version_id`。
- `eval_set_version_id` 不传时，使用该 skill 的 primary eval set current version。
- `candidate_run` 选择候选版本在目标 eval set version 上最新的 `finished` run。
- `current_run` 选择当前版本在同一个 eval set version 上最新的 `finished` run。
- `case_comparisons` 以目标 `EvalSetVersion` 的 case version 列表为准。
- 文件 diff 复用 `GET /api/artifacts/diff` 的逻辑，但 read model 可以内联 summary 和 files，减少前端拼装。

### 8.2 设为当前版本命令

更新或扩展现有 endpoint：

```text
POST /api/variants/promotions
```

请求：

```json
{
  "variant_id": "variant_123",
  "version_id": "varver_v4",
  "evidence_eval_run_id": "evalrun_candidate",
  "eval_set_version_id": "evalset_v6",
  "decision_note": "v4 修复两个高优先级权限漏报；纯重命名误报风险可接受，下一版补 case。",
  "accept_risk": true,
  "actor": "product-operator"
}
```

命令规则：

- `version_id` 必须属于 `variant_id`。
- `evidence_eval_run_id` 必须绑定 `version_id`。
- `evidence_eval_run_id` 必须绑定 `eval_set_version_id`。
- `evidence_eval_run_id` 必须是 `finished`。
- 如果评审结果要求理由，`decision_note` 不能为空。
- 如果存在回退或仍未通过，`accept_risk` 必须为 true。
- 命令成功后移动 `Variant.current_version_id`。
- 命令成功后写入决策记录和 `audit_events`。

### 8.3 决策记录

新增表 `promotion_decisions`，用于保留可查询的结构化历史：

| 字段 | 说明 |
| --- | --- |
| `id` | 决策记录 id |
| `skill_id` | 所属 skill |
| `variant_id` | 所属 variant |
| `from_version_id` | 原当前版本，可为空 |
| `to_version_id` | 被设为当前的版本 |
| `eval_set_version_id` | 作为证据的测试集版本 |
| `evidence_eval_run_id` | 作为证据的候选版本测评 |
| `baseline_eval_run_id` | 当前版本对照测评，可为空 |
| `readiness_status` | `ready / risky / unverified / blocked` |
| `summary` | JSON，保存修复、回退、稳定通过、仍未通过统计 |
| `decision_note` | 用户填写的理由 |
| `created_at` | 创建时间 |
| `created_by` | 操作者 |

`audit_events` 继续保存通用审计事件，payload 包含 `promotion_decision_id`。

## 9. 状态与边界情况

### 9.1 没有当前版本

新建 variant 理论上会立刻有 v1 current。若历史数据出现没有当前版本的情况：

- 页面显示 `当前版本：无`。
- 不能计算修复/回退。
- 如果候选版本有完整测评，可以设为当前版本，但 readiness 显示 `可设为当前版本`，说明是首次设定。

### 9.2 没有当前版本对照测评

如果当前版本没有在同一个 eval set version 上跑过测评：

- 显示候选版本通过率。
- case 表只显示候选结果，变化标记为 `缺少对照`。
- readiness 不因缺少对照而 blocked，但会显示风险提示。
- 若候选版本存在失败 case，仍要求填写理由。

### 9.3 候选版本没有测评

- readiness 为 `未验证`。
- 不显示设为当前版本按钮。
- 主操作是 `运行测评`。

### 9.4 测评不完整

如果候选 run 的 case result 数量小于 eval set version 的 case 数：

- readiness 为 `无法设为当前版本`。
- 阻塞项显示 `候选版本测评不完整`。
- 需要重新测评。

### 9.5 候选版本没有 bundle diff

如果候选版本不是 `skill_bundle` artifact，或者无法读取文件树：

- readiness 为 `无法设为当前版本`。
- 阻塞项显示 `候选版本没有可审查的文件快照`。
- 第一版不允许从不可审查内容设为当前版本。

## 10. 前端结构

`decision-workbench.tsx` 已经偏大，本阶段实现时要避免继续把所有逻辑塞进去。

推荐拆分：

```text
apps/web/components/promotion-review/
  promotion-review-pane.tsx
  promotion-readiness-card.tsx
  promotion-case-comparison.tsx
  promotion-note-dialog.tsx
  promotion-types.ts
```

`decision-workbench.tsx` 只负责：

- 模式切换。
- 选中 variant/version/eval set。
- 调用 loader。
- 把 read model 交给 `PromotionReviewPane`。

组件责任：

| 组件 | 责任 |
| --- | --- |
| `PromotionReviewPane` | 页面三栏布局和整体状态 |
| `PromotionReadinessCard` | 右侧决策栏、阻塞项、通过项、主按钮 |
| `PromotionCaseComparison` | 中间逐 case 对比表和详情展开 |
| `PromotionNoteDialog` | 风险确认理由输入 |

视觉原则：

- 不做卡片套卡片。
- 左侧文件 diff 保持现有 diff workbench 风格。
- 中间 case 表格保持高密度、可扫描。
- 右侧决策栏使用深色或高对比区域，但不能抢过主内容。
- 动效只用于状态切换、展开详情和确认弹层，不做装饰性动画。

## 11. 测试策略

### 后端测试

新增 API command tests：

1. 候选版本有完整测评、无回退时，readiness 为 `ready`。
2. 候选版本有回退时，readiness 为 `risky`，且 `requires_note = true`。
3. 候选版本没有测评时，readiness 为 `unverified`。
4. 候选 run 不是候选版本自己的 run 时，设为当前版本命令拒绝。
5. 存在回退但没有 `decision_note` 时，设为当前版本命令拒绝。
6. 命令成功后，`Variant.current_version_id` 指向候选版本，并写入 `promotion_decisions` 和 `audit_events`。

新增 repository tests：

1. `promotion_review(...)` 正确生成修复、回退、稳定通过、仍未通过统计。
2. `promote_variant_version(...)` 保存结构化决策记录。
3. 跨 skill / 跨 variant 证据被拒绝。

### 前端 E2E

新增 Playwright 流程：

1. 导入标准 skill bundle。
2. 添加两个 case。
3. 记录当前版本测评：一个通过、一个不通过。
4. 上传候选版本。
5. 记录候选版本测评：两个都通过。
6. 打开 `设为当前版本评审`。
7. 看到 `修复`、`稳定通过`、`可设为当前版本`。
8. 点击 `设为当前版本`。
9. 确认 variant 当前版本变成候选版本。

新增风险流程：

1. 当前版本某 case 通过。
2. 候选版本同一 case 不通过。
3. 评审页显示 `回退` 和 `有风险`。
4. 不填理由不能设为当前版本。
5. 填写理由后可以确认风险并设为当前版本。

视觉回归：

- 新增一个桌面评审页截图。
- 新增一个移动端评审页截图，确认三栏在移动端变成纵向顺序，按钮不溢出。

## 12. 文档更新

实现阶段需要更新：

- `README.md`：产品流程新增“设为当前版本评审”。
- `docs/product-ux-review.md`：把“diff 没有连接 eval impact / promotion decision”从缺口移动到已实现或部分实现。
- `docs/product-completion-audit-2026-05-08.md`：更新成熟度审计。
- `docs/api-contract.md`：补充 promotion review read model 和 promotion command payload。

## 13. 后续优化

第一版完成后，下一步可以考虑：

1. 运行间对比表格：选择任意两个 eval run 做对比。
2. 恢复旧版本：从 promotion decision history 一键回滚到旧版本。
3. 审批流：多人 review、拒绝、要求修改。
4. 策略规则：关键 case 不允许回退、最低通过率阈值。
5. 线上监控：把生产 trace 加回 eval set，形成持续反馈。

## 14. 自审

- 没有未定义的页面主流程：入口、页面、确认、命令、审计都有定义。
- 没有把英文术语暴露给中文用户：页面文案统一使用中文术语。
- 没有引入多人审批和发布流水线：范围保持单用户决策面。
- 数据契约能复用现有模型：`VariantVersion`、`EvalSetVersion`、`EvalRun`、`bundle_diff` 都已存在。
- 新增持久化只围绕 `promotion_decisions`，避免把 audit 语义塞进普通更新。
- 实现计划前必须由用户审阅本文档。
