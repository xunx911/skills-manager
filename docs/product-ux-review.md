# SkillHub 产品体验评审

更新时间：2026-05-14

## 当前可用流程

- `/skills` 是一个正式的三栏工作台：左侧 catalog、中间 focused workspace、右侧 contextual inspector。它借鉴 Linear 的“选中对象 + 上下文操作”模型，避免把所有表单堆在一个页面里。
- `/skills` 已支持第二阶段 URL state，用户可以分享、刷新恢复某个 skill 的概览、变体、测评、差异、历史、审计或评审视图；diff pair/file/filter、eval target/case、history filters、selected run、run comparison、matrix controls、audit filters 和 promotion review context 都会进入 URL，浏览器 Back/Forward 也能恢复这些证据上下文。
- 空工作台现在在主内容区展示 `SkillLaunchpad`，用户可以直接导入标准 Skill bundle 或创建空白 skill，不需要先理解右侧 inspector。
- 移动端 first-run 默认折叠 inspector action menu/form，只保留主区 `SkillLaunchpad` 作为导入/创建主路径；用户从 catalog 或命令菜单显式触发 action 后，inspector 表单会重新展开并接收焦点。
- 中等桌面宽度下，`差异 / 历史 / 审计 / 评审` 会把 inspector 折成 compact verification rail，主证据面板获得更多横向空间；`概览 / 变体 / 测评` 仍保留完整 inspector。
- 工作台支持 `Cmd/Ctrl+K` 上下文命令菜单，用户可以搜索并执行导入、创建、测评、历史、差异等高频动作；可见的 `Cmd K` 按钮也能打开同一个入口。命令菜单现在按 `dialog + combobox + listbox` 建模，搜索框保留焦点，方向键移动 active option，Tab 在弹层内循环；排序会结合当前 workbench mode、最近使用和当前 selection，选中 case 时可直接查看 case 历史，选中 run 时可设置 run comparison，并用右侧 preview 说明命令作用对象和禁用原因。
- 中间工作区的 `概览 / 变体 / 测评 / 差异 / 历史` 已按 APG Tabs Pattern 建模：Tab 只进入当前 mode tab，左右方向键、Home、End 在同组模式中移动并激活对应 panel，减少键盘用户重复 Tab 的成本。
- 从 catalog button 或命令菜单触发 `导入 bundle`、`新建 skill`、`添加 case` 等 Inspector action 后，焦点会进入对应表单的第一个可操作控件，键盘用户不用从旧触发点一路 Tab 到右侧面板。
- `SkillLaunchpad` 和 `WorkbenchInspector` 高频写入表单已迁移到共享字段基础件：label、hint、`aria-describedby`、业务字段 `autocomplete="off"` 和局部 `:focus-visible` 行为保持一致。
- 用户可以创建 skill、导入标准 Skill 文件夹或 zip、创建 variant、追加 bundle version、添加/编辑/归档 eval case，并记录手工通过/不通过测评。
- `概览` 页现在提供 `身份与默认分发` 设置面板，用户可以直接修改 skill ID、归属，并选择默认分发 variant。
- `概览` 页现在提供 `访问控制` 面板，用户可以查看 skill 作用域角色，并添加或移除 owner/maintainer/evaluator/viewer。
- `概览` 页现在提供 `治理与审计` 面板，集中展示 lifecycle、角色态势、最近 audit events，并把归档放进需要输入当前 skill ID 的危险区；用户也可以进入 `审计 Explorer`，用 action quick filters、actor/action/resource type 过滤、可读时间线和结构化详情追踪事件，Raw payload 默认折叠。
- 右侧 inspector 顶部新增 `Local session` 面板，显示当前本地 actor，并允许切换为 `release-manager` 等本地身份；后端用签名 HttpOnly cookie 承载 actor，前端 mutation 不再硬编码身份 header。
- 工作台新增基础 accessibility 护栏：首个 Tab 可聚焦 `跳到主要内容`，焦点 ring 更高对比，reduced-motion 下非必要 transition 被压低，异步操作结果用 `role=status` 暴露。
- `测评` 页支持单条快速添加和批量粘贴 case；批量写入只产生一个新的 `EvalSetVersion`，不会把一次整理工作拆成多段版本噪音。批量粘贴会标出缺字段的行号并阻止静默跳过无效行。
- `测评` 页的手工确认区已变成 review queue：支持按状态筛选、点击结果后自动前进、未确认项批量标为通过、清空本地草稿和键盘确认。
- `测评` 页的 case 详情面板支持内联编辑，用户可以在当前测评上下文中修改 title、input、expected output、notes，并保存为新的 case version。
- `概览` 页新增导入后验证清单，用户导入 bundle 后可以直接补首批 case、进入手工测评、再查看证据历史。
- 追加 candidate 版本后会自动进入候选版本测评上下文；测评页 banner 可以直接打开 `设为当前版本评审`。
- `变体` 主面板现在提供 `新建约束 variant` composer，用户不必进入右侧 inspector 就能创建新的 tags 组合，并默认从当前版本复制基线。
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
- Diff mode 和 Promotion review 的 bundle diff 都支持会话级文件 `已查看` 标记，并显示 `Reviewed x/y` 或 `x/y reviewed`，用户能按文件推进审查。
- History mode 支持按 exact variant version、eval set version、strategy、status 过滤 eval run，并查看每个 run 的逐 case 结果。
- History mode 支持 `Run matrix`，把当前筛选下的 runs 展成 case x run 矩阵，快速识别哪些 case 在哪些 run 上通过、不通过或未覆盖；矩阵使用原生 table、caption、列/行标题和完整单元格标签，辅助技术不用靠颜色和视觉位置猜测结果。
- History mode 支持保存、应用、删除当前筛选视图，用户可以把“候选 v2 / Primary v3”这类常用实验入口固化下来，不需要反复手动组合筛选。
- 选择 `对照` 和 `候选` run 后，Run matrix 每个 case 行会显示 `修复`、`回退`、`稳定通过`、`仍未通过` 或 `缺失`，把样本级变化直接放到表格里。
- Run matrix 支持按 impact 过滤 case、按 impact 分组、隐藏 run header 分数，并且这些矩阵控制项会随命名视图一起保存和恢复。
- History mode 支持把两次同 `EvalSetVersion` 的 run 标为对照/候选，直接查看通过率 delta、逐 case 修复/回退，并把候选 run 接受为当前验证依据。
- `promotion` 和 `accepted verification` 已有后端角色门禁：只有 skill 的 owner/maintainer 能移动可信分发或验证指针。
- 每个 eval case 可以在测评页内查看版本时间线，包括 input、expected output、notes，以及被哪些 eval set snapshot 包含；也可以从旧版本一键恢复为新的当前版本，历史不会被覆盖。
- Playwright 覆盖 folder/zip import、导入后验证引导、访问控制、治理归档、审计 Explorer、新建 variant、新增/编辑/归档 case、手工 eval、候选版本 promotion review、风险 promotion、bundle diff、run history、run comparison、accepted verification、case history、键盘入口、accessibility 护栏、移动端宽度和视觉回归。

## 借鉴的产品模式

- **Linear:** 左侧列表负责选择对象，中间主面板展示当前上下文，右侧 inspector 处理局部操作。适合 SkillHub 这种“对象多、动作也多”的维护工作台。
- **Vercel import flow:** Vercel 把新项目导入放在主工作区，而不是藏在设置面板。SkillHub 适配为 first-run `SkillLaunchpad`，让导入标准 bundle 成为用户看到的第一条主路径。
- **移动端 first-run 单主路径:** 借鉴 Vercel/Linear 在移动端优先呈现当前任务、把低频设置后置的方式。SkillHub 适配为：空工作台移动端先让用户完成导入或创建，inspector 的低频 action 只有在用户显式请求时展开。
- **Vercel project settings:** Vercel 的 General Settings 把项目名、构建配置和项目 ID 放在同一个项目设置上下文中。SkillHub 适配为 `身份与默认分发`：只编辑 skill 入口指针和归属，不把 bundle 内容改写混进来。
- **Linear project overview:** Linear 允许在 Project overview 直接编辑项目属性、名称和描述，也保留详情侧栏。SkillHub 适配为主区设置面板加 inspector 双入口。
- **Linear Command Menu:** 同一动作可以通过按钮、快捷键、上下文菜单和命令菜单触发，并且 command menu 会优先显示当前 view/selection 相关动作。SkillHub 适配为：空工作台优先导入/新建，测评页优先当前 case 历史、记录 run、添加 case，变体页优先新建 variant、追加版本和 diff，历史页优先当前 run 的 comparison setup。
- **GitHub / GitKraken command palette:** GitHub 会按当前 UI 位置确定 scope，并使用当前上下文和最近资源辅助建议；GitKraken 说明命令可用性依赖当前 repo state 和 open repo context。SkillHub 适配为 mode-aware command ordering、本地最近命令排序和 selection-aware 命令，但暂不做服务器端个性化或跨 skill 全局搜索。
- **VS Code Command Palette / keybinding context:** VS Code 的命令和快捷键可以受当前 `when` 上下文影响。SkillHub 适配为只有存在当前 case 或当前 run 时才出现对应命令，避免把不可执行对象动作塞进全局列表。
- **Raycast Script Commands:** Raycast 把脚本工作流变成可搜索命令，并依靠 title/description 元数据帮助用户判断。SkillHub 适配为命令 preview，展示 scope、对象、快捷键和禁用原因。
- **Vercel Web Interface Guidelines / GitHub query views:** 可分享的工作状态应进入 URL，例如 GitHub issues/PR 的 query、labels、page，或 Vercel guidelines 对 tabs、filters、pagination、expanded panel URL state 的建议。SkillHub 先把 selected skill 和 mode 写进 URL；第二阶段继续把 diff、eval、history、audit 和 promotion 的证据上下文写成 query params，但不保存本地草稿。
- **GitHub new repository:** GitHub 新建仓库把 owner、name 和初始化选项收束在一个短表单。SkillHub 适配为主区空白 skill 创建，只要求 skill ID、归属、初始变体、tags、简介和版本说明。
- **GitHub repository topics:** GitHub 把 topics 展示在仓库主页的 About 区域，用于发现和分类。SkillHub 适配为在 skill 概览展示默认 variant 的 tags，并允许切换默认分发。
- **Notion database properties:** Notion 既有集中属性管理，也允许直接点击单个属性编辑。SkillHub 适配为保留 inspector，同时把高频 skill 属性放在概览主区。
- **Vercel project roles:** Vercel 用 team role + project role 控制项目级操作。SkillHub 适配为 skill 作用域 role assignment，先保护当前分发和验证指针。
- **Linear members and roles:** Linear 把成员管理集中到清晰的 administration surface，并限制危险操作。SkillHub 适配为概览页 `访问控制`，让权限状态靠近 skill 身份设置。
- **Linear audit log:** Linear 的 audit log 把成员、权限和关键管理动作放到可追溯时间线中。SkillHub 适配为 skill 详情里的最近 audit events，先服务当前对象的治理理解，再考虑全局审计搜索。
- **GitHub Enterprise Audit Log:** GitHub 用 actor、action、repo、created 等结构化限定符查询审计事件。SkillHub 适配为当前 skill 的 actor/action/resource_type 过滤，避免无边界全文搜索。
- **Stripe request logs:** Stripe Workbench 把常用过滤、时间/状态摘要和单条日志下钻分层，payload 是排障细节，不是第一视觉层。SkillHub 适配为 Audit Explorer 的 quick filters、readable timeline、结构化详情和 Raw payload disclosure。
- **GitHub Danger Zone:** GitHub 把危险操作放到 repository settings 底部，并要求明确确认。SkillHub 适配为 `治理与审计` 面板中的危险区，输入当前 skill ID 才能归档。
- **本地开发 session 面板:** 参考很多开发者工具把环境身份、workspace 或 account switcher 放在固定侧栏的做法。SkillHub 适配为 inspector 顶部的 `Local session`，让用户明确“接下来写入和审计会以谁的身份发生”，同时把真实认证留给下一阶段。
- **W3C WCAG / Vercel Web Interface Guidelines:** WCAG 强调可见焦点、焦点外观和 reduced-motion；Vercel guidelines 强调 skip link、`:focus-visible`、`aria-live` 和 icon/button label。SkillHub 适配为可测试的键盘和读屏护栏，而不是只写文档承诺。
- **WAI-ARIA APG Combobox / Dialog:** APG 对 editable combobox 的建议是把 DOM focus 留在输入框，并用 `aria-activedescendant` 报告当前 option；modal dialog 要求 Tab 不离开弹层、Escape 可关闭、关闭后焦点回到触发点。SkillHub 适配为命令菜单搜索框控制 listbox，option 不进入 Tab 序列，关闭按钮提供明确出口。
- **WAI-ARIA APG Tabs Pattern:** APG 建议 tablist 只把当前 tab 放进 Tab 顺序，方向键在 tablist 内移动，tabpanel 用 `aria-labelledby` 关联 active tab。SkillHub 适配为工作区 mode switcher，保留原生 button 和既有 click 行为，同时补齐 `role=tablist/tab/tabpanel`。
- **WCAG Focus Order:** WCAG 2.4.3 要求顺序导航保留意义和可操作性。SkillHub 适配为 Inspector action 的焦点交接：用户请求某个右侧表单时，焦点进入该表单，而不是停在左侧或命令菜单的旧位置。
- **Vercel / MDN / WCAG / VA.gov form guidance:** 表单字段需要稳定 label、说明、合适的 `autocomplete` 和键盘可见焦点。SkillHub 适配为轻量 `WorkbenchField` 系列，先覆盖 Launchpad 与 Inspector 的高频写入路径；业务字段不是姓名、邮箱或地址时默认关闭浏览器自动填充，防止 `owner_ref`、`tags`、`slug` 被个人资料误填。
- **GOV.UK / MOJ form validation:** GOV.UK 要求错误摘要和字段旁错误同时出现，且文案一致；MOJ 建议提交时验证，不在输入或 blur 时打扰用户。SkillHub 适配为 `ValidatedForm`：提交空 required 字段后展示摘要、聚焦摘要、链接回字段，并通过 `WorkbenchField` 显示同一条字段错误。
- **GOV.UK file upload:** 文件上传失败要贴近上传控件本身，而不是只在页面顶部显示泛化错误。SkillHub 适配为：标准 Skill bundle 的 `SKILL.md`、frontmatter 和 zip 解析错误会回填到 `folder_files` 或 `zip_file`，用户知道应该重新选择哪个来源。
- **RFC 9457 / JSON:API error object / FastAPI exception handlers:** API 错误应该把人读说明和机器可读定位分开，客户端不应该解析 `detail` 文案猜字段。SkillHub 适配为兼容式 `detail + field_errors`：重复 Skill ID、请求体校验错误和 Skill bundle 导入解析错误会回填到表单字段；批量 case 直连 API 会返回 `cases[n].field`，让客户端不用猜测哪一行失败。
- **MDN form validation:** 客户端校验可以改善体验，但不能替代服务端校验。SkillHub 适配为服务端权威格式规则：手工新建 skill 的 `slug` 与标准 Skill bundle `name` 保持一致，tag 只允许稳定可查询字符；前端只显示服务端 `field_errors`。
- **GitHub / Linear 类工作流产品:** 标题用于扫读和列表导航，正文承载长上下文。SkillHub 适配为 eval case 标题 160 字符、Input 20000 字符、Expected output 10000 字符、Notes 2000 字符；超限失败而不是截断，避免测试资产丢内容。
- **GitHub Command Palette:** 命令菜单兼具导航、搜索和运行命令能力；SkillHub 借鉴其 scope 思路，把菜单限定在当前 skill 工作区，避免全局搜索过早膨胀。
- **TestRail quick outline:** 测试用例管理工具会区分完整表单和快速 outline。SkillHub 借鉴“快速进入测试集”的速度，但不允许只填标题，仍要求 `input + expected output`，保证测评资产质量。
- **TestRail Pass & Next / bulk result:** TestRail 在三栏执行视图里提供快速通过并进入下一条，也支持批量提交相同结果。SkillHub 适配为“通过/不通过后自动前进”和“仅把未确认项标为通过”，避免覆盖已发现的失败。
- **TestRail hotkeys:** TestRail 为 run/test 导航和结果提交提供快捷键。SkillHub 适配为 `p/f` 标记当前 case、`j/k` 或方向键移动；快捷键不会在输入框中触发。
- **Airtable 多行粘贴:** 表格型产品允许复制多行记录并一次粘贴创建，同时让用户在导入前看到可修正的问题。SkillHub 借鉴这个批量输入体验，用 tab 或 `|` 分隔的文本把已有 PR/backlog 表格转成多个 eval case，并把无效行显示为行级错误。
- **Airtable record filtering:** Airtable 的表格体验强调在大量记录中筛选和移动。SkillHub 适配为全部/未确认/通过/不通过四种状态筛选，让测评执行从“扫整页”变成“处理队列”。
- **Airtable record detail sidesheet:** Airtable 让用户从表格选中记录后在详情中直接编辑字段。SkillHub 适配为测评 case 详情内联编辑，保持“左侧选择、右侧/主区编辑”的连续工作流。
- **Linear Peek / inline issue fields:** Linear 的 Peek 和 issue detail 让用户不离开列表上下文就能改标题/描述等字段。SkillHub 适配为选中 case 后直接编辑 input 和 expected output，但保存仍显式生成新版本。
- **Linear issue creation:** Linear 把创建 issue 做成顶层按钮、快捷键和全屏创建入口。SkillHub 适配为在变体主上下文中直接追加版本，让高频创建动作贴近用户正在看的对象。
- **Figma variants:** Figma 用属性和值组织同一 component set 的不同 variant，强调每个 variant 是唯一属性组合。SkillHub 适配为在创建 variant 时突出 tags，让用户把 tags 理解为约束组合，而不是 Git 分支血缘。
- **Airtable record detail actions:** Airtable 在 record detail 中放字段、历史和按钮动作。SkillHub 适配为在 variant map 附近直接创建 variant，创建后立刻在当前空间看到新增卡片。
- **Vercel project import:** Vercel 的导入流程把选择来源、配置项目和生成 preview 串在一起。SkillHub 适配为“选择 variant -> 上传 bundle -> 生成候选版本 -> 自动进入测评”。
- **Raycast extension bootstrap:** Raycast 创建扩展后立刻给出下一步开发动作。SkillHub 适配为 launchpad 右侧 checklist：导入或创建后继续补 case、记录首轮 run、沉淀验证依据。
- **GitHub / VS Code diff:** 版本变化用文件列表 + 行级 additions/removals 展示，而不是只给 change summary。Skill 本质上是文件夹，必须让用户看到真实文件变化。
- **GitHub PR review 主证据面:** GitHub 的代码审查把文件 diff 放在最宽的阅读面，辅助栏不能压缩代码。SkillHub 适配为 promotion/diff/history/audit 在中等桌面宽度下折叠 inspector，让用户先看证据。
- **GitHub / GitLab file viewed progress:** GitHub 和 GitLab 都允许用户把单个 diff 文件标记为 viewed，并用进度降低大 diff 的记忆负担。SkillHub 第一阶段适配为会话级文件 viewed set；由于 `VariantVersion` 不可变，切换 diff pair 时直接重置 viewed state。
- **GitHub protected branch / release review:** “设为当前版本”不是普通字段更新，而是有证据的指针移动。promotion review 借鉴 release 前检查，把测试结果、diff、风险说明合在一起。
- **Vercel Preview Promotion:** Vercel 的 preview promotion 强调 inspect、test、check logs、再 promote。SkillHub 适配为 candidate version 创建后立即进入 exact candidate 的测评上下文，再进入 promotion review。
- **Netlify Deploy Preview:** Netlify 把 preview URL 和状态暴露到 PR，让团队先体验变化再发布。SkillHub 适配为测评页 candidate banner，明确当前测的是非 current 版本。
- **Vercel Deployment Checks:** Vercel 把 safety checks 放在 release 前。SkillHub 适配为导入后验证清单：bundle 存在只是起点，只有 case 和 eval run 才能支撑可信分发。
- **Linear Triage:** Linear 把外部进入的 issue 放入 triage inbox，先 review/update/prioritize 再进入正式 workflow。SkillHub 适配为新导入 skill 的轻量 triage：先补测评资产，再跑首轮验证。
- **GitHub Actions / LangSmith:** eval run history 以状态、策略、分数、exact binding 为核心，先扫全局，再进入单个 run 的 case 结果；run-to-run comparison 借鉴实验对比视图，只允许同 eval set snapshot 比较，避免把测试集变化误判成 skill 提升。
- **LangSmith experiment comparison:** LangSmith 的 comparison view 支持多 experiment 表格、过滤、列显示和 regression/improvement。SkillHub 适配为 run matrix，把多 run x 多 case 的 pass/fail 关系铺开，并用 impact filter/grouping 聚焦 regression 和 improvement。
- **LangSmith regression / improvement focus:** LangSmith 会基于 source experiment 标出 regression 和 improvement。SkillHub 适配为选择 `对照` 和 `候选` 后，在矩阵每个 case 行显示 impact chip，减少用户心算。
- **W&B Tables:** W&B Tables 用表格比较模型版本、时间和具体样本结果。SkillHub 适配为 case x run 矩阵，把 skill 评测从两两比较扩展到多 run 浏览。
- **WAI-ARIA APG Table:** APG 建议静态表格优先使用原生 `table`，只有需要单元格级交互时才使用 `grid`。SkillHub 的 Run matrix 是 read-only 分析视图，所以保留原生表格，补 caption、`scope`、row/col index 和单元格 `aria-label`，而不是过早引入 data grid。
- **Linear Saved Views / Airtable Views:** 常用筛选不应该每次重建，视图保存的是查询意图而不是复制数据。SkillHub 适配为保存 `run_history` 筛选配置和 matrix 展示偏好，run 列表和矩阵仍实时读取同一份后端结果。
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
11. 以前只有手工测试主路径；现在 happy path、risky path、run comparison path、command menu path、batch case path、manual eval queue path、candidate handoff path、first verification guide path、case restore path、access roles path 都有 E2E 覆盖，并新增 promotion review 和 access panel 视觉基线。
12. 以前 case history 只能查看，错误编辑后要手工复制旧内容；现在可以从旧 case version 恢复，系统会生成新的当前版本和 eval set snapshot。
13. 以前多次 run 只能列表浏览或两两比较；现在 history 页有 run matrix，可以按当前筛选直接看多 run 在每个 case 上的覆盖和结果。
14. 以前常用历史筛选只能手动重建；现在可以保存为命名视图，一键恢复 run 列表和矩阵的同一组筛选。
15. 以前矩阵只展示原始 pass/fail；现在选择对照/候选后，每个 case 行直接标出修复、回退或稳定状态。
16. 以前编辑 case 主要依赖右侧 inspector；现在可在测评详情面板内直接编辑并保存为新版本，减少测评执行中的上下文跳转。
17. 以前追加版本主要依赖右侧 inspector；现在变体主面板有候选版本 composer，版本维护动作更靠近 variant map 和历史版本列表。
18. 以前创建 variant 主要依赖右侧 inspector；现在变体主面板有约束 variant composer，并默认复用当前版本作为 v1 基线。
19. 以前空工作台只给两个跳转按钮，用户要理解 inspector 才能开始；现在 first-run 主区可以直接完成导入或创建，创建后立刻进入同一个 skill 概览和验证清单。
20. 以前修改 skill ID、owner 或默认分发主要依赖右侧 inspector；现在概览主区可直接完成 identity/default variant 设置，保存后 catalog、header 和 hero 同步刷新。
21. 以前矩阵只能看全部 case；现在可以把视图收窄到 `修复`、`回退`、`仍未通过` 等 impact，也可以按 impact 分组并把这个视图保存下来。
22. 以前 role assignment 表只是 schema 占位；现在创建 skill 会自动授予 owner，概览页可管理 skill 作用域角色，promotion 和 accepted verification 已有 owner/maintainer 门禁。
23. 以前 mutation payload 里还能传 `actor`，权限判断和业务输入混在一起；现在前端通过后端签名的 HttpOnly cookie 进入 ActorContext，body actor 会被忽略；直接 API 调用仍可用 `X-SkillHub-Actor` header 兼容。
24. 以前归档 skill 是 inspector 里的普通按钮，缺少权限和确认语义；现在归档需要 owner 权限、输入当前 skill ID，并写入 `skill.archived` audit event。
25. 以前治理面板只能看最近几条 skill 级事件；现在 `审计 Explorer` 能读取当前 skill 关联的 skill、variant、eval_run 事件，并按 actor、action、resource type 过滤后检查 payload。
26. 以前切换本地 actor 只能改代码里的常量或请求 header；现在可以在页面右侧直接切换本地 session actor，并通过 E2E 验证新导入 skill 的 owner 来自该 session。
27. 以前键盘和读屏只有零散 smoke；现在有独立 accessibility E2E，覆盖 skip link、focus indicator、reduced-motion、status notice、命令菜单的 combobox/listbox 关系、Tab trap 和关闭回焦点、Workbench mode tablist、Run matrix 的 table/header/cell 语义，以及 Inspector action 的焦点交接。
28. 以前从左侧或命令菜单触发右侧表单后，键盘用户仍停在旧触发点；现在 action 切换会把焦点送到对应表单的第一个字段。
29. 以前工作区模式是一排普通按钮，键盘用户要逐个 Tab 经过；现在它是一个 tablist，当前 mode 是唯一 tab stop，方向键负责组内移动。
30. 以前移动端 first-run 会先看到主区 Launchpad，继续向下又看到 inspector 的第二份完整导入表单；现在默认只保留主区接入路径，显式请求 inspector action 时再展开右侧表单。
31. 以前 1280px 桌面下 promotion/history/audit 仍被 300px 以上 inspector 挤压；现在证据模式在中等桌面宽度使用 compact verification rail，把主证据区放宽。
32. 以前用户无法把“某个 skill 的历史页”直接发给别人，也不能刷新后回到同一 mode；现在 `/skills?skill=<slug>&mode=history` 可以直达并恢复 selected skill + mode，用户切换 tab 或 skill 时地址栏同步更新。
33. 以前 Audit Explorer 默认让 Raw JSON 占据详情区，列表行容易截断；现在先给 action quick filters、可读事件标题、actor/resource/time 和结构化 payload 摘要，Raw JSON 默认折叠。
34. 以前 Launchpad 和 Inspector 高频写入字段各自手写 label/input，业务字段缺少显式 `autocomplete`；现在第一阶段统一到共享字段基础件，并用 E2E 覆盖 Launchpad 与 Inspector 的 autocomplete 和可见焦点。
35. 以前 command menu 默认静态导航优先；现在会按当前 mode 排序，测评页第一条就是 `记录本次测评`，变体页优先 variant/version/diff，空工作台优先导入/新建。
36. 以前 diff/promotion review 中用户只能靠记忆判断哪些文件已经看过；现在可以逐文件勾选已查看，并在 summary/header 中看到 `Reviewed x/y`。
37. 以前用户只能分享粗粒度 mode；现在可以分享具体 diff pair、selected diff file、candidate eval target、selected case、history filters、selected run、run comparison、matrix controls、audit filters 和 promotion review permalink。
38. 以前剩余表单仍各自手写 label/input/select；现在 QuickAddCases、EvalCaseDetailPanel、SkillSettingsPanel、SkillAccessPanel、SkillGovernancePanel、SavedRunViews、history filters、run matrix controls 和 diff selectors 都接入共享字段基础件。
39. 以前命令菜单只会根据 mode 估计意图；现在会记住本地最近使用命令，并在选中 case/run 时展示可执行的 selection-aware 命令和 preview。
40. 以前导入 bundle 时如果 `SKILL.md` frontmatter 或 zip 有问题，用户只能看到全局失败提示；现在错误摘要会指向文件夹或 zip 上传字段，并在字段旁显示同一条修正说明。
41. 以前批量粘贴 case 会静默跳过无效行；现在会显示第几行缺少标题、Input 或 Expected output，并阻止只提交部分有效行。

## 仍然存在的摩擦

1. Command menu 已完成第二阶段：支持 mode-aware 排序、本地最近使用、selected case/run 命令和右侧 preview；还没有服务器端个性化、跨 skill 全局搜索或快捷键自定义。
2. 表单字段基础件已覆盖主要工作台表单，required 字段已有错误 summary、提交后聚焦摘要、摘要链接回字段和字段旁错误；后端字段错误映射第一阶段已覆盖重复 Skill ID、基础请求体校验、Skill ID 格式、tags 格式、导入 bundle 解析错误、批量 case 行级字段错误和 eval case 文本长度上限。还没有其他产品字段长度上限和错误统计。
3. Promotion review 已经展示 case impact、diff 和会话级文件 reviewed progress，但 viewed state 还没有服务端持久化，也没有把具体 diff hunk 关联到具体 eval case。
4. URL state 已覆盖核心证据上下文，但还没有短链接、权限感知分享提示，也没有保存未提交草稿。
5. Run matrix 已经提供 read-only 多 run x case 浏览、保存筛选视图、对照/候选 impact、impact 过滤和分组，但还没有列配置、自定义指标列、导出或保存对照/候选 run 指针。
6. 权限还没有真实认证来源。当前 actor 已从请求体和前端硬编码 header 收敛到后端签名的本地 cookie session，但仍不是多用户登录、token rotation 或组织级身份系统。
7. Accessibility 仍未完整覆盖全路径。现在已有 skip link、focus ring、reduced-motion、status notice、命令菜单、Workbench mode tablist、Run matrix 表格语义、Inspector action focus handoff 和主要表单字段语义回归，但更广的全路径焦点巡检和人工读屏验收还需要继续补。

## 下一轮优化队列

1. 表单验证第二阶段剩余部分：其他产品字段长度上限、错误统计，以及更多嵌套写入表单的字段错误回填。
2. 接入真实认证：用真正的登录 session/token 替换本地 actor cookie，前端只展示 capability，不再允许自由切换开发身份。
3. Diff / Promotion review 第二阶段：评估是否服务端持久化 viewed state、自动折叠已查看文件，或把 diff hunk 关联到 eval case。
4. URL state 第三阶段：增加短链接、权限感知分享提示，并评估是否保存草稿到本地 session storage 而不是 URL。
5. 做 run matrix 多维表格：支持列配置、自定义指标列、导出，并考虑是否保存对照/候选 run 指针。
6. Command menu 第三阶段：服务器端个性化、跨 skill 全局搜索、快捷键自定义和命令别名。
7. 扩展 accessibility E2E：继续覆盖更广的全路径焦点巡检和人工读屏验收。
