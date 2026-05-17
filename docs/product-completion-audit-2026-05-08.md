# SkillHub 产品完成度审计

日期：2026-05-17

状态：尚未达到“成熟产品完成”。当前已经是一个强的正式垂直切片：主工作区 Skill Launchpad、移动端 first-run 单主路径、中等桌面证据视图 compact inspector rail、URL state 第二阶段、高频写入表单字段基础件第二阶段、表单验证错误摘要、表单错误摘要统计、低频长文本字符计数、后端字段错误映射、基础格式校验第一阶段、导入 bundle 字段错误映射第一阶段、批量 case 行级错误第一阶段、服务端批量 case 字段错误契约、eval case 文本长度校验、批量 case 导入预览表、批量 case 预览移动端护栏、保存视图名称字段级校验、accepted verification note 字段级校验、promotion decision note 字段级校验、Variant 写入字段校验、Skill capabilities 权限感知、本地登录门禁第一阶段、身份引用字段格式校验第一阶段、Command menu 第二阶段、Diff / Promotion 文件 reviewed progress 第一阶段、主工作区 Skill 设置、Skill 作用域访问控制、本地 session actor、基础 accessibility 护栏、Workbench mode tablist、Inspector action 焦点交接、Skill 治理与审计面板、Skill 审计 Explorer quick filters/readable timeline/structured detail、标准 Skill bundle 导入、导入后验证清单、variant/version、candidate verification handoff、eval set version、manual eval review queue、历史查看、run matrix 多维控制与表格语义、保存历史筛选视图、run-to-run comparison、accepted verification、bundle diff、candidate promotion review、上下文命令菜单 ARIA 和快速添加 case 都能闭环。但距离成熟产品还缺少真实认证、多用户协作、自动测评策略和更深的可访问性验证。

## 目标拆解

项目目标可以拆成以下成功标准：

1. 一键本地启动，并且不污染全局 Python 环境。
2. 前端不是原型堆叠表单，而是有清晰信息架构、布局、字体、颜色、交互反馈和视觉回归保护的产品工作台。
3. 支持标准 Skill 文件夹和 zip 导入。
4. 支持 skill、variant、variant version 的核心创建与维护。
5. 支持 eval case 的新增、编辑成新版本、归档。
6. 支持手工实验：每个 case 只需要确认通过或不通过，并持久化为 exact eval run。
7. 支持对候选 `VariantVersion` 单独测评，而不是只能测 current。
8. 支持 promotion review：用户在设为 current 前看到文件 diff、逐 case 修复/回退、readiness 和风险说明。
9. 版本模型严谨：`Skill -> Variant -> VariantVersion`，共享 versioned eval set，`EvalRun = VariantVersion + EvalSetVersion`。
10. README 和文档说明如何运行、如何验证、如何走完整产品流程。
11. 每次推送前跑完整后端测试、前端类型检查、前端构建、前端 E2E。
12. 重要 UI 变化有视觉基线或截图，避免无声退化。
13. 重大 UX 改动前要参考优秀产品模式，并说明如何适配 SkillHub。

## Prompt-To-Artifact Checklist

| 要求 | 当前证据 | 状态 |
| --- | --- | --- |
| 一键启动 | `scripts/dev.sh` 启动 FastAPI 和 Next.js，创建 `.data`，README 记录 `bash scripts/dev.sh`。 | 完成 |
| 不污染全局 Python | `scripts/dev.sh` 使用 `uv run`；README 明确说明不会写入全局 Python 环境。 | 完成 |
| 标准 folder import | `POST /api/skill-imports`；E2E 覆盖 folder import；API 测试覆盖 SKILL.md frontmatter。 | 完成 |
| 标准 zip import | E2E `operator can import a zipped standard skill bundle`；API 测试覆盖 zip contract。 | 完成 |
| 导入后验证引导 | E2E `imported skill is guided into its first verification run` 覆盖导入后清单、添加首条 case、自动进入测评、记录 run 和查看历史。 | 完成 |
| 新建 skill | `POST /api/skills`；右侧 inspector `新建 skill`；键盘 smoke 能打开入口。 | 完成 |
| 主工作区 Skill Launchpad | 空工作台主内容区可直接导入 folder/zip 标准 Skill bundle 或创建空白 skill；E2E 覆盖两条 first-run 路径。 | 完成 |
| 移动端 first-run 单主路径 | 移动端空工作台默认折叠 inspector action menu/form，只保留主区 Launchpad；E2E 覆盖初始折叠和显式 catalog action 展开并接收焦点，视觉基线覆盖 mobile empty。 | 完成 |
| 证据视图 Inspector rail | 1041-1440px 下 diff/history/audit/promotion 使用 compact verification rail；E2E 覆盖 overview/full 与 history/compact 的宽度变化；视觉基线覆盖 promotion、run comparison 和 audit explorer。 | 完成 |
| 主工作区 Skill 设置 | `SkillSettingsPanel` 在概览主区编辑 skill ID、owner 和默认分发 variant；`PATCH /api/skills/{skill_id}` 校验 default variant 同 skill；API/E2E 覆盖。 | 完成 |
| Skill 作用域访问控制 | 创建 skill 自动授予 actor `owner`；`GET/POST /api/skills/{skill_id}/role-assignments` 和 `DELETE /api/role-assignments/{id}` 支持查看、授予、撤销角色；概览页 `SkillAccessPanel` 覆盖添加/移除 evaluator。 | 完成 |
| Skill capabilities 权限感知 | `GET /api/skills/{skill_id}/capabilities` 返回当前 actor roles 和 `role.manage / variant.promote / verification.accept`；前端访问控制、变体、差异、评审和历史比较入口按 capability 展示角色、禁用态和原因；E2E 覆盖 viewer 无法管理角色或进入设为当前版本评审。 | 完成第一阶段 |
| 本地 session ActorContext | Mutation endpoint 优先从签名 `skillhub_actor` HttpOnly cookie 获取本地 actor，前端 `apiSend/apiGet` 统一带 credentials，不再硬编码 actor header；直接 API 调用仍可用 `X-SkillHub-Actor` fallback，JSON body 中的 actor 被忽略。 | 完成 |
| Skill 治理与审计 | `GET /api/skills/{skill_id}/audit-events` 和 skill detail 返回最近审计事件；`DELETE /api/skills/{skill_id}` 需要 owner 权限、写入 `skill.archived`；概览页 `SkillGovernancePanel` 展示治理摘要、审计时间线和 slug 确认危险区。 | 完成 |
| Skill 审计 Explorer | `GET /api/skills/{skill_id}/audit-events` 支持 actor/action/resource_type filters，并纳入当前 skill 关联的 variant/eval_run audit events；前端 `SkillAuditExplorer` 支持 action quick filters、可读时间线、结构化详情和默认折叠的 Raw payload。 | 完成 |
| Local login 门禁 | 右侧 inspector 显示当前本地 actor，切换为 `release-manager` 等身份时必须填写本地登录码；默认 `skillhub-dev`，可用 `SKILLHUB_LOCAL_SESSION_CODE` 覆盖。E2E 覆盖缺登录码的字段错误，以及登录后导入 skill 的 owner role 来自 session actor；视觉回归覆盖 session 面板。 | 完成第一阶段 |
| Accessibility 基础护栏 | `AppShell` 提供 skip link；全局 `:focus-visible` 使用高对比双层 ring；`prefers-reduced-motion` 压低非必要 transition；`linearNotice` 使用 `role=status`；E2E 覆盖四条回归。 | 完成 |
| 高频表单字段基础件 | `WorkbenchField` 系列统一 Launchpad、Inspector、QuickAddCases、EvalCaseDetailPanel、SkillSettingsPanel、SkillAccessPanel、SkillGovernancePanel、SavedRunViews、history filters、run matrix controls 和 diff selectors 的 label、hint、error、`aria-describedby`、业务字段 `autocomplete="off"` 和局部 `:focus-visible`；`TextAreaField.characterLimit` 会在 1000 字符低频长文本字段上显示剩余/超出字符数，并把计数节点加入 `aria-describedby`；E2E 覆盖主要表单字段语义和字符计数提示。 | 完成低频长文本字符计数 |
| 表单验证与字段错误 | `ValidatedForm` 统一高频写入表单的 required 校验；缺字段时展示 error summary、显示需要修正的字段数量、聚焦 summary、摘要链接回字段，并通过 `WorkbenchField` 显示字段旁错误和 `aria-invalid`；后端保留 `detail` 并返回 `field_errors`，创建/更新 skill 的重复或格式错误 Skill ID 会回填到 `slug` 字段，非法 tag 会回填到 `tags` 字段，非法 `owner_ref` / role `subject_id` 会回填到 `归属` / `成员` 字段，导入 bundle 的 `SKILL.md`、frontmatter 和 zip 解析错误会回填到 `folder_files` 或 `zip_file`；批量 case parser 会返回行级错误并回填到 `batch_cases` 字段，直连批量 API 缺字段会返回 `cases[n].field`；eval case 标题、Input、Expected output 和 Notes 超限会返回字段级错误；variant 名称、说明和版本说明超限会回填到 `label`、`summary` 或 `change_summary`；保存历史视图的空白、重复或超长名称会回填到 `name` 字段；accepted verification note 超过 1000 字符会回填到 `note` 字段；promotion decision note 缺失或超过 1000 字符会回填到 `decision_note` 字段；E2E 覆盖 Launchpad、QuickAddCases、错误摘要数量统计、服务端字段错误、服务端格式错误、bundle frontmatter 错误、主工作区 variant 字段错误、低频身份字段错误、批量 case 行级错误、saved view name 重名错误、accepted verification note 超长错误和 risky promotion decision note 错误，API 覆盖服务端行级字段错误、长度上限、saved view name 字段错误、accepted verification note 字段错误、promotion decision note 字段错误、variant 写入字段错误和 identity ref 字段错误。 | 完成表单错误摘要统计 |
| Command menu ARIA | `CommandMenu` 使用 `role=dialog`、editable `combobox`、`listbox/option`、`aria-activedescendant`、关闭按钮和 Tab trap；E2E 覆盖方向键、弹层内焦点循环和关闭回焦点。 | 完成 |
| Workbench mode tablist | 工作区模式切换使用 `role=tablist/tab/tabpanel`、`aria-selected`、roving `tabIndex` 和 Left/Right/Home/End 键盘导航；E2E 覆盖 tablist 语义和方向键切换。 | 完成 |
| URL state 第一阶段 | `/skills` 服务端读取 `skill` 与 `mode` query；前端 History API 同步 selected skill/mode，并监听 `popstate` 支持 Back/Forward；E2E 覆盖直达、刷新、URL 更新和浏览器历史恢复。 | 完成 |
| URL state 第二阶段 | `parseWorkbenchUrlState/workbenchUrlForState` 统一 query 契约；URL 可恢复 diff pair/file/filter、eval target/case、history filters、selected run、run comparison、matrix controls、audit filters 和 promotion review context；E2E 覆盖刷新恢复。 | 完成 |
| Inspector action 焦点交接 | Catalog button 和 command menu 触发 Inspector action 后，焦点进入对应表单首个可操作控件；E2E 覆盖 `导入 bundle` 和 `添加 case` 两条路径。 | 完成 |
| 新建 variant | `POST /api/variants`；E2E 创建 `Strict reviewer`。 | 完成 |
| 主工作区创建 variant | `VariantCreationComposer` 在 `变体` 主面板直接创建 tags 约束 variant；E2E 覆盖创建后 variant map 出现新卡片和 v1。 | 完成 |
| 追加 candidate version | `POST /api/variant-versions` 支持 `make_current=false`；E2E 创建候选版本并保持 current 不变。 | 完成 |
| 主工作区追加候选版本 | `WorkspaceVersionComposer` 在 `变体` 主面板直接上传标准 Skill bundle；E2E 覆盖保存 candidate 后自动进入候选测评。 | 完成 |
| Candidate 验证交接 | E2E 覆盖追加 candidate 后自动切到测评页、自动选择新版本、清空旧草稿，并从 banner 进入 promotion review。 | 完成 |
| Eval case 新增 | `POST /api/eval-cases`；E2E `addEvalCase`；服务端限制标题 160、Input 20000、Expected output 10000、Notes 2000 字符，超限返回字段错误且不自动截断。 | 完成 |
| Eval case 批量新增 | `POST /api/eval-cases/batch`；Repository/API 测试验证一次批量只生成一个 `EvalSetVersion`；E2E 覆盖批量粘贴后记录 run；批量粘贴会先显示逐行导入预览表，缺字段时会显示行号、阻止部分提交，并标记 `batch_cases` 字段；窄屏下批量输入、统计、预览表和提交按钮纵向排布，页面不横向滚动，表格只在容器内滚动；直连 API 缺字段、空字段或超限时返回 `cases[n].title/input_text/expected_output/notes`，不会写入部分有效 case。 | 完成 |
| Eval case 编辑/版本化 | `PATCH /api/eval-cases/{case_id}`；E2E 覆盖编辑；后端测试验证生成新 eval set snapshot。 | 完成 |
| Eval case 详情内联编辑 | `EvalCaseDetailPanel` 在测评详情中直接编辑 title/input/expected/notes；E2E 覆盖不经过 inspector 的 inline edit 路径。 | 完成 |
| Eval case 归档 | `DELETE /api/eval-cases/{case_id}`；E2E 覆盖归档。 | 完成 |
| 手工 pass/fail eval | E2E 覆盖 current 和 candidate version 的手工测评；后端测试覆盖 exact binding。 | 完成 |
| 手工测评执行队列 | E2E 覆盖未确认筛选、结果后自动前进、未确认批量标为通过、键盘 `p/f` 连续确认。 | 完成 |
| Exact version binding | schema、repository、domain tests 约束同 skill 的 `VariantVersion + EvalSetVersion`；候选版本可在 promotion 前测评。 | 完成 |
| Active hub 隐藏 archived skill | Repository `list_skills` 过滤 active；API 测试覆盖 archived skill 不再出现在列表。 | 完成 |
| Skill bundle 文件可见 | Overview 显示文件列表和 `SKILL.md`；visual snapshot 覆盖导入后视图。 | 完成 |
| Bundle diff | `GET /api/artifacts/diff`；前端 diff mode 有文件 rail、筛选和行级 diff；E2E 覆盖版本比较。 | 完成 |
| Diff / Promotion 文件 reviewed progress | `useFileReviewProgress` 在 diff pair 内维护会话级 viewed file set；Diff mode 显示 `Reviewed x/y`，Promotion review 显示 `x/y reviewed`；E2E 覆盖勾选当前文件后的进度和文件行状态。 | 完成第一阶段 |
| Promotion review read model | `GET /api/variants/{variant_id}/promotion-review`；API contract 已记录；前端新增 `PromotionReviewPane`。 | 完成 |
| Promotion command | `POST /api/variants/promotions` 要求 evidence run 和 skill `owner/maintainer` 权限，写入 `promotion_decisions` 和 `audit_events`；API/Repository 测试覆盖。 | 完成 |
| 无风险 promotion | E2E `operator can review a candidate version before promoting it` 覆盖修复 case 后直接设为 current。 | 完成 |
| 风险 promotion | E2E `risky promotion requires a decision note before promoting` 覆盖回退时必须填写说明；缺失或超过 1000 字符会在 `设为当前版本说明` 上显示字段级错误。 | 完成 |
| Diff 区域 promotion 入口 | `DiffPane` 对 current -> candidate 提供 `设为当前版本评审`；E2E happy path 从 diff 入口进入评审。 | 完成 |
| Run history | `GET /api/skills/{skill_id}/eval-runs`；前端 history mode 可过滤并查看 case result；E2E 覆盖。 | 完成 |
| Run matrix | `GET /api/skills/{skill_id}/eval-run-matrix`；History mode 展示 case x run pass/fail 矩阵；选择对照/候选后显示逐 case `修复/回退/稳定/缺失` impact；支持 impact 过滤、按 impact 分组、隐藏 run header 分数；E2E 覆盖多 case、多 run、impact 和矩阵控制。 | 完成 |
| Run matrix 表格语义 | `RunMatrixPanel` 使用命名原生 table、caption、列/行 header、row/col count 和完整 cell aria-label；E2E 覆盖 table/header/cell role 查询。 | 完成 |
| Saved run views | `saved_views` 表；`GET /api/skills/{skill_id}/saved-views`、`POST /api/saved-views`、`DELETE /api/saved-views/{id}`；History mode 可保存、应用、删除当前 run filters 和 matrix 控制项；保存视图名称限制 1-80 字符，空白、重复或超长会返回字段错误并在前端回填到 `保存视图名称`。 | 完成 |
| Run-to-run comparison | `GET /api/eval-runs/compare` 只允许同 `EvalSetVersion` 的 finished run 比较；History mode 可选择对照/候选并查看 delta、修复/回退。 | 完成 |
| Accepted verification | `POST /api/eval-runs/accepted-verifications` 要求 skill `owner/maintainer` 权限，写入 `(variant_id, eval_set_version_id)` 指针和 audit event；History row 显示 `Accepted`；可选 note 最多 1000 字符，超限会在 run comparison 接受表单回填字段错误。 | 完成 |
| 上下文命令菜单 | `Cmd/Ctrl+K` 和可见按钮可打开命令菜单；E2E 覆盖搜索 `添加 case` 并跳转表单。`buildWorkbenchCommands` 已按 current mode 排序；`CommandMenu` 会记录本地最近 5 个命令；selected case/run 会生成上下文命令；右侧 preview 展示作用对象、scope 和禁用原因；Vitest/E2E 覆盖。 | 完成第二阶段 |
| Case version history | `GET /api/eval-cases/{case_id}/versions`；E2E 覆盖 inline history。 | 完成 |
| Case restore | `POST /api/eval-cases/{case_id}/restores`；E2E 覆盖从旧 case version 恢复为新的当前版本；后端测试覆盖跨 case source 拒绝和 archived case 拒绝。 | 完成 |
| 视觉回归 | `apps/web/e2e/visual-workbench.spec.ts` 覆盖 empty launchpad、imported overview、manual eval、skill access panel、skill governance panel、skill audit explorer、promotion review、run comparison、mobile empty。 | 完成 |
| README | README 已用中文补充一键启动、验证命令、标准 bundle、manual eval 和 promotion 流程。 | 完成 |
| UX 复盘 | `docs/product-ux-review.md` 已更新，说明借鉴模式、已解决摩擦和下一轮优化。 | 完成 |

## 本轮真实验证记录

已执行并通过：

```bash
cd apps/api && uv run pytest
cd apps/web && npm run test:unit
cd apps/web && npm run typecheck
cd apps/web && npm run build
cd apps/web && npm audit --omit=dev
cd apps/web && npm run e2e
git diff --check
jq empty .agent/tasks.json .agent/tasks/TASK-049.json
wc -l apps/web/components/command-menu/command-menu.tsx apps/web/components/command-menu/command-menu-recents.ts apps/web/components/command-menu/command-menu-preview.tsx apps/web/components/command-menu/workbench-command-config.ts
jq empty .agent/tasks.json .agent/tasks/TASK-050.json
wc -l apps/web/components/forms/form-validation.tsx apps/web/components/forms/workbench-field.tsx apps/web/components/skills/skill-launchpad.tsx apps/web/components/inspector/workbench-inspector.tsx apps/web/components/eval-cases/quick-add-cases.tsx
jq empty .agent/tasks.json .agent/tasks/TASK-051.json
wc -l apps/api/skillhub/domain/errors.py apps/web/lib/api-errors.ts apps/web/components/forms/form-validation.tsx apps/web/lib/api-errors.test.ts apps/web/e2e/accessibility-workbench.spec.ts docs/superpowers/specs/2026-05-14-api-field-errors-design.md docs/superpowers/plans/2026-05-14-api-field-errors.md
jq empty .agent/tasks.json .agent/tasks/TASK-052.json
wc -l apps/api/skillhub/api/main.py apps/api/tests/test_api_commands.py apps/web/e2e/accessibility-workbench.spec.ts apps/web/e2e/form-errors.spec.ts docs/superpowers/specs/2026-05-14-format-validation-design.md docs/superpowers/plans/2026-05-14-format-validation.md
```

结果：

- Web unit：4 files / 15 tests passed。
- Web typecheck：通过。
- Web production build：通过。
- Web audit：0 vulnerabilities。
- Playwright E2E：64 passed。
- API pytest：96 passed。
- `git diff --check`：通过。
- `.agent/tasks.json`、`.agent/tasks/TASK-049.json`、`.agent/tasks/TASK-050.json`、`.agent/tasks/TASK-051.json` 和 `.agent/tasks/TASK-052.json` JSON 结构检查：通过。
- 关键 command menu 文件行数：258 / 66 / 36 / 184。
- 关键 form validation 文件行数：182 / 162 / 96 / 283 / 122。
- 关键 API field error 文件行数：37 / 57 / 182 / 24 / 300 / 58 / 37。
- 关键 format validation 文件行数：761 / 1692 / 242 / 82 / 52 / 27；本轮同时把表单错误 E2E 从 accessibility spec 拆出，避免继续推高单文件复杂度。
- TASK-053 增量验证：导入 bundle 字段错误 API 红绿测试通过，`UV_NO_CACHE=1 uv run pytest` 为 98 passed；Web unit 为 4 files / 15 tests passed；typecheck、production build、audit、`npm run e2e` 65 passed、`git diff --check` 和任务 JSON 检查通过；关键文件行数为 809 / 1740 / 119 / 40 / 61 / 73 / 28 / 38 / 31。
- TASK-054 增量验证：批量 case 行级错误 unit 红绿测试通过；目标 E2E 覆盖无效行阻止提交、summary focus、`batch_cases` 的 `aria-invalid` 和不创建部分有效 case；完整验证记录见 `.agent/tasks/TASK-054.json`。
- TASK-055 增量验证：服务端批量 case 字段错误 API 红绿测试覆盖空标题和缺少 Expected output；完整验证记录见 `.agent/tasks/TASK-055.json`。
- TASK-056 增量验证：eval case 文本长度校验 API 红绿测试覆盖单条过长标题、批量过长 Input 和更新版本过长 Expected output；完整验证记录见 `.agent/tasks/TASK-056.json`。
- TASK-057 增量验证：批量 case 导入预览表 unit 红绿测试覆盖 `previewRows`，目标 E2E 覆盖有效/无效行预览和坏行阻止提交；完整验证记录见 `.agent/tasks/TASK-057.json`。
- TASK-058 增量验证：移动端批量 case 预览 E2E 红灯先失败于统计卡仍在 textarea 同行；绿色后覆盖纵向排布、无文档横向滚动和表格内部横向滚动；完整验证记录见 `.agent/tasks/TASK-058.json`。
- TASK-059 增量验证：保存视图名称 API 红灯先失败于重复名缺少 `field_errors`、超长名被接受；E2E 红灯先失败于重复名后没有 `.savedRunViews .formErrorSummary`；完整验证记录见 `.agent/tasks/TASK-059.json`。
- TASK-060 增量验证：accepted verification note API 红灯先失败于 1001 字符 note 返回 200；E2E 红灯先失败于超长 note 后没有 `.runCompareAcceptBar .formErrorSummary`；完整验证记录见 `.agent/tasks/TASK-060.json`。
- TASK-061 增量验证：promotion decision note API 红灯先失败于空 risky note 缺少 `field_errors`；E2E 红灯先失败于 risky promotion 按钮仍 disabled；完整验证记录见 `.agent/tasks/TASK-061.json`。
- TASK-062 增量验证：skill capabilities API 红灯先失败于 endpoint 不存在；E2E 红灯先失败于 viewer 下访问控制没有 `当前角色 Viewer` 且 protected action 未禁用；绿色后目标 API 1 passed、目标 E2E 1 passed、zip/first verification 稳定性回归 2 passed；完整验证为 API 106 passed、Web unit 5 files / 16 tests passed、typecheck/build/audit 通过、Playwright E2E 70 passed、`git diff --check` 和任务 JSON 检查通过；完整验证记录见 `.agent/tasks/TASK-062.json`。
- TASK-063 增量验证：variant 写入字段 API 红灯先失败于过长 variant label 返回 200；E2E 红灯先失败于主工作区 variant 表单没有 `.formErrorSummary`；绿色后目标 API 1 passed、目标 E2E 1 passed；完整验证为 API 107 passed、Web unit 5 files / 16 tests passed、typecheck/build/audit 通过、Playwright E2E 71 passed、`git diff --check` 和任务 JSON 检查通过；完整验证记录见 `.agent/tasks/TASK-063.json`。
- TASK-064 增量验证：本地登录门禁 API 红灯先失败于错误登录码仍能设置 session；E2E 红灯先失败于右侧面板没有本地登录码字段和 `登录 actor` 按钮；绿色后目标 API 3 passed、目标 E2E 2 passed；完整验证为 API 108 passed、Web unit 5 files / 16 tests passed、typecheck/build/audit 通过、Playwright E2E 71 passed、`git diff --check` 和任务 JSON 检查通过；完整验证记录见 `.agent/tasks/TASK-064.json`。
- TASK-065 增量验证：identity ref API 红灯先失败于非法 `owner_ref` 返回 200；E2E 红灯先失败于 skill settings 没有 `.formErrorSummary`；绿色后目标 API 1 passed、目标 E2E 1 passed；完整验证为 API 109 passed、Web unit 5 files / 16 tests passed、typecheck/build/audit 通过、Playwright E2E 72 passed、`git diff --check` 和任务 JSON 检查通过；完整验证记录见 `.agent/tasks/TASK-065.json`。
- TASK-066 增量验证：Launchpad required-fields E2E 红灯先失败于错误摘要缺少数量；绿色后目标 E2E 1 passed；完整验证为 API 109 passed、Web unit 5 files / 16 tests passed、typecheck/build/audit 通过、Playwright E2E 72 passed、`git diff --check` 和任务 JSON 检查通过；完整验证记录见 `.agent/tasks/TASK-066.json`。
- TASK-067 增量验证：低频长文本字符计数 E2E 红灯先失败于 Summary 字段没有剩余字符提示；绿色后目标 E2E 1 passed，`form-errors.spec.ts` 11 passed；完整验证为 API 109 passed、Web unit 5 files / 16 tests passed、typecheck/build/audit 通过、Playwright E2E 73 passed、`git diff --check` 和任务 JSON 检查通过；完整验证记录见 `.agent/tasks/TASK-067.json`。

本轮相关视觉资产：

- `apps/web/e2e/visual-workbench.spec.ts-snapshots/empty-skill-workbench-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/imported-skill-overview-chromium-darwin.png`（TASK-044 更新，反映 Inspector 字段基础件）
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/manual-eval-review-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/variants-workspace-composers-chromium-darwin.png`（TASK-044 更新，反映 Inspector 字段基础件）
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/skill-access-panel-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/local-session-panel-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/skill-governance-panel-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/skill-audit-explorer-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/promotion-review-ready-chromium-darwin.png`（TASK-046 更新，反映 Diff reviewed progress）
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/run-comparison-ready-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/mobile-empty-workbench-chromium-darwin.png`
- `.agent/screenshots/promotion-review-ready-2026-05-10.png`
- `.agent/screenshots/TASK-007-1.png`
- `.agent/screenshots/TASK-008-1.png`
- `.agent/screenshots/TASK-009-1.png`
- `.agent/screenshots/TASK-016-1.png`
- `.agent/screenshots/TASK-017-1.png`
- `.agent/screenshots/TASK-018-1.png`
- `.agent/screenshots/TASK-019-1.png`
- `.agent/screenshots/TASK-020-1.png`

## 仍然阻塞“成熟产品完成”的风险

1. **真实认证和多用户协作还没实现。** 当前已有 skill 作用域 owner/maintainer/evaluator/viewer、受保护动作门禁、后端 capabilities 和带本地登录码的签名 actor session，但它仍是开发期 session gate，不是真正的登录、token rotation 或组织级身份系统。
2. **部分操作仍偏表单。** 移动端 first-run 已去掉重复入口，中等桌面证据视图已把 inspector 收成 verification rail；Launchpad/Inspector 高频写入字段已有共享基础件；Command menu 已按当前 mode、最近使用和当前 selection 把高频动作前置；导入后清单、case 新增、case 详情内联编辑、主区创建 variant、主区追加候选版本、主区创建 skill、主区 skill 设置、访问控制、治理审计、记录 run 和 candidate 验证已更连续，但部分低频设置和筛选控件仍主要依赖局部表单或尚未产品化。
3. **自动测评策略还没产品化。** 当前支持手工 pass/fail 和外部结果导入，但还没有内置 strategy registry、runner 调度和自动优化流水线。
4. **URL sharing 还有协作层缺口。** 深层证据上下文已进 URL，但还没有短链接、权限感知分享提示，也没有草稿恢复策略。
5. **Run matrix 还不是完整多维表格。** 现在能保存筛选视图、看 case x run pass/fail、高亮对照/候选的修复和回退，并支持 impact 过滤/分组/分数显示控制，但还不能配置列、自定义指标、导出或保存对照/候选 run 指针。
6. **Accessibility 深水区还没完整覆盖。** 已有 skip link、可见 focus ring、reduced-motion、status notice、command menu ARIA、Workbench mode tablist、Run matrix table semantics 和 Inspector action focus handoff 回归，但更广的全路径焦点巡检和人工读屏验收仍未完成。
7. **Ralph Loop 未真正持续运行。** 配置已安装，但本地 Docker Sandboxes 需要 `sbx login` 授权；没有登录就不能让 Ralph 持续接管任务。

## 下一步建议

不要把总目标标记为完成。

下一轮最有价值的方向：

1. 接入真实认证：用真实登录 session/token 替换本地登录码和 actor cookie，前端只展示 capability，不再保留开发期身份模拟。
2. 表单验证后续：更多嵌套字段错误回填，以及低频字段的辅助说明。
3. 把 run matrix 升级为多维表格：支持列配置、更多指标列、导出，并评估是否保存对照/候选 run 指针。
4. 把 audit events 升级为跨 skill/组织级查询、可导出、可配置保留策略的审计系统。
5. 把 eval strategy / runner registry 产品化。
6. 继续补 accessibility：更广的全路径焦点巡检、后端错误摘要和人工读屏验收。
