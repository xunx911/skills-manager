# SkillHub 正式版 Decision Workbench 设计规格

日期：2026-05-06

状态：已批准进入实现计划阶段

## 1. 目标

SkillHub 正式版前端不应该是普通管理后台，也不应该是单纯的卡片式 skill 市场，更不应该只是 GitHub 仓库页面的复制。它的核心任务是帮助用户在特定约束下快速判断一个 skill 是否可用、是否可信。

首页必须在一个屏幕内回答四个问题：

1. 有哪些 skill？
2. 当前选中的 skill 是做什么的？
3. 默认/当前 variant 是哪个？
4. 有什么证据证明它可以放心使用？

因此，已确认的首页模型是 **Decision Workbench（决策工作台）**：

```text
左侧：skill catalog
中间：selected skill / default variant / 使用入口
右侧：evidence rail
底部：variant 与 eval matrix preview
```

## 2. 借鉴的成熟产品范式

### Linear：高密度导航和低噪声切换

Linear 的 redesign 强调减少视觉噪声、保持对齐、提高导航层级和密度，让产品从普通 issue tracker 进化成面向产品开发的工作系统。SkillHub 也需要类似的快速切换能力：用户应该能在不同 skill、不同 variant、不同证据之间快速切换，而不是在一堆详情页里迷路。

在 SkillHub 中的应用：

- 左侧 catalog 保持高密度、持久可见。
- 选择 skill 后，中间和右侧面板原地更新，不强迫用户跳转页面。
- 导航退居次要位置，当前工作对象才是视觉中心。

参考：https://linear.app/now/how-we-redesigned-the-linear-ui

### GitHub Marketplace：先展示价值，再展示实现细节

GitHub Marketplace 的 listing 会优先展示 name、description、feature card、screenshots、listing details。这个模式值得借鉴，因为普通用户首先需要知道“这个东西能帮我做什么”，然后才会关心内部版本、digest、测试集、运行记录。

在 SkillHub 中的应用：

- 中间主面板先展示 skill 用途、默认 variant、tags 和使用入口。
- 内部 ID、digest、locator、exact binding 等信息存在，但默认不抢主叙事。
- 后续如果做公开浏览页，可以保留更轻量的 marketplace 模式。

参考：https://docs.github.com/en/developers/github-marketplace/writing-a-listing-description-for-your-app

### Observable：证据页应该像交互式文档

Observable notebook 把说明文字、代码、输出、表格、可视化放在同一份交互式文档里。EvalRun 和 EvalSetVersion 详情天然也是这种结构：解释 + 精确 artifact + 结果表 + 可下钻细节。

在 SkillHub 中的应用：

- EvalRun 页面应该像 evidence notebook，而不是普通表格页。
- case input、expected output、result、artifact、notes 应该放在同一个上下文中。
- 用户应该能从总览一路下钻到具体 case version。

参考：https://observablehq.com/documentation/notebooks/

### Hex：drill / filter / explore 的数据应用体验

Hex 的 data app 强调交互式数据体验，用户可以从 dashboard 钻取、过滤、继续探索。SkillHub 的评测数据也需要这种路径：先看 summary，再点开 variant、eval set、run、failed case。

在 SkillHub 中的应用：

- 底部 matrix preview 展示 variant/eval 状态，不需要先做完整 compare 页面。
- 点击 variant、eval set、run、failed case 打开对应详情。
- 未来的多维查询表格可以自然放在这个区域。

参考：https://hex.tech/product/data-apps/

## 3. 信息架构

### 首页：Decision Workbench

首页路由保持：

```text
/skills
```

但它不再是简单列表页，而是单屏决策工作台。

桌面布局：

```text
Global shell
  Left app nav
  Main workbench
    Header / search / filter row
    3-column active workspace
      Skill Catalog
      Selected Skill Panel
      Evidence Rail
    Bottom Matrix Preview
```

移动端 / 平板布局：

```text
Top nav
Segmented tabs:
  Catalog
  Skill
  Evidence
  Matrix
```

### Skill Catalog

目的：

- 让用户快速查找和切换 skill。
- 保留普通 skillhub 的浏览体验。

每行展示：

- skill slug/name。
- owner/namespace。
- default variant label。
- tags。
- verification status。
- latest accepted score，如果存在。

交互：

- 点击行后原地选中该 skill。
- 搜索过滤 skill name、owner、tags。
- tags 可点击过滤。
- verification status 支持：`verified`、`failed`、`unverified`、`archived`。

为什么好：

- 避免卡片墙。
- 支持高密度比较。
- 切换 skill 时上下文不丢。

### Selected Skill Panel

目的：

- 解释 skill 是做什么的。
- 展示默认 variant 作为普通用户入口。
- 提供最主要的使用动作。

内容：

- skill 名称和一句话描述。
- default variant label。
- 当前 variant tags。
- 当前 variant version。
- Use / Install / Copy action。
- skill bundle preview：
  - `SKILL.md`
  - examples
  - tests/eval fixtures
  - content digest 和 locator 默认折叠。

交互：

- 主操作：使用当前选中的 variant。
- 次操作：查看文件、打开 variant page、创建新版本。
- 文件树选择会更新文件内容预览。

为什么好：

- 普通用户不需要先理解评测内部结构。
- 维护者仍然能快速进入文件和版本。

### Evidence Rail

目的：

- 在用户选择 skill 的同一时刻展示可信证据。
- 不需要进入详情页就能看到 exact evidence。

内容：

- latest accepted eval run summary。
- exact binding：
  - `VariantVersion`
  - `EvalSetVersion`
- pass/fail total。
- failed case count 和 top failed case title。
- strategy 和 run status。
- promotion eligibility signal。

交互：

- 点击 score 打开 EvalRun page。
- 点击 eval set 打开 EvalSetVersion page。
- 点击 failed case 打开 EvalRun 页面里的 case result anchor。
- 点击 binding 打开 version detail。

为什么好：

- 这是 SkillHub 和普通 skillhub 的核心差异。
- 普通 skillhub 只展示分发；这里把证据和分发放在同一个决策上下文里。
- 避免用户把“看起来不错但没测过”和“可放心使用”混为一谈。

### Matrix Preview

目的：

- 展示 variant 是不同 tags 约束下维护者认可的答案。
- 让用户能做轻量比较，不把首页变成完整分析系统。

内容：

- variant label。
- tags。
- current version。
- primary eval set score。
- last run time。
- current / historical marker。

交互：

- 点击 variant 选中或打开 variant。
- 点击 score 打开 eval run。
- v0.1 只做轻量排序/过滤；完整多维查询后续再做。

为什么好：

- 替代复杂的 variant 血缘图。
- 让 variant 状态可比较。
- 符合“variant 对用户可见”的产品要求。

## 4. 详情页模型

### Variant Page

Variant page 是一个聚焦的 release / experiment 页面。

布局：

```text
Header: variant label, tags, current version, verification summary
Main: skill bundle file tree and selected file content
Evidence rail: current eval set, latest run, failed cases
History: version timeline
Matrix: this variant's runs across eval set versions
```

规则：

- Variant 不展示 parent/child 血缘。
- History 只展示该 variant 自己的版本历史。
- Candidate version 就是普通不可变版本，只是不被 `current_version_id` 指向。

### EvalSetVersion Page

EvalSetVersion page 使用 evidence notebook 模型。

布局：

```text
Header: eval set name, exact version, case count
Cells / sections:
  Snapshot summary
  Case table
  Selected case detail
  Input artifact
  Expected output artifact
  Related eval runs
```

规则：

- 必须展示 exact case versions，不能只展示 case 数量。
- 必须保持 snapshot 语义。

### EvalRun Page

EvalRun page 使用 evidence notebook 模型。

布局：

```text
Header: run id, strategy, status, timestamp
Binding block: VariantVersion + EvalSetVersion
Summary block: pass/fail/total
Case result matrix
Selected case result detail:
  input
  expected output
  actual/result artifact
  pass/fail
  notes/logs
Conclusion block:
  supports promotion?
```

规则：

- MVP 结果只有 pass/fail 一层。
- 不引入额外 checklist 层级。
- result row 绑定 exact case version。

## 5. 视觉方向

基调：

```text
evidence lab + reliability ledger
```

它应该像一个技术决策仪器，而不是 SaaS 营销 dashboard。

视觉原则：

- 受控的信息密度，而不是空洞卡片网格。
- 强 typography 对比。
- 一个可记住的布局概念：catalog + selected object + evidence rail。
- evidence 有稳定独立的视觉语言。
- 避免 generic grey cards、紫色渐变、装饰性光球和无意义 dashboard ornament。

推荐审美：

- 深色左侧 rail 用于 workspace identity 和导航。
- 浅色工作区承载内容与证据。
- 使用 serif/editorial display type 建立产品识别度。
- monospace 只用于 ID、digest、locator 和 file content。
- 功能色：
  - green/mint：verified、pass、current。
  - coral/red：failed、risk。
  - blue：selected、version、tag。
  - gold/amber：unverified、caution。

## 6. 为什么比当前 UI 更好

当前 UI 虽然有了样式，但交互仍然是：

```text
list -> click detail -> scan modules
```

这不够，因为产品核心价值是“选择时即可看到信任证据”。

确认后的模型把交互改成：

```text
select skill -> see purpose and evidence immediately -> drill only when needed
```

收益：

- 普通用户更快。
- 维护者更严谨。
- variant 可见，但不需要血缘图。
- eval evidence 和 distribution 放在同一个上下文。
- 后续 diff、promotion、多维查询都有明确位置。

## 7. v0.1 实现范围

本阶段做：

- 将 `/skills` 重建为 Decision Workbench。
- 前端支持 in-place selected skill state。
- 先使用当前 mock/read-model data。
- 保留已有路由：
  - `/skills/:skillId`
  - `/variants/:variantId`
  - `/variants/:variantId/versions/:versionId`
  - `/eval-set-versions/:evalSetVersionId`
  - `/eval-runs/:evalRunId`
- 调整视觉系统，使其符合 evidence lab 方向。
- 移动端布局要可用，使用 segmented sections。

本阶段不做：

- 真实 artifact content API。
- 真实 diff engine。
- 完整多维 query builder。
- promotion workflow。
- auth/permissions UI。
- 最终 marketing/public homepage。

## 8. 验收标准

实现完成时必须满足：

1. `/skills` 在同一个 workbench 中展示 catalog、selected skill panel、evidence rail 和 matrix preview。
2. 选择 skill 会更新 selected skill 和 evidence rail，不需要完整页面跳转。
3. selected skill panel 能清楚解释 skill 做什么，并提供主要使用动作。
4. evidence rail 展示 exact version binding 和 latest accepted eval result。
5. matrix preview 展示 variants 及其当前验证状态。
6. EvalRun 和 EvalSetVersion 页面视觉上像 evidence notebook / detail page，而不是 generic table。
7. 移动端不出现文本重叠或不可读卡片。
8. `apps/web` 下 `npm run typecheck` 和 `npm run build` 通过。

## 9. Spec 自审

占位符检查：

- 没有未完成的待定项或待办占位。

一致性检查：

- 首页模型、详情页模型和视觉方向都围绕同一个 evidence-chain 概念。

范围检查：

- 本 spec 聚焦前端交互与视觉架构，明确排除了 artifact API 和后端 workflow。

歧义检查：

- “好”的定义已经具体化为：更短决策路径、证据可见、更低认知负担、清晰下钻路径。
