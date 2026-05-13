# SkillHub 产品操作摩擦审计

日期：2026-05-14

状态：当前产品闭环已经强于普通 demo，但还不是成熟产品。主要缺口不在“能不能跑通”，而在信息架构密度、历史/发布证据的可扫读性，以及部分表单/焦点/深层 URL 状态的产品级细节。移动端 first-run、证据视图 inspector 折叠、URL state 第一阶段和 Audit Explorer 扫读重构已经按本审计后续任务完成。

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

## 摩擦发现

### P1 - 移动端 first-run 同时展示主入口和完整 inspector，认知负担过高

证据：

- `apps/web/e2e/visual-workbench.spec.ts-snapshots/mobile-empty-workbench-chromium-darwin.png` 显示移动端先展示 Launchpad，往下又展示 Verification、Local session、action menu 和第二份 `导入标准 Skill` inspector 表单。
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
- Empty skill 状态下 Verification/Local session 可以压缩为一行状态，而不是完整卡片。

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

### P1 - 深层 URL state 仍未完成，复杂证据上下文还不能分享

证据：

- TASK-042 已完成第一阶段：`/skills?skill=<slug-or-id>&mode=<mode>` 可以恢复 selected skill 和 mode。
- Vercel guideline 明确要求 filters、tabs、pagination、expanded panels 等 state 进入 URL。
- 当前 `/skills` 仍不能深链到 `history?variant_version=...`、`mode=diff&left=...&right=...`、selected run/case、run comparison 或 `promotion candidate`。

影响：

- 用户已经可以把“某个 skill 的历史页”发给同事，但还不能分享“某次候选版本测评结果”或“某组 diff pair”。
- 刷新页面不会丢 selected skill/mode，但仍会丢历史筛选、diff pair 或 candidate review 上下文。

建议：

- 第二阶段同步 `selected_case_id`、`eval_target_version_id`、`diff_left/right`、`run filters`、selected run 和 run comparison。
- Promotion review 需要候选版本、目标测试集和 evidence run 共同确定上下文，建议单独设计 permalink。

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

### P2 - 表单细节还没达到产品级

证据：

- 多个输入只有 placeholder 和 `name`，缺少 `autoComplete`：例如 `SkillLaunchpad` 的 owner/tags/slug 字段在 `apps/web/components/skills/skill-launchpad.tsx:55` 到 `109`，Inspector 的低频表单在 `apps/web/components/inspector/workbench-inspector.tsx:161` 到 `290`。
- Vercel guideline 要求输入设置合适 `autocomplete`，非认证字段可显式 `autocomplete="off"`，placeholder 使用示例并以 `…` 表达未完成。
- CSS 中仍有局部 `outline: none`：`apps/web/app/globals.css:387` 到 `403`、`5556` 到 `5562`。虽然已有替代 `box-shadow`，但使用的是 `:focus` 而不是 `:focus-visible`，和全局 focus 模式不一致。

影响：

- 浏览器自动填充可能干扰 `owner_ref`、`tags`、`slug` 这类非个人信息字段。
- 焦点样式有全局/局部两套规则，后续维护容易回归。

建议：

- 建立 `TextField/TextAreaField/FileField` 小组件，统一 label、name、autoComplete、placeholder、error、focus-visible。
- 对非认证业务字段默认 `autoComplete="off"`。
- 把局部 `:focus` 改为 `:focus-visible`，和全局 focus ring 统一。

### P2 - Command menu 已可用，但还不够上下文化

证据：

- `useWorkbenchCommands` 已经锁住 14 个命令，但目前顺序基本静态。
- Linear command menu 的优秀点是按当前视图/焦点优先展示相关命令。

影响：

- 在 `测评` 页打开 command menu 时，用户最可能需要 `添加 case`、`记录本次测评`、`批量添加 case`，但菜单仍先展示全局导航。
- 熟手路径能用，但还没做到“越用越贴手”。

建议：

- `buildWorkbenchCommands` 增加 `currentMode`，按 mode 给命令排序或打 group priority。
- 命令菜单顶部增加 “当前视图推荐动作”，但保留所有命令可搜索。

### P2 - Diff / Promotion review 缺少 review progress

证据：

- GitHub PR review 建议按文件审查、mark viewed、用进度条追踪文件 reviewed。
- SkillHub diff 现在有文件 rail 和 line diff，但没有 `viewed` 标记和文件审查进度。

影响：

- 当 skill bundle 文件变多时，用户不知道哪些文件已经看过。
- promotion review 的“已看 diff”目前是主观判断，不是系统状态。

建议：

- 在 diff/promotion diff 增加 `mark viewed`、`x/y files viewed`。
- promotion readiness 可以把 “diff reviewed” 作为人工检查项，而不是只看 eval run。

### P3 - 视觉风格稳定，但还缺少成熟产品的密度层级

证据：

- 当前 palette 和卡片系统统一，视觉已明显不是早期 demo。
- 但 `overview/manual eval/variants` 多处使用同样尺寸的卡片和边框，主次层级仍偏平均。

影响：

- 用户能完成任务，但高级用户扫读效率还不够。

建议：

- 下一轮视觉重构不要先换颜色；先做信息密度层级：primary decision surface、supporting evidence、secondary admin actions 分层。
- 对 `history/run matrix` 和 `promotion` 使用更密的数据产品排版，对 first-run 使用更强引导排版。

## 下一轮任务排序

1. **TASK-044：表单字段组件化和 autocomplete/focus-visible 统一。**
2. **TASK-045：Command menu 当前 mode 上下文化排序。**
3. **TASK-046：Diff / Promotion review file viewed progress。**
4. **URL state 第二阶段。** 补齐 diff pair、history filters、selected case/run、run comparison、eval target version 和 promotion permalink。
5. **组织级 Audit Explorer。** 跨 skill 查询、日期范围、分页、导出和保留策略。

## 不建议马上做的事

- 不建议先大改颜色、字体或动画。当前更大的问题是空间分配和操作优先级，不是装饰不足。
- 不建议马上做复杂多维表格，除非先解决 history/promotion 的可分享 URL 和 inspector 折叠。
- 不建议继续在 inspector 里堆新表单。新动作如果是高频主路径，应优先进入对应主 pane 或 drawer。
