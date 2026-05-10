# SkillHub 产品体验评审

更新时间：2026-05-10

## 当前可用流程

- `/skills` 是一个正式的三栏工作台：左侧 catalog、中间 focused workspace、右侧 contextual inspector。它借鉴 Linear 的“选中对象 + 上下文操作”模型，避免把所有表单堆在一个页面里。
- 工作台支持 `Cmd/Ctrl+K` 上下文命令菜单，用户可以搜索并执行导入、创建、测评、历史、差异等高频动作；可见的 `Cmd K` 按钮也能打开同一个入口。
- 用户可以创建 skill、导入标准 Skill 文件夹或 zip、创建 variant、追加 bundle version、添加/编辑/归档 eval case，并记录手工通过/不通过测评。
- `测评` 页支持单条快速添加和批量粘贴 case；批量写入只产生一个新的 `EvalSetVersion`，不会把一次整理工作拆成多段版本噪音。
- `测评` 页的手工确认区已变成 review queue：支持按状态筛选、点击结果后自动前进、未确认项批量标为通过、清空本地草稿和键盘确认。
- 追加 candidate 版本后会自动进入候选版本测评上下文；测评页 banner 可以直接打开 `设为当前版本评审`。
- 手工测评现在可以选择 `测评目标版本`，因此候选 `VariantVersion` 可以先被测评，再决定是否成为 current。
- `变体` 页会列出每个 variant 的历史版本。current 版本显示 `Current`，非 current 版本提供 `设为当前版本评审`。
- `差异` 页在 current -> candidate 比较时也提供 `设为当前版本评审` 入口。
- Promotion review 页面把 readiness、exact binding、当前/候选分数、逐 case 修复/回退、bundle file diff 和决策说明放在同一视图中。
- 如果 readiness 为 `ready`，用户可以直接 `设为当前版本`。如果 readiness 为 `risky`，必须填写说明后才能 `接受风险并设为当前版本`。
- API 通过 `scripts/dev.sh` 持久化到 `.data/skillhub.sqlite3`。
- 空数据库会展示真实 first-run 状态，用户可以直接导入 bundle 或新建 skill。
- Archived skill 会保留历史审计能力，但不会出现在 active SkillHub 列表。
- 标准 bundle version 可以在专门的 diff mode 里比较文件状态、筛选 changed/added/removed/binary，并查看行级 diff。
- History mode 支持按 exact variant version、eval set version、strategy、status 过滤 eval run，并查看每个 run 的逐 case 结果。
- History mode 支持把两次同 `EvalSetVersion` 的 run 标为对照/候选，直接查看通过率 delta、逐 case 修复/回退，并把候选 run 接受为当前验证依据。
- 每个 eval case 可以在测评页内查看版本时间线，包括 input、expected output、notes，以及被哪些 eval set snapshot 包含。
- Playwright 覆盖 folder/zip import、新建 variant、新增/编辑/归档 case、手工 eval、候选版本 promotion review、风险 promotion、bundle diff、run history、run comparison、accepted verification、case history、键盘入口、移动端宽度和视觉回归。

## 借鉴的产品模式

- **Linear:** 左侧列表负责选择对象，中间主面板展示当前上下文，右侧 inspector 处理局部操作。适合 SkillHub 这种“对象多、动作也多”的维护工作台。
- **Linear Command Menu:** 同一动作可以通过按钮、快捷键、上下文菜单和命令菜单触发；SkillHub 第一版把“导入/创建/测评/历史/差异”收进 `Cmd/Ctrl+K`，让新手可发现、熟手少移动鼠标。
- **GitHub Command Palette:** 命令菜单兼具导航、搜索和运行命令能力；SkillHub 借鉴其 scope 思路，把菜单限定在当前 skill 工作区，避免全局搜索过早膨胀。
- **TestRail quick outline:** 测试用例管理工具会区分完整表单和快速 outline。SkillHub 借鉴“快速进入测试集”的速度，但不允许只填标题，仍要求 `input + expected output`，保证测评资产质量。
- **TestRail Pass & Next / bulk result:** TestRail 在三栏执行视图里提供快速通过并进入下一条，也支持批量提交相同结果。SkillHub 适配为“通过/不通过后自动前进”和“仅把未确认项标为通过”，避免覆盖已发现的失败。
- **TestRail hotkeys:** TestRail 为 run/test 导航和结果提交提供快捷键。SkillHub 适配为 `p/f` 标记当前 case、`j/k` 或方向键移动；快捷键不会在输入框中触发。
- **Airtable 多行粘贴:** 表格型产品允许复制多行记录并一次粘贴创建。SkillHub 借鉴这个批量输入体验，用 tab 或 `|` 分隔的文本把已有 PR/backlog 表格转成多个 eval case。
- **Airtable record filtering:** Airtable 的表格体验强调在大量记录中筛选和移动。SkillHub 适配为全部/未确认/通过/不通过四种状态筛选，让测评执行从“扫整页”变成“处理队列”。
- **GitHub / VS Code diff:** 版本变化用文件列表 + 行级 additions/removals 展示，而不是只给 change summary。Skill 本质上是文件夹，必须让用户看到真实文件变化。
- **GitHub protected branch / release review:** “设为当前版本”不是普通字段更新，而是有证据的指针移动。promotion review 借鉴 release 前检查，把测试结果、diff、风险说明合在一起。
- **Vercel Preview Promotion:** Vercel 的 preview promotion 强调 inspect、test、check logs、再 promote。SkillHub 适配为 candidate version 创建后立即进入 exact candidate 的测评上下文，再进入 promotion review。
- **Netlify Deploy Preview:** Netlify 把 preview URL 和状态暴露到 PR，让团队先体验变化再发布。SkillHub 适配为测评页 candidate banner，明确当前测的是非 current 版本。
- **GitHub Actions / LangSmith:** eval run history 以状态、策略、分数、exact binding 为核心，先扫全局，再进入单个 run 的 case 结果；run-to-run comparison 借鉴实验对比视图，只允许同 eval set snapshot 比较，避免把测试集变化误判成 skill 提升。
- **W&B / release gate:** accepted verification 借鉴 pinned baseline / release gate 思路，用一个明确指针说明“当前分发依据是哪次测评”，而不是让用户猜最新 run 是否可信。
- **Sentry issue timeline:** case history 留在当前排查上下文中，避免用户跳走后丢失对当前测试集的理解。
- **Claude Skills bundle contract:** `SKILL.md` 是标准入口，frontmatter 提供产品展示需要的 name 和 description。

## 已解决的关键摩擦

1. 以前候选版本要么直接变 current，要么只能靠人工记忆判断；现在可以先测候选版本，再通过 promotion review 做证据化决策。
2. 以前 diff 和 eval 是分离视图；现在 promotion review 把文件变化和逐 case 影响放到同一决策面。
3. 以前手工 eval 只绑定默认 current version；现在可以选择任意 `VariantVersion`，支持 candidate eval。
4. 以前 risky promotion 没有前端约束；现在发现回退或仍失败时必须填写说明。
5. 以前 history 只能读单次 run；现在可以比较两次同快照 run，并把候选 run 接受为验证依据。
6. 以前高频动作散落在 inspector 和 tab 中；现在 `Cmd/Ctrl+K` 可以直接跳到添加 case、导入 bundle、记录测评等动作。
7. 以前扩充测评集只能逐条走右侧表单；现在可以在测评页直接单条快加或批量粘贴，批量写入也只生成一个 eval set snapshot。
8. 以前记录 run 前要手动扫完整 case 列表；现在可以筛选未确认、结果后自动前进、批量通过未确认项，并用键盘连续确认。
9. 以前追加 candidate 后要手动找目标版本；现在创建 candidate 会自动切到候选测评，并提供评审入口。
10. 以前只有手工测试主路径；现在 happy path、risky path、run comparison path、command menu path、batch case path、manual eval queue path、candidate handoff path 都有 E2E 覆盖，并新增 promotion review 视觉基线。

## 仍然存在的摩擦

1. 右侧 inspector 仍然偏表单化。新增 case、记录 run 和 candidate 验证已经更顺，但导入后引导仍可以继续压缩成更连续的维护流。
2. Promotion review 已经展示 case impact 和 diff，但还没有把具体 diff hunk 关联到具体 eval case。
3. Run history 还没有 saved view / 多维表格查询；现在能比较两条 run，但还不能保存筛选视图或批量分析。
4. Case history 仍然是 read-only。用户可以查看旧版本，但不能一键 restore。
5. Zip import 预览仍然依赖后端校验；folder import 的浏览器侧预览更丰富。
6. Accessibility 覆盖仍偏浅。现在有键盘 smoke 和标签，但还需要系统化验证 focus order、screen reader label、reduced motion。

## 下一轮优化队列

1. 优化导入后引导：把“导入 bundle -> 补 case -> 记录 run -> 进入历史/评审”做成更连续的维护流。
2. 做 saved view / 多维 run matrix：让用户按 variant、eval set、case、strategy 自由查询。
3. 把 accepted verification 接入 Hub 文案和权限模型：明确谁能接受、谁只能查看。
4. 做 case restore：从 case history 恢复旧版本，但仍生成新的 case version。
5. 扩展 accessibility E2E：覆盖焦点顺序、aria label、键盘完整路径和 reduced-motion。
