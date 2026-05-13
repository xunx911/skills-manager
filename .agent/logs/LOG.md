# Project Build Log

`Current Status`
=================
**Last Updated:** YYYY-MM-DD HH:MM
**Tasks Completed:** TOTAL_NUMBER_OF_TASKS
**Current Task:** TASK-CURRENT_TASK_NUMBER Complete

----------------------------------------------

## Session Log

### 2026-05-14 00:55 CST - TASK-034 Workbench History Pane 组件抽离

- 新增 `WorkbenchHistoryPane`，把历史页 saved views、filters、RunMatrix、run list、RunComparison 和逐 case result detail 从 `DecisionWorkbench` 抽离。
- 导出 `HistoryRunFilters`，让主工作台继续复用同一筛选类型并保留 API 查询、保存视图和 accepted verification mutation 编排。
- 保留历史页 CSS class、文案、ARIA label、filter 字段、matrix controls、comparison actions 和空态入口。
- 主文件从 2090 行降到 1814 行，新 History 文件 300 行。
- 已验证：`npm run typecheck` passed；`npm run build` passed；`uv run pytest` 90 passed；`npm run e2e` 50 passed；`git diff --check` passed。

### 2026-05-14 00:35 CST - TASK-033 Workbench Evals Pane 组件抽离

- 新增 `WorkbenchEvalsPane`，把测评页目标版本选择、candidate banner、快速添加 case、review controls、case queue、快捷键和 case 详情从 `DecisionWorkbench` 抽离。
- `DecisionWorkbench` 继续保留 caseResults、selectedCaseId、evalTargetVersionId 和 API mutation；Evals pane 只负责测评页派生状态和局部交互。
- 保留 `p/f/j/k`、ArrowUp/ArrowDown 快捷键、文本输入保护、case pass/fail 自动前进和候选版本验证交接行为。
- 主文件从 2391 行降到 2090 行，新 Evals 文件 295 行。
- 已验证：`npm run typecheck` passed；`npm run build` passed；`uv run pytest` 90 passed；`npm run e2e` 50 passed；`git diff --check` passed。

### 2026-05-14 00:15 CST - TASK-032 Workbench Overview Pane 组件抽离

- 新增 `WorkbenchOverviewPane`，把概览页的空态 launchpad、product hero、metrics、设置、权限、治理、验证引导和 bundle preview 从 `DecisionWorkbench` 抽离。
- 新增共享 `Metric` 组件，复用原 `linearMetric` class，供 Overview、Diff、History 使用，避免继续复制小 UI 单元。
- 将 `formatBytes` 移入 `apps/web/lib/format.ts`，供导入预览、diff 和 overview bundle 文件列表共用。
- 保留概览页 CSS class、文案、按钮入口和 handler 语义；主文件从 2616 行降到 2391 行，新 Overview 文件 223 行。
- 已验证：`npm run typecheck` passed；`npm run build` passed；`uv run pytest` 90 passed；`npm run e2e` 50 passed；`git diff --check` passed。

### 2026-05-13 23:55 CST - TASK-031 Workbench Inspector 组件抽离

- 新增 `WorkbenchInspector`，把右侧 Verification、Local Session、action menu 和 Inspector 表单从 `DecisionWorkbench` 抽离。
- `DecisionWorkbench` 继续保留 API mutation、状态编排和主区 mode 切换；Inspector 只负责右侧展示、表单 DOM 和焦点交接。
- 导出 `InspectorActionMode` 和 `InspectorImportPreview`，避免父子组件各自维护一份 action/preview 类型。
- 保留表单字段名、CSS class、文案、禁用逻辑和焦点交接行为；主文件从 2890 行降到 2616 行，新 Inspector 文件 293 行。
- 已验证：`npm run typecheck` passed；`npm run build` passed；`uv run pytest` 90 passed；`npm run e2e` 50 passed；`git diff --check` passed。

### 2026-05-13 23:35 CST - TASK-030 Skill Catalog 组件抽离

- 新增 `SkillCatalog` 组件，把左侧 skill 目录、筛选、导入、新建和选择入口从 `DecisionWorkbench` 中抽离。
- `DecisionWorkbench` 现在只向 catalog 传入状态和动作回调，后续继续拆分右侧 Inspector 和主区 panes 时边界更清楚。
- 保留原有 CSS class、文案、ARIA label 和用户可见行为，不做视觉重设计。
- 新增中文规格和执行计划，记录结构性红灯、组件边界和回滚策略。
- 已验证：`npm run typecheck` passed；`npm run build` passed；`uv run pytest` 90 passed；`npm run e2e` 50 passed；`git diff --check` passed。

### 2026-05-13 23:19 CST - TASK-029 Workbench Modes Tablist 键盘语义

- 将工作区 mode switcher 从普通按钮组抽成 `WorkbenchTabs`，按 APG Tabs Pattern 暴露 `tablist/tab/tabpanel`、`aria-selected`、`aria-controls` 和 roving `tabIndex`。
- 支持 Left/Right/Home/End 在 `概览 / 变体 / 测评 / 差异 / 历史` 中移动并自动激活当前 panel；`差异` tab 保留既有 diff 预加载逻辑。
- 新增 accessibility E2E 覆盖 tablist 语义、tabpanel 关联、roving tabIndex 和方向键切换。
- 更新 README、UX 复盘和产品完成度审计，明确 Workbench mode tablist 已闭环，剩余 accessibility 深水区集中在更广的全路径焦点巡检和人工读屏验收。
- 已验证：`uv run pytest` 90 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 50 passed；`git diff --check` passed。

### 2026-05-14 00:18 CST - TASK-028 Inspector Action 焦点交接

- 在 `DecisionWorkbench` 中增加 `inspectorFocusRequest`，用户触发 action 时请求一次 Inspector 表单焦点交接；初始空数据加载和普通 skill 切换不会抢焦点。
- `Inspector` 在 action 表单渲染后聚焦当前 `.inspectorForm` 的第一个可操作控件，不使用正 `tabindex`，不重排全局 Tab 顺序。
- 新增 accessibility E2E 覆盖 catalog `导入` 和 command menu `添加 case` 两条路径，证明动态右侧表单获得焦点。
- 更新 README、UX 复盘和产品完成度审计，明确 Inspector action focus handoff 已闭环，剩余 accessibility 深水区集中在更广的全路径焦点巡检和人工读屏验收。
- 已验证：`uv run pytest` 90 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 49 passed；`git diff --check` passed。

### 2026-05-13 23:58 CST - TASK-027 Run Matrix 表格语义

- 将 `RunMatrixPanel` 明确为命名原生 table：新增隐藏 caption、description、`aria-rowcount` / `aria-colcount`、列/行 header scope 和 row/col index。
- 给 impact 单元格和 pass/fail/missing 结果单元格补完整 `aria-label`，读屏不再需要靠颜色、chip 文案和视觉位置推断 case/run/result。
- 扩展 run matrix E2E：覆盖 table 名称、columnheader、rowheader、pass/fail/missing cell 名称、impact cell 名称，并修正 `addEvalCase` helper 的 exact selector。
- 更新 README、UX 复盘和产品完成度审计，明确 run matrix 表格语义已闭环，剩余 accessibility 深水区集中在完整焦点顺序和人工读屏验收。
- 已验证：`uv run pytest` 90 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 47 passed；`git diff --check` passed。

### 2026-05-13 23:42 CST - TASK-026 Command Menu ARIA 语义

- 将 `CommandMenu` 收敛为 `dialog + editable combobox + listbox` 模式：搜索框暴露 `aria-controls` / `aria-activedescendant`，结果项暴露 `role=option` 和 `aria-selected`。
- 新增可见关闭按钮，Tab 在搜索框和关闭按钮之间循环，Escape 或关闭按钮会关闭菜单并把焦点恢复到触发入口。
- 新增 Playwright accessibility 回归，覆盖方向键更新 active option、listbox/option 关系、Tab trap 和关闭回焦点。
- 更新 README、UX 复盘和产品完成度审计，明确 command menu ARIA 已闭环，剩余深水区集中在 run matrix 表格语义、完整焦点顺序和人工读屏验收。
- 已验证：`uv run pytest` 90 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 47 passed；`git diff --check` passed。

### 2026-05-13 23:15 CST - TASK-025 Accessibility 回归护栏

- 新增 `apps/web/e2e/accessibility-workbench.spec.ts`，覆盖 skip link、可见焦点、reduced-motion 和 status notice 四条回归。
- `AppShell` 增加 `跳到主要内容` skip link，并让 `main#main-content` 可被键盘焦点定位。
- 全局 `:focus-visible` 改为高对比双层 focus ring；`prefers-reduced-motion: reduce` 下把非必要 transition/animation 收敛到近似无动画。
- `linearNotice` 增加 `role=status` 和 `aria-live=polite`，让保存、切换 actor 等异步反馈能被读屏感知。
- 已验证：`uv run pytest` 90 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 45 passed；`git diff --check` passed。

### 2026-05-13 22:42 CST - TASK-024 本地 Session Actor

- 新增 `GET/POST/DELETE /api/session`，用 HMAC 签名的 HttpOnly `skillhub_actor` cookie 承载本地 actor；cookie 被篡改时返回 400，不回退默认身份。
- `actor_dependency` 优先读取 session cookie，`X-SkillHub-Actor` 仅作为直接 API/自动化脚本的兼容 fallback；本地 CORS 开启 credentials。
- 前端移除硬编码 actor header，`apiGet/apiSend` 统一使用 `credentials: "include"`；右侧 inspector 新增 `LocalSessionPanel`，可直接切换本地 actor。
- 新增 API、E2E 和视觉回归覆盖；修复 E2E 清理逻辑，让多 actor owner 的测试数据也能可靠归档，避免跨测试污染。
- 已验证：`uv run pytest` 90 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 41 passed；`git diff --check` passed。

### 2026-05-13 21:58 CST - TASK-023 Skill 审计事件 Explorer

- 扩展 `GET /api/skills/{skill_id}/audit-events`：支持 `actor`、`action`、`resource_type` filter，并把当前 skill 关联的 `variant` / `eval_run` audit events 纳入同一时间线。
- 新增 `SkillAuditExplorer`，支持事件摘要、actor/action/resource type 过滤、事件列表和 payload 检查；治理面板新增 `查看全部审计` 入口。
- 将审计入口保持为低频路径：通过治理面板或 `Cmd/Ctrl+K` 打开，只有在审计模式中显示 `审计` tab，避免挤压主导航。
- 新增 API、E2E、视觉基线覆盖，并更新 README、API contract、UX 复盘、产品完成度审计和 Superpowers 规格/计划。
- 已验证：`uv run pytest` 88 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 39 passed；`git diff --check` passed。

### 2026-05-13 21:32 CST - TASK-022 Skill 治理与审计面板

- 新增 skill 级 audit read model：`GET /api/skills/{skill_id}/audit-events`，并让 skill detail 返回最近 `audit_events`。
- `DELETE /api/skills/{skill_id}` 改为读取请求级 actor，要求 skill `owner` 权限，成功归档后写入 `skill.archived` audit event。
- 概览主区新增 `SkillGovernancePanel`，展示 lifecycle、角色态势、最近审计事件和需要输入当前 skill ID 的危险区；移除 inspector 中的普通归档按钮。
- 新增 API、E2E、视觉基线覆盖，并更新 README、API contract、UX 复盘、产品完成度审计和 Superpowers 规格/计划。
- 已验证：`uv run pytest` 87 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 37 passed；`git diff --check` passed。

### 2026-05-13 21:15 CST - TASK-021 请求级 ActorContext

- 新增 FastAPI `ActorContext` dependency，从 `X-SkillHub-Actor` 读取本地开发 actor，缺省为 `product-operator`。
- Mutation route 不再读取 payload 中的 `actor`；旧 body actor 会被忽略，审计和权限判断统一使用请求级 actor context。
- 前端 `apiSend` 统一发送 `X-SkillHub-Actor`，并删除所有 mutation body 里的 `actor: ACTOR` 和 role revoke query actor。
- 新增 API 测试覆盖 header actor 覆盖 body actor，以及 viewer/maintainer 受保护动作身份来源；更新 API contract、README、UX 复盘、产品完成度审计和 Superpowers 规格/计划。
- 已验证：`uv run pytest` 85 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 35 passed；`git diff --check` passed。

### 2026-05-13 21:01 CST - TASK-020 Skill 作用域访问控制

- 创建 skill 或导入 Skill bundle 时，后端会在同一事务内自动授予 actor 当前 skill 的 owner 角色。
- 新增 skill role assignment 的列表、授予和撤销 API；概览主工作区新增 `SkillAccessPanel`，可查看当前角色、添加成员、移除非最后 owner。
- `promotion` 和 `accepted verification` 已接入 skill 作用域权限门禁，仅 owner/maintainer 可移动当前分发指针或认可验证指针。
- 新增 API 测试、E2E 路径和访问控制面板视觉基线；更新 README、API contract、UX 复盘、产品完成度审计和 Superpowers 规格/计划。
- 已验证：`uv run pytest` 84 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 35 passed；`git diff --check` passed。
- 截图：`.agent/screenshots/TASK-020-1.png`。

### 2026-05-13 20:45 CST - TASK-019 Run Matrix 多维控制

- 在 History mode 的 `Run matrix` 增加 impact 过滤、按 impact 分组和隐藏 run header 分数控制。
- 扩展 saved view config，保存视图现在会一起保存并恢复 run filters 和 matrix 展示偏好。
- 修复 matrix panel 外层 `overflow: hidden` 导致 Playwright 和用户点击小控件时可能命中错位的问题，滚动职责保留给内部 matrix scroller。
- 新增 API/E2E 覆盖 matrix 控制保存、恢复、impact 分组和 impact 过滤；更新 README、UX 复盘、产品完成度审计和 run comparison 视觉基线。
- 已验证：`uv run pytest` 81 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 33 passed；`git diff --check` passed。
- 截图：`.agent/screenshots/TASK-019-1.png`。

### 2026-05-13 20:13 CST - TASK-018 主工作区 Skill 设置

- 在概览主工作区新增 `SkillSettingsPanel`，可直接修改 skill ID、归属，并选择默认分发 variant。
- 扩展 `PATCH /api/skills/{skill_id}` 支持 `default_variant_id`，repository 会拒绝跨 skill 的默认 variant 指针。
- 新增 API 测试覆盖 default variant 切换和跨 skill 拒绝；新增 E2E 覆盖主区设置保存后 header、catalog、hero 同步刷新。
- 更新 API contract、README、UX 复盘、产品完成度审计和 imported overview 视觉基线。
- 已验证：`uv run pytest` 81 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 33 passed；`git diff --check` passed。
- 截图：`.agent/screenshots/TASK-018-1.png`。

### 2026-05-13 19:56 CST - TASK-017 主工作区 Skill Launchpad

- 在空工作台概览主区新增 `SkillLaunchpad`，可直接导入标准 Skill bundle 或创建空白 skill；右侧 inspector 路径继续保留。
- 新增 `SkillLaunchpad` 组件并复用现有 `POST /api/skill-imports`、`POST /api/skills` 数据流，导入 preview、folder/zip 上传和创建默认 variant 仍由后端落库。
- 新增 E2E 覆盖主区导入和主区新建 skill，并收窄旧导入 helper 到 inspector，避免主区和 inspector 的同名按钮冲突。
- 更新 empty/mobile empty 视觉基线和产品文档，记录 Vercel、GitHub、Linear、Raycast 的 first-run/创建流程借鉴。
- 已验证：`uv run pytest` 80 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 32 passed；`git diff --check` passed。
- 截图：`.agent/screenshots/TASK-017-1.png`。

### 2026-05-13 19:31 CST - TASK-016 主工作区创建 Variant

- 在 `变体` 主工作区新增 `VariantCreationComposer`，可直接填写 label、tags、summary、change summary，并选择是否设为 default。
- 主区创建 variant 默认从当前 default variant 的 current version 复制内容引用，让新 variant 的 v1 有真实基线；右侧 inspector 创建路径保留。
- 新增 E2E 覆盖主工作区创建 variant，并新增 `variants-workspace-composers` 视觉基线。
- 已验证：`uv run pytest` 80 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 30 passed；`git diff --check` passed。
- 截图：`.agent/screenshots/TASK-016-1.png`。

### 2026-05-12 21:45 CST - TASK-015 主工作区追加 VariantVersion

- 在 `变体` 主工作区新增 `WorkspaceVersionComposer`，可直接选择 variant、上传标准 Skill 文件夹或 zip、填写 change summary，并选择是否直接设为 current。
- 复用现有 `POST /api/variant-versions` 和 candidate verification handoff；默认追加为候选版本，保存后自动进入 exact 测评目标。
- 收窄旧 E2E helper 的 inspector 定位器，避免主工作区 composer 与右侧 inspector 的文件输入冲突。
- 已验证：`uv run pytest` 80 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 28 passed；`git diff --check` passed。
- 截图：`.agent/screenshots/TASK-015-1.png`。

### 2026-05-10 20:55 CST - TASK-014 测评 case 详情内联编辑

- 新增 `EvalCaseDetailPanel`，在手工测评详情面板中直接查看并编辑当前 case 的 title、input、expected output 和 notes。
- 编辑保存复用现有 `PATCH /api/eval-cases/{case_id}`，继续生成新的 case version 和 EvalSetVersion，旧 inspector 编辑入口保持可用。
- 新增 E2E 覆盖不经过 inspector 的 inline edit 路径，并更新手工测评视觉基线。
- 已验证：`uv run pytest` 80 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 27 passed。

### 2026-05-10 20:10 CST - TASK-013 Run matrix 逐 case 影响态

- 在 History mode 的 Run matrix 中接入现有 `对照` / `候选` run 选择。
- 矩阵每个 case 行新增 impact chip，显示 `修复`、`回退`、`稳定通过`、`仍未通过`、`缺失` 或等待选择状态。
- 新增 E2E 覆盖候选 run 相对对照 run 的 `修复` 和 `稳定通过`。
- 已验证：`uv run pytest` 80 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 26 passed。

### 2026-05-10 19:45 CST - TASK-012 测评历史保存视图

- 新增 `saved_views` 持久化模型和 `GET /api/skills/{skill_id}/saved-views`、`POST /api/saved-views`、`DELETE /api/saved-views/{id}`。
- 在 History mode 增加保存视图控件，可保存当前 run filters、应用保存视图并同步刷新 run list 和 run matrix、删除不再需要的视图。
- 新增 repository/API/E2E 覆盖保存视图 round trip；文档已补充 README、产品审计和 UX 复盘。
- 已验证：`uv run pytest` 80 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 26 passed；视觉基线已更新。

### 2026-05-10 19:20 CST - TASK-011 测评结果矩阵视图

- 新增 `GET /api/skills/{skill_id}/eval-run-matrix`，复用 history filters 返回 case x run 矩阵 read model。
- 在 History mode 增加 `Run matrix`，显示当前筛选下每个 case 在每个 eval run 中的通过、不通过或未覆盖状态。
- 已新增 repository/API/E2E 覆盖，并更新 run comparison 视觉基线。
- 已验证：`uv run pytest` 77 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 25 passed；`git diff --check` passed。

### 2026-05-10 18:55 CST - TASK-010 Case 历史版本恢复

- 已新增 `POST /api/eval-cases/{case_id}/restores`，恢复旧 `EvalCaseVersion` 时创建新的当前版本，不覆盖历史。
- 已把 case history 面板抽到独立组件，并给非当前版本加 `恢复此版本`。
- 修复恢复后通用刷新链路会清空 case history 的状态问题，eval set 刷新时只在当前 case 不再属于 snapshot 时关闭历史面板。
- 已验证：`uv run pytest` 75 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 24 passed；`git diff --check` passed。

### 2026-05-10 16:48 CST - TASK-009 导入后验证引导

- 在概览页新增 `验证清单`，把导入 bundle 后的下一步组织为补 case、记录首轮测评、查看证据历史。
- 单条 case 创建成功后自动切到 `测评` tab 和 `记录测评` 上下文，减少从概览添加首条 case 后的断点。
- 新增 Playwright 覆盖导入后首轮验证路径：导入 -> 添加首条 case -> 手工通过 -> 记录 run -> 查看历史。
- 验证：`uv run pytest` 71 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 23 passed。
- 视觉截图：`.agent/screenshots/TASK-009-1.png`。

### 2026-05-10 16:30 CST - TASK-008 候选版本验证交接

- 追加 `make_current=false` 的候选版本后，工作台自动切到 `测评`，并选中新建 candidate 作为 exact 测评目标。
- 切换测评目标会清空本地 pass/fail 草稿，避免把 current run 的判断误带到 candidate。
- 新增 candidate verification banner，可从测评页直接进入 `设为当前版本评审`。
- 验证：`uv run pytest` 71 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 22 passed。
- 截图：`.agent/screenshots/TASK-008-1.png`。

### 2026-05-10 16:11 CST - TASK-007 手工测评执行队列

- 将测评页 pass/fail 区升级为 review queue，支持全部/未确认/通过/不通过筛选、点击结果后自动前进、未确认批量标为通过、清空草稿和键盘 `p/f/j/k`。
- 新增 `EvalReviewControls`，把进度、筛选和批量动作从巨型工作台组件中抽出，降低 UI 腐化。
- 更新手工测评视觉基线，修复 controls 三列布局在三栏工作台中横向裁切的问题。
- 验证：`uv run pytest` 71 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 21 passed。
- 截图：`.agent/screenshots/TASK-007-1.png`。

### 2026-05-10 15:55 CST - TASK-006 快速添加测试用例

- 在测评页新增单条/批量快速添加 case 面板，批量粘贴支持 `title | input | expected output | notes` 和 tab 分隔。
- 新增 `POST /api/eval-cases/batch`，一次批量写入只生成一个新的 `EvalSetVersion`，并保持 case version 快照语义。
- 新增 Playwright 覆盖：批量粘贴两条 case 后立即手工确认通过/不通过并记录 `EvalRun`。
- 验证：`uv run pytest` 71 passed；`npm run typecheck` passed；`npm run build` passed；`npm run e2e` 19 passed；`git diff --check` passed。
- 截图：`.agent/screenshots/TASK-006-1.png`。
