# SkillHub 产品操作摩擦审计

日期：2026-05-14

状态：当前产品闭环已经强于普通 demo，但还不是成熟产品。主要缺口不在“能不能跑通”，而在信息架构密度、历史/发布证据的可扫读性，以及真实认证、多用户协作、验证策略和少量深水区可访问性细节。移动端 first-run、证据视图 inspector 折叠、URL state 第二阶段、Audit Explorer 扫读重构、表单字段基础件第二阶段、表单验证错误摘要、后端字段错误映射、基础格式校验第一阶段、导入 bundle 字段错误映射第一阶段、批量 case 行级错误第一阶段、服务端批量 case 字段错误契约、eval case 文本长度校验、批量 case 导入预览表、批量 case 预览移动端护栏、保存视图名称字段级校验、accepted verification note 字段级校验、promotion decision note 字段级校验、Variant 写入字段校验、Skill capabilities 权限感知、本地登录门禁第一阶段、本地 session 退出控制、身份引用字段格式校验第一阶段、表单错误摘要统计、低频长文本字符计数、Command menu 第二阶段和 Diff / Promotion 文件 reviewed progress 第一阶段已经按本审计后续任务完成。

## 审计输入

- 视觉证据：`apps/web/e2e/visual-workbench.spec.ts-snapshots/*`。
- 流程证据：`apps/web/e2e/skills-workbench.spec.ts`、`apps/web/e2e/accessibility-workbench.spec.ts`、`apps/web/e2e/visual-workbench.spec.ts`。
- 源码证据：`apps/web/app/globals.css`、`SkillLaunchpad`、`WorkbenchInspector`、`SkillAuditExplorer`、`DecisionWorkbench`。
- 现有产品文档：`docs/product-ux-review.md`、`docs/product-completion-audit-2026-05-08.md`。

## 参考实践

- Vercel Web Interface Guidelines：要求可见焦点、表单 `autocomplete`、语义化按钮/链接、URL 反映状态、避免 `outline: none` 无替代、长内容处理、reduced motion 等。
- NN/g 10 Usability Heuristics：本轮重点看系统状态可见、用户语言、控制与退出、错误预防、识别优先于记忆、效率捷径、审美和最小化。
- Linear command menu：命令应按功能分组，并根据当前上下文优先展示相关命令。
- GitHub PR review：版本评审需要按文件/变更逐步审查、可追踪进度，避免用户在大 diff 中迷路。
- Microsoft menu guidelines：不适用命令应 disabled 而不是隐藏，快捷键应展示；高频命令不要藏到深层菜单。

## 当前优势

1. **核心闭环是真实的。** 标准 Skill 文件夹/zip 导入、创建 skill/variant/version、增删改查 eval case、手工 pass/fail、candidate eval、promotion review、history/run matrix 和 accepted verification 都有 E2E 覆盖。
2. **三栏工作台方向正确。** 左侧 catalog、中间 workspace、右侧 inspector 的对象/操作分离，适合 SkillHub 这种维护型产品。
3. **高频路径有多入口。** Launchpad、主区 composer、右侧 inspector、command menu 和键盘路径并存，已经开始兼顾新手和熟手。
4. **验证证据链领先普通 SkillHub。** 当前产品已经把 bundle diff、eval set version、eval run binding、case result 和 promotion decision 放进同一个可信链条。
5. **可访问性有工程护栏。** skip link、focus ring、reduced-motion、status notice、command menu ARIA、tablist、run matrix table semantics 和 inspector focus handoff 都有自动化覆盖。
6. **权限反馈开始前置。** 后端返回当前 actor 的 skill capabilities，前端在访问控制、promotion 和 accepted verification 入口提前展示禁用态和原因，而不是等提交失败。

## 摩擦发现

### P1 - 移动端 first-run 同时展示主入口和完整 inspector，认知负担过高

证据：

- `apps/web/e2e/visual-workbench.spec.ts-snapshots/mobile-empty-workbench-chromium-darwin.png` 当时显示移动端先展示 Launchpad，往下又展示 Verification、Local session、action menu 和第二份 `导入标准 Skill` inspector 表单；后续已改为 first-run 单主路径。
- `apps/web/components/skills/skill-launchpad.tsx:53` 到 `84` 已经提供完整导入表单。
- `apps/web/components/inspector/workbench-inspector.tsx:183` 到 `205` 又提供一份导入表单。
- `apps/web/app/globals.css:7604` 到 `7619` 在窄屏下把 inspector 放到主区下方，导致重复入口直接串成长页面。

影响：

- 违反 NN/g 的“审美和最小化设计”：同一任务出现两份主要表单，主路径不够单一。
- 新用户会不确定应该填上面的导入，还是下面的导入。
- 移动端首屏长度过长，用户到达右侧验证或 session 信息时已经离开主任务。

建议：

- 在 mobile/first-run 下默认隐藏 inspector action form，仅保留 Launchpad。
- inspector 改为 collapsible action drawer：用户点 `Cmd K`、catalog 或 explicit action 后再展开。
- Empty skill 状态下 Verification/Local login 可以压缩为一行状态，而不是完整卡片。

### P1 - 1280 宽桌面三栏固定宽度让主工作区偏窄

证据：

- `apps/web/app/globals.css:2071` 到 `2076` 使用 `292px minmax(0, 1fr) 372px` 固定三栏，并固定 `height: calc(100vh - 82px)`。
- `imported-skill-overview` 和 `variants-workspace-composers` 截图里 skill slug 和右侧 inspector 都很抢空间，中间主区可读宽度不足。
- `promotion-review-ready` 截图中 promotion review 的右半信息被右侧 inspector 挤压，决策视图像“主流程 + 表单侧栏”而不是发布检查台。

影响：

- 对复杂视图（promotion、history、diff）来说，右侧 inspector 并不总是当前最重要的信息，却长期占 372px。
- 用户在“做决策”时应该优先看 diff、case impact、run evidence，而不是持续看到 action form。

建议：

- 在 `promotion/diff/history/audit` mode 下默认折叠 inspector，只保留 `Verification` mini rail 或浮动动作入口。
- 在 1280 到 1440 宽之间使用两栏布局：catalog + main，inspector 作为 drawer。
- 给 inspector 做“当前 action only”模式：无 action 时显示 compact summary，不展示完整表单栈。

### 已解决第二阶段 / 仍需后续 - 深层 URL state 已覆盖核心证据上下文

证据：

- TASK-042 已完成第一阶段：`/skills?skill=<slug-or-id>&mode=<mode>` 可以恢复 selected skill 和 mode。
- Vercel guideline 明确要求 filters、tabs、pagination、expanded panels 等 state 进入 URL。
- TASK-047 已完成第二阶段：`/skills` 可以恢复 diff pair/file/filter、eval target/case、history filters、selected run、run comparison、matrix controls、audit filters 和 promotion review context。
- E2E 覆盖 diff/evals/history/promotion 深链刷新恢复，以及浏览器 Back/Forward 恢复 mode。

影响：

- 用户已经可以分享“某组 diff pair”“某次候选版本评审”“某组 run comparison”这类具体证据上下文。
- 当前 URL 仍不承担草稿保存；未提交 pass/fail 草稿、批量 case 输入和 viewed progress 不进入 URL。

建议：

- 第三阶段再考虑短链接、权限感知分享提示，以及草稿是否进入 local/session storage。
- 不建议把未提交测评草稿写进 URL；那会让链接变长并泄露临时数据。

### 已解决 - Audit Explorer 可扫读性不足，payload 过重

证据：

- TASK-043 已把 `SkillAuditExplorer` 改成 action quick filters、可读时间线、结构化详情和默认折叠的 Raw payload。
- `apps/web/e2e/skills-workbench.spec.ts` 覆盖 quick filter、可读事件标题、actor、payload 摘要和 Raw payload disclosure。
- `skill-audit-explorer` 视觉基线已更新，右侧默认展示 readable summary，不再让 Raw JSON 抢占第一视觉层。

影响：

- 当前 skill 范围内，用户已经可以更快回答：谁改了权限、影响了哪个对象、是否属于关键动作。
- 后续更大的审计产品缺口转移到跨 skill/组织级查询、日期范围、分页、导出和保留策略。

建议：

- 将来做组织级审计时，沿用这套信息架构，并补日期范围、分页、导出和保留策略。

### 已解决第一阶段 / 仍需后续 - 权限不足反馈太晚

证据：

- TASK-062 新增 `GET /api/skills/{skill_id}/capabilities`，返回当前 actor 的 roles 和 `role.manage`、`variant.promote`、`verification.accept`。
- `SkillAccessPanel` 会显示当前角色和能力 chip；viewer 会看到 `不能管理角色`、不能添加成员或撤销角色。
- `WorkbenchVariantsPane`、`WorkbenchDiffPane`、`PromotionReviewPane` 和 `RunComparisonPanel` 会按 capability 禁用设为当前版本评审、最终 promote 和接受验证依据。
- E2E 覆盖 viewer 切换后访问控制显示 `当前角色 Viewer`，添加成员和设为当前版本评审按钮 disabled，并提供需要 owner/maintainer 的 title。

影响：

- 用户在执行受保护动作前就能看到为什么不可操作，减少“点了才失败”的摩擦。
- 前端只消费后端 capability，不在浏览器里复制权限业务规则；正式认证接入时可以替换 actor 来源而保留 UI 契约。

建议：

- 下一阶段应接入真实认证，让 capability 来自真实登录 session/token，而不是带本地登录码的开发期 cookie。
- 低频 admin action 也可以逐步接入 capability 提示，但不要在没有真实角色体系前发散到自定义权限编辑器。

### 已解决字段错误映射第一阶段 / 仍需后续 - 表单字段语义已统一，验证体验继续深化

证据：

- TASK-044 已新增 `apps/web/components/forms/workbench-field.tsx`，提供 `TextField`、`TextAreaField`、`SelectField`、`FileField`，统一 label、hint 和 `aria-describedby`。
- `SkillLaunchpad` 与 `WorkbenchInspector` 高频写入路径已迁移到共享字段基础件；业务 text/textarea 默认显式 `autocomplete="off"`。
- `apps/web/e2e/accessibility-workbench.spec.ts` 新增回归，红灯先失败于 Launchpad `owner_ref` 缺少 autocomplete；绿色后覆盖 Launchpad 与 Inspector 的 autocomplete、焦点交接和可见焦点。
- TASK-048 已把 `QuickAddCases`、`EvalCaseDetailPanel`、`SkillSettingsPanel`、`SkillAccessPanel`、`SkillGovernancePanel`、`SavedRunViews`、history filters、run matrix controls 和 diff selectors 迁移到共享字段基础件。
- `WorkbenchField` 已预留字段级 `error`、`aria-invalid` 和错误文案 `aria-describedby` 接口；`CheckboxField` 覆盖 run matrix score toggle。
- `accessibility-workbench.spec.ts` 覆盖主要表单字段语义，红灯先失败于 `quick_title` 缺少 autocomplete/shared shell，绿色后 11 条 accessibility 回归通过。
- TASK-050 新增 `ValidatedForm`，高频写入表单提交缺少 required 字段时会展示 error summary、聚焦 summary、用摘要链接回字段，并在字段旁显示同一条错误文案。
- 新增 E2E 覆盖 Launchpad 新建 skill 和 QuickAddCases 空提交的 summary focus、summary link focus 和 `aria-invalid`。
- TASK-051 新增 API `field_errors` 契约：后端保留 `detail`，并为 skill slug 冲突、请求体校验错误返回机器可读字段错误。
- 新建/编辑 skill 表单会捕获带 `field_errors` 的 `ApiError`，把重复 Skill ID 显示到错误摘要和 `Skill ID` 字段旁；E2E 覆盖重复 slug 后 summary focus、`aria-invalid` 和 summary link focus。
- TASK-052 新增基础格式校验：手工新建/编辑 skill 的 `slug` 复用标准 Skill name 规则；`tags` 限定为可稳定查询的字母、数字、点、下划线和连字符。
- Launchpad 非法 Skill ID 会显示服务端格式错误摘要，并把 `Skill ID` 标记为 `aria-invalid`。
- TASK-053 新增导入 bundle 字段错误映射：`SKILL.md`、frontmatter 和 zip 解析错误会保留全局 `detail`，同时返回 `field_errors` 到 `folder_files` 或 `zip_file`。
- Launchpad 和 Inspector 导入表单会捕获这些服务端字段错误，展示错误摘要，把同一条错误显示在上传控件旁，并标记 `aria-invalid`。
- TASK-054 新增批量 case 行级错误第一阶段：前端 parser 返回 `invalidRows`，批量表单有无效行时阻止提交、聚焦错误摘要，并把错误回填到 `batch_cases` textarea。
- TASK-055 新增服务端批量 case 字段错误契约：直连 `POST /api/eval-cases/batch` 时，缺字段或空字段返回 `cases[n].title`、`cases[n].expected_output` 这类行级 `field_errors`，同时保留 `tags[0] -> tags` 的旧映射。
- TASK-056 新增 eval case 文本长度校验：标题、Input、Expected output 和 Notes 超限时返回字段级错误，避免测试资产被误用成无限长文本存储。
- TASK-057 新增批量 case 导入预览表：粘贴后逐行展示可导入/需修正、标题、Input、Expected output 和 Notes，提交前就能发现串列。
- TASK-058 新增批量 case 预览移动端护栏：窄屏下 textarea、统计卡、预览表和提交按钮纵向排布，页面本身不横向滚动，预览表保留内部横向滚动。
- TASK-059 新增保存视图名称字段级校验：空白、重复或超过 80 字符的 saved view name 返回 `field_errors.name`，History 页保存表单会显示错误摘要和字段旁错误。
- TASK-060 新增 accepted verification note 字段级校验：超过 1000 字符的验证说明返回 `field_errors.note`，Run comparison 接受验证依据表单会显示错误摘要和字段旁错误。
- TASK-061 新增 promotion decision note 字段级校验：risky promotion 空说明或超过 1000 字符返回 `field_errors.decision_note`，Promotion review 决策表单会显示错误摘要和字段旁错误。
- TASK-063 新增 variant 写入字段校验：variant 名称最多 80 字符，variant 说明和版本说明最多 1000 字符；主工作区 `新建约束 variant` 和 `追加候选版本` 会显示错误摘要、字段旁错误和 `aria-invalid`。
- TASK-066 新增表单错误摘要统计：`ValidatedForm` 的错误摘要会显示需要修正的字段数量，保留原有 summary focus、摘要链接和字段旁错误。
- TASK-067 新增低频长文本字符计数：`TextAreaField.characterLimit` 会显示剩余/超出字符数，并把计数节点加入 `aria-describedby`；variant summary、change summary、verification note 和 promotion decision note 已接入 1000 字符提示。
- TASK-068 新增本地 session 退出控制：`Local login` 面板提供 `退出登录`，调用 `DELETE /api/session` 清除 actor cookie，前端刷新 actor 和 capabilities，退出后创建/导入 skill 回到默认 owner。
- TASK-069 新增 EvalRun results 精确字段校验：`POST /api/eval-runs` 不再把遗漏 case result 静默记为 `false`，也不再忽略未知 result key；缺失或多余结果会返回 `results.<case_version_id>` 字段错误。
- TASK-070 新增 Run matrix `Impact` 列配置：用户可以隐藏 `Impact` 列，URL state 和 saved run view 都会保存 `matrix_show_impact=false`。
- TASK-071 新增 Run matrix CSV 导出：用户可以把当前可见矩阵视图导出为 CSV，导出会遵循当前 rows 和 `Impact column` 可见性。
- TASK-072 新增 Saved run view 对照/候选指针：保存命名视图时会保存当前 comparison run ids，应用视图后恢复对应对照/候选按钮和 comparison panel。
- TASK-074 新增 Run matrix sticky header：矩阵表头会在滚动时保持可见，case 首列和 run 列上下文都不再轻易丢失。
- TASK-075 新增 Run matrix `Summary` 指标列：每个 case 直接展示当前 runs 下的通过/不通过/未覆盖摘要，列可隐藏，并随 URL、saved view 和 CSV 导出同步。

影响：

- 主要工作台表单已经减少浏览器自动填充误填、焦点规则分叉和字段语义漂移。
- 用户不再被浏览器原生 required 气泡挡住；服务端唯一性错误也不再只出现在全局 notice，而是回到用户需要修改的字段。
- 导入 bundle 的结构错误不再被当成普通 toast；用户能直接知道该重新选择文件夹还是 zip。
- 批量粘贴 case 不再静默跳过坏行；用户能看到第几行缺少标题、Input 或 Expected output。自动化脚本或外部导入工具直接调批量 API 时也能拿到同样的行级字段定位。
- 过长 eval case 不再悄悄进入测评集；维护者会看到对应字段的上限说明，并明确知道内容没有被截断保存。
- 批量粘贴不再是黑盒文本提交；用户可以在预览表中扫到解析结果，再决定是否提交。
- 移动端批量补 case 不再被桌面两栏压扁；用户先编辑输入，再看统计和预览，视线顺序更接近真实操作顺序。
- 保存历史筛选视图时，用户不再需要从全局 toast 猜测重名或超长问题；错误会直接回到 `保存视图名称`。
- 接受验证依据时，维护者不再能把过长审计说明塞进 verification pointer；超限错误会直接回到 `Accepted verification note`。
- 有风险的设为当前版本不再靠 disabled button 暗示缺说明；用户点击后会得到可回焦的字段级修正路径。
- 错误摘要不再只给泛化提示；用户能先看到本次有几个字段需要修正，再按摘要链接逐个处理。
- 有明确 1000 字符上限的低频长文本字段不再等提交后才暴露超限；用户可以边写边看到剩余或超出字符数。
- 后续新增表单应该优先复用 `WorkbenchField`，而不是在 pane 内继续手写 label/control。

建议：

- 下一轮表单方向应继续聚焦更复杂嵌套表单的字段级回填；EvalRun results 已完成第一条 map-key 级别的嵌套字段错误，后续可以延展到表格型编辑体验。
- 不建议为了“更像表单系统”而改成全受控输入；SkillHub 的长文本 case input/expected output 仍适合原生 form + FormData。

### 已解决第二阶段 / 仍需后续 - Command menu 已成为工作台操作入口层

证据：

- TASK-045 已让 `buildWorkbenchCommands` 接收 `currentMode`，并用 mode priority list 稳定提前相关命令。
- 空 skill 状态优先导入/新建；`evals` mode 优先 `record-run/new-case/batch-case/nav-history`；`variants` mode 优先 `new-variant/new-version/compare-version/nav-evals`。
- Vitest 覆盖 evals、variants、empty skill 排序；E2E 覆盖测评页打开 command menu 时第一条是 `记录本次测评`。
- TASK-049 新增本地最近命令排序，执行命令后保留最近 5 条，空搜索时优先展示但仍让 disabled 命令下沉。
- TASK-049 新增 selection-aware 命令：当前 case 可直接打开 case history，当前 run 可设为 comparison baseline/candidate。
- TASK-049 新增右侧 command preview，展示命令说明、作用对象、case/run id、快捷键和禁用原因；preview 不进入 Tab 序列，不破坏现有 combobox/listbox 模型。

影响：

- 用户在测评页和变体页不输入搜索也能先看到当前工作最相关动作，熟手路径更贴手；重复动作会被最近使用排序提前。
- 当前 case/run 的上下文动作不再散落在局部按钮里，键盘用户可以从同一个入口完成查看历史和设置 comparison。
- 仍未解决服务器端个性化、跨 skill 全局搜索、命令别名和快捷键自定义。

建议：

- 第三阶段如果做个性化，必须保留 deterministic fallback 和可清除最近记录，否则会损害用户肌肉记忆。
- 后续 selection-aware 命令可以继续扩到 selected variant / selected diff file，但需要先确认它们是高频动作。

### 已解决第一阶段 / 仍需后续 - Diff / Promotion review 缺少 review progress

证据：

- GitHub PR review 建议按文件审查、mark viewed、用进度条追踪文件 reviewed。
- TASK-046 已在 SkillHub diff mode 和 promotion review 的 bundle diff 中加入会话级 `viewed` 标记和 `Reviewed x/y` / `x/y reviewed` 进度。
- E2E 覆盖 diff 页初始 `Reviewed 0/3`、勾选当前文件后 `Reviewed 1/3`，以及 promotion review 初始 `0/3 reviewed`、勾选后 `1/3 reviewed`。

影响：

- 用户已经可以在一个 diff pair 内按文件推进审查，减少大 bundle diff 的记忆负担。
- 当前状态仍只存在于浏览器会话；刷新、跨设备或多人协作不会保留 viewed progress。

建议：

- 第二阶段再评估是否服务端持久化 viewed state、自动 collapse 已查看文件，或把 “diff reviewed” 作为人工检查项。
- 如果要做 promotion readiness gate，必须先明确它是协作状态、个人状态，还是一次 promotion decision 的本地 checklist。

### P3 - 视觉风格稳定，但还缺少成熟产品的密度层级

证据：

- 当前 palette 和卡片系统统一，视觉已明显不是早期 demo。
- 但 `overview/manual eval/variants` 多处使用同样尺寸的卡片和边框，主次层级仍偏平均。

影响：

- 用户能完成任务，但高级用户扫读效率还不够。

建议：

- 下一轮视觉重构不要先换颜色；先做信息密度层级：primary decision surface、supporting evidence、secondary admin actions 分层。
- 对 `history/run matrix` 和 `promotion` 使用更密的数据产品排版，对 first-run 使用更强引导排版。Run matrix 已完成第一条列配置、Summary 指标列、当前视图 CSV 导出、saved view comparison 指针和 sticky header，后续继续做用户自定义指标公式和更自由的列排序。

## 下一轮任务排序

1. **表单验证后续。** 更多嵌套表单的字段级回填和表格型错误定位；EvalRun results 精确校验已完成第一阶段。
2. **接入真实认证。** 用真实登录 session/token 替换本地登录码和 actor cookie，并复用当前 capability UI 契约。
3. **组织级 Audit Explorer。** 跨 skill 查询、日期范围、分页、导出和保留策略。
4. **Diff / Promotion reviewed progress 第二阶段。** 决定是否服务端持久化、自动折叠已查看文件或纳入 promotion checklist。
5. **URL state 第三阶段。** 短链接、权限感知分享提示和草稿恢复策略。

## 不建议马上做的事

- 不建议先大改颜色、字体或动画。当前更大的问题是空间分配和操作优先级，不是装饰不足。
- 不建议马上做复杂多维表格，除非先解决真实认证和表单验证剩余部分。
- 不建议继续在 inspector 里堆新表单。新动作如果是高频主路径，应优先进入对应主 pane 或 drawer。
