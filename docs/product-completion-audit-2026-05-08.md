# SkillHub 产品完成度审计

日期：2026-05-14

状态：尚未达到“成熟产品完成”。当前已经是一个强的正式垂直切片：主工作区 Skill Launchpad、移动端 first-run 单主路径、中等桌面证据视图 compact inspector rail、URL state 第二阶段、高频写入表单字段基础件第二阶段、Command menu mode-aware 排序、Diff / Promotion 文件 reviewed progress 第一阶段、主工作区 Skill 设置、Skill 作用域访问控制、本地 session actor、基础 accessibility 护栏、Workbench mode tablist、Inspector action 焦点交接、Skill 治理与审计面板、Skill 审计 Explorer quick filters/readable timeline/structured detail、标准 Skill bundle 导入、导入后验证清单、variant/version、candidate verification handoff、eval set version、manual eval review queue、历史查看、run matrix 多维控制与表格语义、保存历史筛选视图、run-to-run comparison、accepted verification、bundle diff、candidate promotion review、上下文命令菜单 ARIA 和快速添加 case 都能闭环。但距离成熟产品还缺少真实认证、多用户协作、自动测评策略和更深的可访问性验证。

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
| 本地 session ActorContext | Mutation endpoint 优先从签名 `skillhub_actor` HttpOnly cookie 获取本地 actor，前端 `apiSend/apiGet` 统一带 credentials，不再硬编码 actor header；直接 API 调用仍可用 `X-SkillHub-Actor` fallback，JSON body 中的 actor 被忽略。 | 完成 |
| Skill 治理与审计 | `GET /api/skills/{skill_id}/audit-events` 和 skill detail 返回最近审计事件；`DELETE /api/skills/{skill_id}` 需要 owner 权限、写入 `skill.archived`；概览页 `SkillGovernancePanel` 展示治理摘要、审计时间线和 slug 确认危险区。 | 完成 |
| Skill 审计 Explorer | `GET /api/skills/{skill_id}/audit-events` 支持 actor/action/resource_type filters，并纳入当前 skill 关联的 variant/eval_run audit events；前端 `SkillAuditExplorer` 支持 action quick filters、可读时间线、结构化详情和默认折叠的 Raw payload。 | 完成 |
| Local session 面板 | 右侧 inspector 显示当前本地 actor，可切换为 `release-manager` 等身份；E2E 覆盖切换后导入 skill，owner role 来自 session actor；视觉回归覆盖 session 面板。 | 完成 |
| Accessibility 基础护栏 | `AppShell` 提供 skip link；全局 `:focus-visible` 使用高对比双层 ring；`prefers-reduced-motion` 压低非必要 transition；`linearNotice` 使用 `role=status`；E2E 覆盖四条回归。 | 完成 |
| 高频表单字段基础件 | `WorkbenchField` 系列统一 Launchpad、Inspector、QuickAddCases、EvalCaseDetailPanel、SkillSettingsPanel、SkillAccessPanel、SkillGovernancePanel、SavedRunViews、history filters、run matrix controls 和 diff selectors 的 label、hint、error、`aria-describedby`、业务字段 `autocomplete="off"` 和局部 `:focus-visible`；E2E 覆盖主要表单字段语义。 | 完成第二阶段 |
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
| Eval case 新增 | `POST /api/eval-cases`；E2E `addEvalCase`。 | 完成 |
| Eval case 批量新增 | `POST /api/eval-cases/batch`；Repository/API 测试验证一次批量只生成一个 `EvalSetVersion`；E2E 覆盖批量粘贴后记录 run。 | 完成 |
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
| 风险 promotion | E2E `risky promotion requires a decision note before promoting` 覆盖回退时必须填写说明。 | 完成 |
| Diff 区域 promotion 入口 | `DiffPane` 对 current -> candidate 提供 `设为当前版本评审`；E2E happy path 从 diff 入口进入评审。 | 完成 |
| Run history | `GET /api/skills/{skill_id}/eval-runs`；前端 history mode 可过滤并查看 case result；E2E 覆盖。 | 完成 |
| Run matrix | `GET /api/skills/{skill_id}/eval-run-matrix`；History mode 展示 case x run pass/fail 矩阵；选择对照/候选后显示逐 case `修复/回退/稳定/缺失` impact；支持 impact 过滤、按 impact 分组、隐藏 run header 分数；E2E 覆盖多 case、多 run、impact 和矩阵控制。 | 完成 |
| Run matrix 表格语义 | `RunMatrixPanel` 使用命名原生 table、caption、列/行 header、row/col count 和完整 cell aria-label；E2E 覆盖 table/header/cell role 查询。 | 完成 |
| Saved run views | `saved_views` 表；`GET /api/skills/{skill_id}/saved-views`、`POST /api/saved-views`、`DELETE /api/saved-views/{id}`；History mode 可保存、应用、删除当前 run filters 和 matrix 控制项；E2E/API 覆盖。 | 完成 |
| Run-to-run comparison | `GET /api/eval-runs/compare` 只允许同 `EvalSetVersion` 的 finished run 比较；History mode 可选择对照/候选并查看 delta、修复/回退。 | 完成 |
| Accepted verification | `POST /api/eval-runs/accepted-verifications` 要求 skill `owner/maintainer` 权限，写入 `(variant_id, eval_set_version_id)` 指针和 audit event；History row 显示 `Accepted`。 | 完成 |
| 上下文命令菜单 | `Cmd/Ctrl+K` 和可见按钮可打开命令菜单；E2E 覆盖搜索 `添加 case` 并跳转表单。`buildWorkbenchCommands` 已按 current mode 排序，空 skill 优先导入/新建，测评页优先 run/case，变体页优先 variant/version/diff；Vitest/E2E 覆盖。 | 完成第一阶段 |
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
jq empty .agent/tasks.json .agent/tasks/TASK-048.json
```

结果：

- Web unit：1 file / 6 tests passed。
- Web typecheck：通过。
- Web production build：通过。
- Web audit：0 vulnerabilities。
- Playwright E2E：59 passed。
- API pytest：90 passed。
- `git diff --check`：通过。
- `.agent/tasks.json` 和 `.agent/tasks/TASK-048.json` JSON 结构检查：通过。

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

1. **真实认证和多用户协作还没实现。** 当前已有 skill 作用域 owner/maintainer/evaluator/viewer、受保护动作门禁和签名本地 actor session，但它仍是开发期身份切换，不是真正的登录、token rotation 或组织级身份系统。
2. **部分操作仍偏表单。** 移动端 first-run 已去掉重复入口，中等桌面证据视图已把 inspector 收成 verification rail；Launchpad/Inspector 高频写入字段已有共享基础件；Command menu 已按当前 mode 把高频动作前置；导入后清单、case 新增、case 详情内联编辑、主区创建 variant、主区追加候选版本、主区创建 skill、主区 skill 设置、访问控制、治理审计、记录 run 和 candidate 验证已更连续，但部分低频设置和筛选控件仍主要依赖局部表单或尚未产品化。
3. **自动测评策略还没产品化。** 当前支持手工 pass/fail 和外部结果导入，但还没有内置 strategy registry、runner 调度和自动优化流水线。
4. **URL sharing 还有协作层缺口。** 深层证据上下文已进 URL，但还没有短链接、权限感知分享提示，也没有草稿恢复策略。
5. **Run matrix 还不是完整多维表格。** 现在能保存筛选视图、看 case x run pass/fail、高亮对照/候选的修复和回退，并支持 impact 过滤/分组/分数显示控制，但还不能配置列、自定义指标、导出或保存对照/候选 run 指针。
6. **Accessibility 深水区还没完整覆盖。** 已有 skip link、可见 focus ring、reduced-motion、status notice、command menu ARIA、Workbench mode tablist、Run matrix table semantics 和 Inspector action focus handoff 回归，但更广的全路径焦点巡检和人工读屏验收仍未完成。
7. **Ralph Loop 未真正持续运行。** 配置已安装，但本地 Docker Sandboxes 需要 `sbx login` 授权；没有登录就不能让 Ralph 持续接管任务。

## 下一步建议

不要把总目标标记为完成。

下一轮最有价值的方向：

1. 接入真实认证：用真实登录 session/token 替换本地 actor cookie，前端只展示 capability，不再自由切换开发身份。
2. 做 Command menu 第二阶段：最近使用、selection-aware 命令和命令 preview。
3. 把 run matrix 升级为多维表格：支持列配置、更多指标列、导出，并评估是否保存对照/候选 run 指针。
4. 把 audit events 升级为跨 skill/组织级查询、可导出、可配置保留策略的审计系统。
5. 把 eval strategy / runner registry 产品化。
6. 继续补 accessibility：更广的全路径焦点巡检、表单错误 summary 和人工读屏验收。
