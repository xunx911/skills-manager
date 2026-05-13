# SkillHub 产品体验评审

更新时间：2026-05-10

## 当前可用流程

- `/skills` 是一个正式的三栏工作台：左侧 catalog、中间 focused workspace、右侧 contextual inspector。它借鉴 Linear 的“选中对象 + 上下文操作”模型，避免把所有表单堆在一个页面里。
- 工作台支持 `Cmd/Ctrl+K` 上下文命令菜单，用户可以搜索并执行导入、创建、测评、历史、差异等高频动作；可见的 `Cmd K` 按钮也能打开同一个入口。
- 用户可以创建 skill、导入标准 Skill 文件夹或 zip、创建 variant、追加 bundle version、添加/编辑/归档 eval case，并记录手工通过/不通过测评。
- `测评` 页支持单条快速添加和批量粘贴 case；批量写入只产生一个新的 `EvalSetVersion`，不会把一次整理工作拆成多段版本噪音。
- `测评` 页的手工确认区已变成 review queue：支持按状态筛选、点击结果后自动前进、未确认项批量标为通过、清空本地草稿和键盘确认。
- `测评` 页的 case 详情面板支持内联编辑，用户可以在当前测评上下文中修改 title、input、expected output、notes，并保存为新的 case version。
- `概览` 页新增导入后验证清单，用户导入 bundle 后可以直接补首批 case、进入手工测评、再查看证据历史。
- 追加 candidate 版本后会自动进入候选版本测评上下文；测评页 banner 可以直接打开 `设为当前版本评审`。
- `变体` 主面板现在提供 `追加候选版本` composer，用户不必进入右侧 inspector 就能上传新的标准 Skill bundle 并进入候选测评。
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
- History mode 支持 `Run matrix`，把当前筛选下的 runs 展成 case x run 矩阵，快速识别哪些 case 在哪些 run 上通过、不通过或未覆盖。
- History mode 支持保存、应用、删除当前筛选视图，用户可以把“候选 v2 / Primary v3”这类常用实验入口固化下来，不需要反复手动组合筛选。
- 选择 `对照` 和 `候选` run 后，Run matrix 每个 case 行会显示 `修复`、`回退`、`稳定通过`、`仍未通过` 或 `缺失`，把样本级变化直接放到表格里。
- History mode 支持把两次同 `EvalSetVersion` 的 run 标为对照/候选，直接查看通过率 delta、逐 case 修复/回退，并把候选 run 接受为当前验证依据。
- 每个 eval case 可以在测评页内查看版本时间线，包括 input、expected output、notes，以及被哪些 eval set snapshot 包含；也可以从旧版本一键恢复为新的当前版本，历史不会被覆盖。
- Playwright 覆盖 folder/zip import、导入后验证引导、新建 variant、新增/编辑/归档 case、手工 eval、候选版本 promotion review、风险 promotion、bundle diff、run history、run comparison、accepted verification、case history、键盘入口、移动端宽度和视觉回归。

## 借鉴的产品模式

- **Linear:** 左侧列表负责选择对象，中间主面板展示当前上下文，右侧 inspector 处理局部操作。适合 SkillHub 这种“对象多、动作也多”的维护工作台。
- **Linear Command Menu:** 同一动作可以通过按钮、快捷键、上下文菜单和命令菜单触发；SkillHub 第一版把“导入/创建/测评/历史/差异”收进 `Cmd/Ctrl+K`，让新手可发现、熟手少移动鼠标。
- **GitHub Command Palette:** 命令菜单兼具导航、搜索和运行命令能力；SkillHub 借鉴其 scope 思路，把菜单限定在当前 skill 工作区，避免全局搜索过早膨胀。
- **TestRail quick outline:** 测试用例管理工具会区分完整表单和快速 outline。SkillHub 借鉴“快速进入测试集”的速度，但不允许只填标题，仍要求 `input + expected output`，保证测评资产质量。
- **TestRail Pass & Next / bulk result:** TestRail 在三栏执行视图里提供快速通过并进入下一条，也支持批量提交相同结果。SkillHub 适配为“通过/不通过后自动前进”和“仅把未确认项标为通过”，避免覆盖已发现的失败。
- **TestRail hotkeys:** TestRail 为 run/test 导航和结果提交提供快捷键。SkillHub 适配为 `p/f` 标记当前 case、`j/k` 或方向键移动；快捷键不会在输入框中触发。
- **Airtable 多行粘贴:** 表格型产品允许复制多行记录并一次粘贴创建。SkillHub 借鉴这个批量输入体验，用 tab 或 `|` 分隔的文本把已有 PR/backlog 表格转成多个 eval case。
- **Airtable record filtering:** Airtable 的表格体验强调在大量记录中筛选和移动。SkillHub 适配为全部/未确认/通过/不通过四种状态筛选，让测评执行从“扫整页”变成“处理队列”。
- **Airtable record detail sidesheet:** Airtable 让用户从表格选中记录后在详情中直接编辑字段。SkillHub 适配为测评 case 详情内联编辑，保持“左侧选择、右侧/主区编辑”的连续工作流。
- **Linear Peek / inline issue fields:** Linear 的 Peek 和 issue detail 让用户不离开列表上下文就能改标题/描述等字段。SkillHub 适配为选中 case 后直接编辑 input 和 expected output，但保存仍显式生成新版本。
- **Linear issue creation:** Linear 把创建 issue 做成顶层按钮、快捷键和全屏创建入口。SkillHub 适配为在变体主上下文中直接追加版本，让高频创建动作贴近用户正在看的对象。
- **Vercel project import:** Vercel 的导入流程把选择来源、配置项目和生成 preview 串在一起。SkillHub 适配为“选择 variant -> 上传 bundle -> 生成候选版本 -> 自动进入测评”。
- **GitHub / VS Code diff:** 版本变化用文件列表 + 行级 additions/removals 展示，而不是只给 change summary。Skill 本质上是文件夹，必须让用户看到真实文件变化。
- **GitHub protected branch / release review:** “设为当前版本”不是普通字段更新，而是有证据的指针移动。promotion review 借鉴 release 前检查，把测试结果、diff、风险说明合在一起。
- **Vercel Preview Promotion:** Vercel 的 preview promotion 强调 inspect、test、check logs、再 promote。SkillHub 适配为 candidate version 创建后立即进入 exact candidate 的测评上下文，再进入 promotion review。
- **Netlify Deploy Preview:** Netlify 把 preview URL 和状态暴露到 PR，让团队先体验变化再发布。SkillHub 适配为测评页 candidate banner，明确当前测的是非 current 版本。
- **Vercel Deployment Checks:** Vercel 把 safety checks 放在 release 前。SkillHub 适配为导入后验证清单：bundle 存在只是起点，只有 case 和 eval run 才能支撑可信分发。
- **Linear Triage:** Linear 把外部进入的 issue 放入 triage inbox，先 review/update/prioritize 再进入正式 workflow。SkillHub 适配为新导入 skill 的轻量 triage：先补测评资产，再跑首轮验证。
- **GitHub Actions / LangSmith:** eval run history 以状态、策略、分数、exact binding 为核心，先扫全局，再进入单个 run 的 case 结果；run-to-run comparison 借鉴实验对比视图，只允许同 eval set snapshot 比较，避免把测试集变化误判成 skill 提升。
- **LangSmith experiment comparison:** LangSmith 的 comparison view 支持多 experiment 表格、过滤、列显示和 regression/improvement。SkillHub 适配为 run matrix，先把多 run x 多 case 的 pass/fail 关系铺开，后续再做保存视图和回退高亮。
- **LangSmith regression / improvement focus:** LangSmith 会基于 source experiment 标出 regression 和 improvement。SkillHub 适配为选择 `对照` 和 `候选` 后，在矩阵每个 case 行显示 impact chip，减少用户心算。
- **W&B Tables:** W&B Tables 用表格比较模型版本、时间和具体样本结果。SkillHub 适配为 case x run 矩阵，把 skill 评测从两两比较扩展到多 run 浏览。
- **Linear Saved Views / Airtable Views:** 常用筛选不应该每次重建，视图保存的是查询意图而不是复制数据。SkillHub 适配为保存 `run_history` 筛选配置，run 列表和矩阵仍实时读取同一份后端结果。
- **W&B / release gate:** accepted verification 借鉴 pinned baseline / release gate 思路，用一个明确指针说明“当前分发依据是哪次测评”，而不是让用户猜最新 run 是否可信。
- **Sentry issue timeline:** case history 留在当前排查上下文中，避免用户跳走后丢失对当前测试集的理解。
- **GitHub / GitLab revert:** 恢复旧内容不应该覆盖历史，而应该创建新的提交。SkillHub 适配为从旧 `EvalCaseVersion` 恢复时创建新的 current case version，并生成新的 `EvalSetVersion`。
- **Airtable record revision history:** Airtable 把记录级 revision 放在展开记录详情里。SkillHub 适配为在 case history 面板里直接恢复旧版本，避免用户手工复制 input 和 expected output。
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
10. 以前导入后用户要自己推理下一步；现在概览页用验证清单把添加首批 case、打开手工测评、查看证据历史串起来。
11. 以前只有手工测试主路径；现在 happy path、risky path、run comparison path、command menu path、batch case path、manual eval queue path、candidate handoff path、first verification guide path、case restore path 都有 E2E 覆盖，并新增 promotion review 视觉基线。
12. 以前 case history 只能查看，错误编辑后要手工复制旧内容；现在可以从旧 case version 恢复，系统会生成新的当前版本和 eval set snapshot。
13. 以前多次 run 只能列表浏览或两两比较；现在 history 页有 run matrix，可以按当前筛选直接看多 run 在每个 case 上的覆盖和结果。
14. 以前常用历史筛选只能手动重建；现在可以保存为命名视图，一键恢复 run 列表和矩阵的同一组筛选。
15. 以前矩阵只展示原始 pass/fail；现在选择对照/候选后，每个 case 行直接标出修复、回退或稳定状态。
16. 以前编辑 case 主要依赖右侧 inspector；现在可在测评详情面板内直接编辑并保存为新版本，减少测评执行中的上下文跳转。
17. 以前追加版本主要依赖右侧 inspector；现在变体主面板有候选版本 composer，版本维护动作更靠近 variant map 和历史版本列表。

## 仍然存在的摩擦

1. 右侧 inspector 仍然偏表单化。case 编辑和候选版本追加已经迁入主区，但 skill 创建、variant 创建和部分设置仍需要更成熟的主区或内联抽屉体验。
2. Promotion review 已经展示 case impact 和 diff，但还没有把具体 diff hunk 关联到具体 eval case。
3. Run matrix 已经提供 read-only 多 run x case 浏览、保存筛选视图和对照/候选 impact，但还没有列配置和分组。
4. Zip import 预览仍然依赖后端校验；folder import 的浏览器侧预览更丰富。
5. Accessibility 覆盖仍偏浅。现在有键盘 smoke 和标签，但还需要系统化验证 focus order、screen reader label、reduced motion。

## 下一轮优化队列

1. 优化创建/编辑表单：把常用表单逐步迁入主内容区或内联抽屉，让 inspector 更像上下文工具而不是唯一操作区。
2. 做 run matrix 多维表格：支持隐藏列、分组并突出 regression/improvement。
3. 把 accepted verification 接入 Hub 文案和权限模型：明确谁能接受、谁只能查看。
4. 扩展 accessibility E2E：覆盖焦点顺序、aria label、键盘完整路径和 reduced-motion。
