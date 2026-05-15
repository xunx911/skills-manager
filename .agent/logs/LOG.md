# Project Build Log

`Current Status`
=================
**Last Updated:** YYYY-MM-DD HH:MM
**Tasks Completed:** TOTAL_NUMBER_OF_TASKS
**Current Task:** TASK-CURRENT_TASK_NUMBER Complete

----------------------------------------------

## Session Log

### 2026-05-16 00:06 CST - TASK-061 Promotion decision note 字段级校验

- 新增 `docs/superpowers/specs/2026-05-15-promotion-decision-note-validation-design.md` 和执行计划，记录 GOV.UK Error Summary / Validation / Textarea 与 GitHub protected branch 对 promotion gate 的适配。
- `PromoteVariantVersionPayload.decision_note` 增加 1000 字符服务端上限，超长说明返回 `field_errors.decision_note` 和中文文案 `设为当前版本说明最多 1000 个字符。`。
- risky promotion 空说明从普通 invariant 改成字段错误 `promotion.decision_note_required`，文案 `填写设为当前版本说明。`。
- `PromotionReviewPane` 决策表单接入 `ValidatedForm` 和共享 `TextAreaField`；不再用 disabled button 解释缺少说明，提交后显示错误摘要、字段旁错误和 `aria-invalid`。
- README、API contract、产品体验评审、完成度审计、摩擦审计和 TASK-061 任务记录已更新。
- 已验证：红灯 API 先失败于空 risky note 缺少 `field_errors`；绿色后目标 API 1 passed；红灯 E2E 先失败于接受风险按钮仍 disabled；绿色后目标 E2E 1 passed；`UV_NO_CACHE=1 uv run pytest` 105 passed；`npm run test:unit` 5 files/16 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`npm run e2e` 69 passed；`git diff --check` passed；任务 JSON 结构检查 passed；关键文件行数 901/2428/2059/157/1615/8380/961/224/1022/183/222/177/100/42/34/429/481。

### 2026-05-15 23:49 CST - TASK-060 Accepted verification note 字段级校验

- 新增 `docs/superpowers/specs/2026-05-15-accepted-verification-note-validation-design.md` 和执行计划，记录 GOV.UK Error Summary / Validation / Character count 与 MOJ Alert 对 verification note 字段错误体验的适配。
- `AcceptEvalRunVerificationPayload.note` 增加 1000 字符服务端上限，超长说明返回 `field_errors.note` 和中文文案 `验证说明最多 1000 个字符。`。
- `RunComparisonPanel` 的 accepted verification 表单接入 `ValidatedForm` 和共享 `TextField`；`acceptComparisonCandidate` 对 API 字段错误重新抛给表单。
- 超长 note 现在会显示错误摘要、字段旁错误、`aria-invalid`，摘要链接可回焦到 `Accepted verification note` 输入框。
- README、API contract、产品体验评审、完成度审计、摩擦审计和 TASK-060 任务记录已更新。
- 已验证：红灯 API 先失败于 1001 字符 note 返回 200；绿色后目标 API 2 passed；红灯 E2E 先失败于 `.runCompareAcceptBar .formErrorSummary` 不存在；绿色后目标 E2E 1 passed；`UV_NO_CACHE=1 uv run pytest` 104 passed；`npm run test:unit` 5 files/16 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`npm run e2e` 69 passed；`git diff --check` passed；任务 JSON 结构检查 passed；关键文件行数 896/1953/163/1611/194/224/1020/182/220/176/92/44/21/422/463。

### 2026-05-15 23:24 CST - TASK-059 保存视图名称字段级校验

- 新增 `docs/superpowers/specs/2026-05-15-saved-view-name-validation-design.md` 和执行计划，记录 GOV.UK Error Summary / Validation / Character count 与 MOJ Alert 对保存视图字段错误体验的适配。
- `CreateSavedViewPayload.name` 增加 1-80 字符服务端校验，超长名称返回 `field_errors.name` 和中文上限文案。
- `SqlSkillRepository.create_saved_view` 对 trim 后空白名和唯一约束冲突返回 `FieldInvariantError`，重复名称稳定返回 code `saved_view.name_conflict`。
- `SavedRunViews` 接入 `ValidatedForm`；保存按钮改为 submit，空白/重复/超长名称会显示错误摘要、字段旁错误和 `aria-invalid`，摘要链接可回焦到 `保存视图名称`。
- 更新 run comparison 视觉基线：保存按钮从空值禁用改为可提交以触发表单错误，这是本轮交互变化的预期结果。
- README、API contract、产品体验评审、完成度审计、摩擦审计和 TASK-059 任务记录已更新。
- 已验证：红灯 API 先失败于重复名缺少 `field_errors` 和 81 字符名称返回 200；绿色后目标 API 2 passed；红灯 E2E 先失败于 `.savedRunViews .formErrorSummary` 不存在；绿色后目标 E2E 1 passed；visual run comparison 更新后定点 1 passed；in-app Browser 当前工作台非空、console error/warn 为 0；`UV_NO_CACHE=1 uv run pytest` 103 passed；`npm run test:unit` 5 files/16 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`npm run e2e` 68 passed；`git diff --check` passed；任务 JSON 结构检查 passed；关键文件行数 891/2419/1911/75/1607/163/224/1018/181/218/175/44/97/21/415/453。

### 2026-05-15 22:57 CST - TASK-058 批量 case 预览移动端护栏

- 新增 `docs/superpowers/specs/2026-05-15-batch-case-preview-mobile-design.md` 和执行计划，记录批量 case 预览在窄屏下的响应式边界。
- 新增移动端 E2E：导入标准 Skill bundle 后切换到 390px viewport，批量粘贴 case，断言统计卡位于 textarea 下方。
- E2E 同时保护页面不出现文档级横向滚动，并确认预览表保留容器内部横向滚动。
- `quickCaseHeader`、`quickCaseGrid` 和 `quickCaseBatch` 在 640px 以下改为单列，统计卡、表格容器和提交按钮填满可用宽度。
- README、产品体验评审、完成度审计、摩擦审计和 TASK-058 任务记录已更新。
- 已验证：红灯 E2E 先失败于统计卡仍在 textarea 同行范围内；绿色后目标 E2E 1 passed；in-app Browser 当前测评页显示批量预览表、console error/warn 为 0、截图无可见框架错误覆盖层；`UV_NO_CACHE=1 uv run pytest` 102 passed；`npm run test:unit` 5 files/16 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`npm run e2e` 67 passed；`git diff --check` passed；任务 JSON 结构检查 passed；关键文件行数 944/8372/223/179/216/174/29/63/19/408/444。

### 2026-05-15 22:25 CST - TASK-057 批量 case 导入预览表

- 新增 `docs/superpowers/specs/2026-05-15-batch-case-import-preview-design.md` 和执行计划，记录 TestRail CSV preview/finalize、Airtable CSV import preview 和 GOV.UK Error Summary 对批量导入体验的适配。
- `parseBatchCases` 新增 `previewRows`，每条非空粘贴行都会给出行号、状态、解析字段和可选错误文案。
- 新增 `BatchCasePreviewTable`，批量模式下显示语义化预览表，区分 `可导入` 与 `需修正`，并展示标题、Input、Expected output 和 Notes。
- 预览表只负责提交前确认；修正仍回到 textarea，不在本阶段引入复杂内联编辑或 CSV mapping。
- README、产品体验评审、完成度审计、摩擦审计和 TASK-057 任务记录已更新。
- 已验证：红灯 unit 先失败于 `previewRows` 缺失；红灯 E2E 先失败于 `.quickCaseBatchTable` 不存在；绿色后目标 unit 1 passed、目标 E2E 2 passed；in-app Browser 桌面检查预览表可见、状态可读、console error/warn 为空；`UV_NO_CACHE=1 uv run pytest` 102 passed；`npm run test:unit` 5 files/16 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`npm run e2e` 66 passed；`git diff --check` passed；任务 JSON 结构检查 passed；关键文件行数 100/47/51/122/8336/142/917/223/178/214/173/45/70/35/444。

### 2026-05-15 10:55 CST - TASK-056 Eval case 文本长度校验

- 新增 `docs/superpowers/specs/2026-05-15-eval-case-length-validation-design.md` 和执行计划，记录 GOV.UK/MOJ、MDN 以及 GitHub/Linear 类工作流产品对标题/正文边界的适配。
- 后端为 eval case 写入路径增加资产保护上限：`title` 160、`input_text` 20000、`expected_output` 10000、`notes` 2000 字符。
- `POST /api/eval-cases`、`POST /api/eval-cases/batch`、`POST /api/eval-case-versions` 和 `PATCH /api/eval-cases/{case_id}` 共用同一组 Pydantic 字段规则。
- 字段错误文案新增上限说明；批量路径继续返回 `cases[n].field`，单条和更新路径返回具体字段名。
- README、API contract、产品体验评审、完成度审计、摩擦审计和 TASK-056 任务记录已更新。
- 已验证：红灯 API 先失败于超长标题、Input 和 Expected output 仍返回 200；绿色后目标 API 5 passed；`UV_NO_CACHE=1 uv run pytest` 102 passed；`npm run test:unit` 5 files/16 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`npm run e2e` 66 passed；`git diff --check` passed；任务 JSON 结构检查 passed；关键文件行数 884/1860/223/1016/176/212/172/47/67/32/435。

### 2026-05-15 10:22 CST - TASK-055 服务端批量 case 字段错误契约

- 新增 `docs/superpowers/specs/2026-05-15-batch-case-api-field-errors-design.md` 和执行计划，记录 JSON:API、RFC 9457 与 GOV.UK Error Summary 对批量 API 字段定位的适配。
- `request_body_field` 对 `cases[]` 保留索引，返回 `cases[n].field`；对其他数组 item 继续折叠到顶层字段，保持 `tags[0] -> tags` 兼容行为。
- 新增批量 case 行级中文文案：缺少或填空 `title`、`input_text`、`expected_output` 时返回“第 n 行填写字段”。
- 新增 API 红绿测试覆盖第 1 行标题为空和第 2 行缺少 Expected output，保证直连批量 API 不再只能得到泛化 `cases.field`。
- README、API contract、产品体验评审、完成度审计、摩擦审计和 TASK-055 任务记录已更新。
- 已验证：红灯 API 先失败于字段名缺少 `cases[n]` 行号和泛化文案；绿色后目标 API 2 passed；`UV_NO_CACHE=1 uv run pytest` 99 passed；`npm run test:unit` 5 files/16 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`npm run e2e` 66 passed；`git diff --check` passed；任务 JSON 结构检查 passed；关键文件行数 844/1778/1009/221/175/210/171/41/27/20/426。

### 2026-05-15 04:20 CST - TASK-054 批量 case 行级错误第一阶段

- 新增 `docs/superpowers/specs/2026-05-15-batch-case-row-errors-design.md` 和执行计划，记录 GOV.UK Error Summary、Airtable 多行粘贴和 TestRail case import 对批量错误体验的适配。
- 新增 `quick-add-cases-parser.ts`，把批量 case parser 从组件中抽成纯 TS 模块，返回 `valid`、`invalidRows` 和 `invalidCount`。
- `ValidatedForm` 新增可选 `validate(form)` 扩展点，供本地业务校验复用同一套错误摘要、summary focus、字段旁错误和 `aria-invalid`。
- 批量 case 表单接入 `ValidatedForm`：有无效行时阻止提交，错误回填到 `batch_cases` textarea，并显示最多前三条行级错误。
- 新增 unit 红绿测试覆盖缺少 Expected output 和标题的行级解析；新增 E2E 覆盖无效行阻止提交、summary focus、`aria-invalid` 和不创建部分有效 case。
- README、产品体验评审、完成度审计、摩擦审计和 TASK-054 任务记录已更新。
- 已验证：红灯 unit 先失败于 parser 模块缺失；红灯 E2E 先失败于 `.formErrorSummary` 缺失；绿色后目标 unit 1 passed、目标 E2E 1 passed；`UV_NO_CACHE=1 uv run pytest` 98 passed；`npm run test:unit` 5 files/16 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`npm run e2e` 66 passed；`git diff --check` passed；任务 JSON 结构检查 passed；关键文件行数 120/68/22/184/140/8222/48/28/35。

### 2026-05-14 04:42 CST - TASK-053 导入 bundle 字段错误映射第一阶段

- 新增 `docs/superpowers/specs/2026-05-14-import-bundle-field-errors-design.md` 和执行计划，记录 GOV.UK Error Summary、GOV.UK File Upload、JSON:API 和 RFC 9457 对导入错误定位的适配。
- `POST /api/skill-imports` 捕获 bundle parser 的 `InvariantError`，保留兼容 `detail`，并按 `source.kind` 把错误映射到 `folder_files` 或 `zip_file`。
- 新增稳定错误码覆盖缺少 `SKILL.md`、frontmatter 缺失/为空/未关闭、`name` 不合法、`description` 缺失/过长、`SKILL.md` 非 UTF-8 和 zip 不可读。
- 导入 skill 命令在服务端字段错误时冒泡给 `ValidatedForm`，Launchpad 和 Inspector 的文件上传控件会显示错误摘要、字段旁错误和 `aria-invalid`。
- 新增 API 红绿测试覆盖 folder frontmatter 缺少 `description` 和 zip 不可读；新增 E2E 覆盖不合法 folder bundle 的错误摘要和上传字段回填。
- 修复本地 `uv` cache 权限对一键启动和 Playwright webServer 的影响：`scripts/dev.sh` 与 E2E API webServer 默认使用 `UV_NO_CACHE=1`。
- README、API contract、产品体验评审、完成度审计、摩擦审计和 TASK-053 任务记录已更新。
- 已验证：红灯 API 先失败于缺少 `field_errors`；红灯 E2E 先失败于 `.formErrorSummary` 缺失；绿色后目标 API 2 passed、目标 E2E 1 passed；`UV_NO_CACHE=1 uv run pytest` 98 passed；`npm run test:unit` 4 files/15 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`npm run e2e` 65 passed；`git diff --check` passed；任务 JSON 结构检查 passed；关键文件行数 809/1740/119/40/61/73/28/38/31。

### 2026-05-14 04:17 CST - TASK-052 基础格式校验第一阶段

- 新增 `docs/superpowers/specs/2026-05-14-format-validation-design.md` 和执行计划，记录 GOV.UK Error Summary、MDN 表单校验和标准 Skill bundle name 规则对本轮格式校验的适配。
- 后端新增 `SkillSlug`、`TagValue` 和 `TagsPayload` Pydantic 类型，复用到 create skill、update skill、import skill 和 create variant payload。
- `request_validation_field_errors` 会把 `tags[0]` 这类 item 错误回填到顶层 `tags` 字段，并为 slug/tag pattern、长度和空列表输出稳定中文文案。
- 新增 API 红绿测试覆盖非法 Skill ID、非法 tag 和空 tags；新增 E2E 覆盖 Launchpad 非法 Skill ID 的错误摘要、summary focus 和 `aria-invalid`。
- README、API contract、产品体验评审、完成度审计、摩擦审计和 TASK-052 任务记录已更新。
- 已验证：红灯 API 先失败于非法 slug/tag 能创建成功、空 tags 文案太泛；红灯 E2E 先失败于非法 Skill ID 后没有 `.formErrorSummary`；绿色后目标 API 3 passed、目标 E2E 1 passed；拆分表单错误 E2E 后定点 15 passed；`npm run test:unit` 4 files/15 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`uv run pytest` 96 passed；`npm run e2e` 64 passed；`git diff --check` passed；任务 JSON 结构检查 passed；关键文件行数 761/1692/242/82/52/27。

### 2026-05-14 03:58 CST - TASK-051 后端字段错误映射第一阶段

- 新增 `docs/superpowers/specs/2026-05-14-api-field-errors-design.md` 和执行计划，记录 RFC 9457、JSON:API error object、FastAPI exception handler 与 GOV.UK/MOJ 表单错误实践的 SkillHub 适配方案。
- 后端新增 `FieldError` / `FieldInvariantError`，`POST /api/skills`、`PATCH /api/skills/{skill_id}` 和导入 skill 的 slug 冲突会保留 `detail` 并返回 `field_errors`；FastAPI 请求体校验错误也会映射为字段错误数组。
- 前端新增 `ApiError` / `ApiFieldError`，`apiSend/apiGet` 不再只抛普通 `Error`；`ValidatedForm` 捕获服务端字段错误后按控件 `name` 显示 summary、字段旁错误和 `aria-invalid`。
- 新建 skill / 编辑 skill 命令在字段错误时冒泡给表单，其他命令仍保留全局 notice 失败反馈。
- README、API contract、产品体验评审、完成度审计、摩擦审计和 TASK-051 任务记录已更新。
- 已验证：红灯 API 先失败于缺少 `field_errors` 和更新 slug 冲突 500；红灯 E2E 先失败于重复 Skill ID 后没有 `.formErrorSummary`；绿色后目标 API 3 passed、目标 E2E 1 passed；`npm run test:unit` 4 files/15 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`uv run pytest` 93 passed；`npm run e2e` 63 passed；`git diff --check` passed；任务 JSON 结构检查 passed；关键文件行数 37/57/182/24/300/58/37。

### 2026-05-14 03:41 CST - TASK-050 表单验证错误摘要第一阶段

- 新增 `docs/superpowers/specs/2026-05-14-form-validation-summary-design.md` 和执行计划，记录借鉴 GOV.UK、MOJ、Vercel 和 MDN 表单验证实践后的 SkillHub 适配方案。
- 新增 `ValidatedForm`，在 submit 时做 required 字段校验，展示 `formErrorSummary`，把焦点移到摘要，并让摘要链接回具体字段。
- `WorkbenchField` 接入表单验证 context，字段旁显示和摘要一致的错误文案，并自动设置 `aria-invalid` / `aria-describedby`。
- `SkillLaunchpad`、`WorkbenchInspector` 写入表单和 `QuickAddCases` 单条快速添加接入 `ValidatedForm`；批量 case 行级错误和后端字段错误映射留给下一轮。
- README、产品体验评审、完成度审计、摩擦审计和 TASK-050 任务记录已更新。
- 已验证：红灯 unit 先失败于 `form-validation` 模块缺失；红灯 E2E 先失败于 `.formErrorSummary` 缺失；绿色后目标 E2E 2 passed；`npm run test:unit` 3 files/14 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`uv run pytest` 90 passed；`npm run e2e` 62 passed；`git diff --check` passed；任务 JSON 结构检查 passed；关键文件行数 142/162/96/283/122。

### 2026-05-14 03:31 CST - TASK-049 Command menu 第二阶段

- 新增 `docs/superpowers/specs/2026-05-14-command-menu-second-stage-design.md` 和执行计划，记录借鉴 GitHub Command Palette、VS Code context key 和 Raycast command metadata 后的 SkillHub 适配方案。
- 抽出 `command-menu-types.ts`，新增 command `preview` 元数据；新增 `command-menu-recents.ts`，负责本地最近命令记录、去重、限长和排序。
- `buildWorkbenchCommands` 新增 selected case/run 感知命令：可从菜单直接打开当前 case 历史，或把当前 run 设置为 comparison baseline/candidate。
- `CommandMenu` 接入最近使用排序和右侧 preview 面板；preview 不进入 Tab 序列，保留原有 dialog、combobox、listbox 和 Tab trap 模型。
- `DecisionWorkbench` 传入当前 case/run selection；README、产品体验评审、完成度审计、摩擦审计和 TASK-049 任务记录已更新。
- 已验证：红灯 unit 先失败于 recents helper 和 selection commands 缺失；红灯 E2E 先失败于 `.commandMenuPreview` 缺失；绿色后目标 E2E 3 passed；`npm run test:unit` 2 files/11 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`uv run pytest` 90 passed；`npm run e2e` 60 passed；`git diff --check` passed；任务 JSON 结构检查 passed；关键文件行数 258/66/36/184。

### 2026-05-14 03:25 CST - TASK-048 表单字段基础件第二阶段

- 新增 `docs/superpowers/specs/2026-05-14-form-field-foundation-stage-2-design.md` 和执行计划，记录 Vercel、GOV.UK、USWDS、Material 表单实践对 SkillHub 的适配方案。
- `WorkbenchField` 系列新增字段级 `error`、`aria-invalid`、错误文案 `aria-describedby` 绑定，以及 `CheckboxField`，为后续统一错误展示留接口。
- 迁移 `QuickAddCases`、`EvalCaseDetailPanel`、`SkillSettingsPanel`、`SkillAccessPanel`、`SkillGovernancePanel`、`SavedRunViews`、`RunMatrixPanel` 和 `WorkbenchDiffPane` 的剩余表单/筛选控件；业务 text/textarea 字段继续默认 `autocomplete="off"`。
- 抽出 `HistoryRunFiltersBar`，让 `WorkbenchHistoryPane` 从 300 行降到 256 行，避免 history 主 pane 继续膨胀。
- 新增 E2E 红绿覆盖剩余表单共享字段语义和 explicit autocomplete；更新 README、产品体验评审、完成度审计、摩擦审计和 TASK-048 任务记录。
- 已验证：红灯 E2E 先失败于 `quick_title` 缺少 autocomplete/shared field shell；绿色后目标 E2E 1 passed；`accessibility-workbench.spec.ts` 11 passed；`npm run typecheck` passed；`npm run test:unit` 1 file/6 tests passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`uv run pytest` 90 passed；`npm run e2e` 59 passed；`git diff --check` passed；任务 JSON 结构检查 passed；关键文件行数 256/69/155。

### 2026-05-14 02:43 CST - TASK-047 URL State 第二阶段

- 新增 `docs/superpowers/specs/2026-05-14-url-state-second-stage-design.md` 和执行计划，记录 Vercel URL-as-state、Next.js search params 和 MDN History API 对 SkillHub 的适配方案。
- 新增 `apps/web/lib/workbench-url-state.ts`，集中处理 `/skills` query parse/serialize，server page 和 client workbench 复用同一契约。
- URL 现在可恢复 diff pair/file/filter、eval target/case、history filters、selected run、run comparison、matrix controls、audit filters 和 promotion review context；非当前 mode 的深层参数会从 URL 中清理。
- `DecisionWorkbench` 增加 URL hydrate gate；`popstate` 同 skill 时立即应用 deep state，不再被同步 effect 推回旧 state。
- Diff pair 和 Promotion review 改为 state-driven effects，按钮点击、URL hydrate 和 Back/Forward 复用同一加载路径。
- 新增 E2E 红绿覆盖 evals/diff/history/promotion deep link 和刷新恢复；更新 README、产品体验评审、完成度审计、摩擦审计和 TASK-047 任务记录。
- 已验证：红灯 E2E 先失败于缺少 `eval_target` 与 `promotion` URL params；绿色后 `url-state.spec.ts` 4 passed；`npm run test:unit` 1 file/6 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`uv run pytest` 90 passed；`npm run e2e` 58 passed；`git diff --check` passed；任务 JSON 结构检查 passed。

### 2026-05-14 02:27 CST - TASK-046 Diff / Promotion review 文件 viewed progress

- 新增 `docs/superpowers/specs/2026-05-14-diff-review-progress-design.md` 和执行计划，记录借鉴 GitHub/GitLab file viewed progress 后的会话级适配方案。
- 新增 `useFileReviewProgress`，按 diff pair key 维护 viewed file set；切换 diff pair 时自动重置，避免把旧版本对比的查看状态带到新对比。
- Diff mode summary 增加 `Reviewed x/y`，文件 rail 显示 `已查看/未看`，当前文件 header 可勾选 `已查看此文件`。
- Promotion review 的 bundle diff header 增加 `x/y reviewed`，文件 rail 和代码面板复用同一进度逻辑。
- 新增 E2E 红绿覆盖 diff 页和 promotion review 的 reviewed progress；更新 README、产品体验评审、完成度审计、摩擦审计和 TASK-046 任务记录。
- 已验证：红灯 E2E 先失败于缺少 reviewed progress；绿色后目标 E2E 2 passed；promotion review 视觉基线因预期 UI 变化更新；`npm run test:unit` 1 file/6 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`uv run pytest` 90 passed；`npm run e2e` 56 passed；`git diff --check` passed；任务 JSON 结构检查 passed。

### 2026-05-14 02:14 CST - TASK-045 Command menu 当前 mode 上下文化排序

- 新增 `docs/superpowers/specs/2026-05-14-command-menu-contextual-priority-design.md` 和执行计划，记录借鉴 Linear、GitHub Command Palette 和 GitKraken Command Palette 后的 mode-aware 排序方案。
- `buildWorkbenchCommands` 增加 `currentMode`，空 skill 优先导入/新建，`evals` 优先 run/case，`variants` 优先 variant/version/diff，其余命令稳定保留原相对顺序。
- `DecisionWorkbench` 将当前 mode 传入 `useWorkbenchCommands`；`CommandMenu` 弹层、ARIA、搜索、Tab trap 和 disabled 下沉逻辑保持不变。
- 新增 Vitest 红绿覆盖 evals/variants/empty skill 排序；新增 E2E 覆盖测评页打开 command menu 时第一条是 `记录本次测评`。
- 更新 README、产品体验评审、完成度审计、摩擦审计和 TASK-045 任务记录；下一轮队列前移到 Diff/Promotion reviewed progress、URL state 第二阶段、表单字段第二阶段、Command menu 第二阶段。
- 已验证：红灯单测先失败于静态顺序；红灯 E2E 先失败于第一项为 `打开概览`；绿色后目标 E2E 1 passed；`npm run test:unit` 1 file/6 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`uv run pytest` 90 passed；`npm run e2e` 56 passed。

### 2026-05-14 02:01 CST - TASK-044 表单字段基础件第一阶段

- 新增 `WorkbenchField` 系列：`TextField`、`TextAreaField`、`SelectField`、`FileField`，统一 label/hint/aria-describedby，并让业务 text/textarea 默认 `autocomplete="off"`。
- 迁移 `SkillLaunchpad` 与 `WorkbenchInspector` 高频写入表单，保留原 FormData name 和提交逻辑；checkbox 与其他低频表单留到第二阶段。
- 将 command menu、search box、inline case form、inspector form 的局部焦点样式收敛到 `:focus-visible`。
- 新增 accessibility E2E，红灯先失败于 Launchpad `owner_ref` 缺少 autocomplete；绿色后覆盖 Launchpad 和 Inspector autocomplete，以及 inspector 焦点交接/可见焦点。
- 更新 README、产品体验评审、完成度审计、摩擦审计和 TASK-044 规格/计划；下一轮队列前移到 Command menu 上下文化、Diff/Promotion reviewed progress、URL state 第二阶段、表单字段第二阶段。
- 已验证：红灯测试先失败于 Launchpad `owner_ref` 缺少 autocomplete；绿色目标用例 1 passed；回归子集 2 passed；视觉基线更新子集 2 passed；`npm run test:unit` 1 file/3 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`uv run pytest` 90 passed；`npm run e2e` 55 passed。

### 2026-05-14 01:48 CST - TASK-043 Audit Explorer 扫读重构

- 新增 `docs/superpowers/specs/2026-05-14-audit-explorer-scan-design.md` 和执行计划，记录借鉴 Linear audit log、GitHub audit log、Stripe request logs 和 Vercel Web Interface Guidelines 后的适配方案。
- 扩展 `operator can filter skill audit events in the explorer` E2E，红灯先失败于缺少 `role.assigned` quick filter；绿色后覆盖 action quick filter、可读事件标题、actor、payload 摘要、结构化详情和默认折叠的 Raw payload。
- `SkillAuditExplorer` 增加 action chips、readable timeline、`aria-pressed` selected event、结构化 detail facts/key-value fields，并把 Raw JSON 收进 native `details`。
- 更新 Audit Explorer CSS 和视觉基线；视觉测试 helper 将 volatile resource id/time 替换为稳定占位，避免截图因随机 skill id 和时间抖动。
- 更新 README、产品体验评审、完成度审计和摩擦审计；下一轮队列移到表单字段组件化、command menu 上下文化、diff/promotion reviewed progress、URL state 第二阶段和组织级 audit。
- 已验证：`skills-workbench.spec.ts -g "operator can filter skill audit events in the explorer"` 1 passed；`visual-workbench.spec.ts -g "visual baseline: skill audit explorer" --update-snapshots` 1 passed；`npm run test:unit` 1 file/3 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`uv run pytest` 90 passed；`npm run e2e` 54 passed。

### 2026-05-14 01:31 CST - TASK-042 URL State 同步第一阶段

- 新增 `apps/web/e2e/url-state.spec.ts`，红绿覆盖 `/skills?skill=<slug>&mode=history` 直达、刷新恢复、用户切换 mode 后 URL 同步，以及浏览器 Back 恢复历史 tab。
- `/skills` 服务端读取 `searchParams`，按 skill id/slug 选择初始 skill，并只接受第一阶段 shareable modes。
- `DecisionWorkbench` 用 History API 同步 selected skill 和 mode，并监听 `popstate` 支持浏览器 Back/Forward 恢复。
- 更新 README、产品体验评审、完成度审计和 TASK-042 规格/计划；下一轮 URL state 重点是 diff pair、history filters、selected run/case、run comparison、eval target version 和 promotion context。
- 已验证：红灯测试先失败于 URL state 被忽略；绿色后 `url-state.spec.ts` 2 passed；`npm run test:unit` 1 file/3 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`uv run pytest` 90 passed；`npm run e2e` 54 passed；`git diff --check` passed；任务 JSON 结构检查 passed。

### 2026-05-14 01:18 CST - TASK-041 证据视图 Inspector 响应式折叠

- 新增 `apps/web/e2e/responsive-inspector.spec.ts`，用红绿测试覆盖 1280px 下 overview 保持完整 inspector，而 history 证据视图收成 compact verification rail。
- `DecisionWorkbench` 增加 `data-inspector-layout="full|compact"`；`diff/history/audit/promotion` 在 1041-1440px 下使用 `292px / 1fr / 96px` 布局，隐藏 inspector 低频 action，只保留验证状态。
- 更新 promotion review、run comparison、audit explorer 三张视觉基线，并人工查看确认主证据区放宽、不空白、不重叠。
- 更新 README、产品体验评审、完成度审计和 TASK-041 规格/计划；下一轮优先级前移到 URL state 深链。
- 已验证：红灯测试先失败于 history inspector width 336.734375；绿色后 `responsive-inspector.spec.ts` 1 passed；`npm run test:unit` 1 file/3 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`uv run pytest` 90 passed；`npm run e2e` 52 passed；`git diff --check` passed。

### 2026-05-14 01:09 CST - TASK-040 移动端 First-Run Inspector 去重

- 新增 `apps/web/e2e/mobile-first-run.spec.ts`，用红绿测试覆盖移动端空工作台默认折叠 inspector action 区，并验证 catalog 显式触发后表单展开且焦点进入 `owner_ref`。
- `DecisionWorkbench` 增加 `data-first-run` 和 `data-action-requested` 标记；窄屏 first-run 初始态隐藏 inspector `.actionMenu` 与 `.inspectorForm`，保留 `Verification` 和 `Local session` 状态。
- 抽取 E2E `clearSkillCatalog` helper，避免 skills/visual/mobile specs 各自维护清理逻辑。
- 更新 mobile empty 视觉基线、README、产品体验评审、完成度审计和 TASK-040 规格/计划。
- 已验证：红灯测试先失败于 inspector `.inspectorForm` 可见；绿色后 `mobile-first-run.spec.ts` 1 passed；mobile empty snapshot 已更新并人工查看；`npm run test:unit` 1 file/3 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`uv run pytest` 90 passed；`npm run e2e` 51 passed；`git diff --check` passed。

### 2026-05-14 01:00 CST - TASK-039 产品操作摩擦审计

- 新增 `docs/product-ux-friction-audit-2026-05-14.md`，把视觉截图、E2E 覆盖、源码行号和外部产品准则合并成当前操作摩擦审计。
- 参考 Vercel Web Interface Guidelines、NN/g heuristics、Linear command menu、GitHub PR review 和 Microsoft menu guidelines，按 P1/P2/P3 标出移动端 first-run 重复入口、固定三栏证据视图偏窄、URL state、Audit Explorer、表单/focus、command menu 上下文化和 diff reviewed progress 等问题。
- 更新 `docs/product-ux-review.md` 的剩余摩擦和下一轮优化队列，下一轮优先 TASK-040 移动端 first-run/inspector 去重。
- 已验证：`npm run test:unit` 1 file/3 tests passed；`npm run typecheck` passed；`npm run build` passed；`npm audit --omit=dev` found 0 vulnerabilities；`uv run pytest` 90 passed；`npm run e2e` 50 passed；`git diff --check` passed。

### 2026-05-14 00:51 CST - TASK-038 Workbench Command 单元测试

- 引入最小 Vitest 单元测试 runner，新增 `npm run test:unit` 和 node 环境 `vitest.config.ts`，并排除 Playwright E2E spec。
- 新增纯 `buildWorkbenchCommands`，`useWorkbenchCommands` 只负责 `useMemo` 包装，命令配置可单元测试。
- 新增 command config 单元测试，覆盖 14 个命令的顺序、关键文案/分组/快捷键、空 skill/无 case/不可 diff 禁用原因和回调派发。
- 升级 Next.js 到 `15.5.18`，`npm audit --omit=dev` 已清零；README 验证命令加入 `npm run test:unit` 和 `npm audit --omit=dev`。
- 已验证：红灯测试缺少 `./workbench-command-config` 时失败；`npm run test:unit` 1 file/3 tests passed；`npm run typecheck` passed；`npm run build` passed；`uv run pytest` 90 passed；`npm run e2e` 50 passed；`git diff --check` passed。

### 2026-05-14 00:41 CST - TASK-037 Workbench Command 配置抽离

- 新增 `useWorkbenchCommands`，把 command menu 的导航、创建、测评和证据命令配置从 `DecisionWorkbench` 抽离。
- 主工作台继续持有 mode、Inspector action、diff 和业务状态；新 hook 只接收必要状态与回调并返回 `CommandMenuItem[]`。
- 保留命令 id、标题、分组、详情文案、快捷键、禁用态、禁用原因和执行行为。
- 主文件从 1519 行降到 1486 行，新 command hook 67 行。
- 已验证：`npm run typecheck` passed；`npm run build` passed；`uv run pytest` 90 passed；`npm run e2e` 50 passed；`git diff --check` passed。

### 2026-05-14 00:36 CST - TASK-036 Workbench Variants Pane 组件抽离

- 新增 `WorkbenchVariantsPane`，把变体页 toolbar、创建 composer、版本 composer、variant map cards 和 version rows 从 `DecisionWorkbench` 抽离。
- 主工作台继续持有 API mutation、mode 切换、diff 编排和 promotion review 编排；变体页只负责展示和本页局部派生状态。
- 保留 CSS class、文案、链接、按钮禁用逻辑、Current 标记和设为当前版本评审入口。
- 主文件从 1609 行降到 1519 行，新 Variants 文件 104 行。
- 已验证：`npm run typecheck` passed；`npm run build` passed；`uv run pytest` 90 passed；`npm run e2e` 50 passed；`git diff --check` passed。

### 2026-05-14 00:30 CST - TASK-035 Workbench Diff Pane 组件抽离

- 新增 `WorkbenchDiffPane`，把版本差异页的 version selectors、summary metrics、filter bar、file rail、binary notice 和 line-level diff 从 `DecisionWorkbench` 抽离。
- 导出 `DiffFilter`，主工作台继续持有筛选状态和 bundle diff API 编排；`defaultDiffPair` 保留在主工作台。
- 保留 CSS class、文案、filter values、promotion review 入口和 diff 显示行为。
- 主文件从 1814 行降到 1609 行，新 Diff 文件 215 行。
- 已验证：`npm run typecheck` passed；`npm run build` passed；`uv run pytest` 90 passed；`npm run e2e` 50 passed；`git diff --check` passed。

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
