# SkillHub 产品完成度审计

日期：2026-05-13

状态：尚未达到“成熟产品完成”。当前已经是一个强的正式垂直切片：主工作区 Skill Launchpad、主工作区 Skill 设置、Skill 作用域访问控制、Skill 治理与审计面板、标准 Skill bundle 导入、导入后验证清单、variant/version、candidate verification handoff、eval set version、manual eval review queue、历史查看、run matrix 多维控制、保存历史筛选视图、run-to-run comparison、accepted verification、bundle diff、candidate promotion review、上下文命令菜单和快速添加 case 都能闭环。但距离成熟产品还缺少真实认证、多用户协作、自动测评策略和更深的可访问性验证。

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
| 主工作区 Skill 设置 | `SkillSettingsPanel` 在概览主区编辑 skill ID、owner 和默认分发 variant；`PATCH /api/skills/{skill_id}` 校验 default variant 同 skill；API/E2E 覆盖。 | 完成 |
| Skill 作用域访问控制 | 创建 skill 自动授予 actor `owner`；`GET/POST /api/skills/{skill_id}/role-assignments` 和 `DELETE /api/role-assignments/{id}` 支持查看、授予、撤销角色；概览页 `SkillAccessPanel` 覆盖添加/移除 evaluator。 | 完成 |
| 请求级 ActorContext | Mutation endpoint 从 `X-SkillHub-Actor` 请求头获取本地 actor；前端 `apiSend` 统一发送 header，JSON body 中的 actor 被忽略。 | 完成 |
| Skill 治理与审计 | `GET /api/skills/{skill_id}/audit-events` 和 skill detail 返回最近审计事件；`DELETE /api/skills/{skill_id}` 需要 owner 权限、写入 `skill.archived`；概览页 `SkillGovernancePanel` 展示治理摘要、审计时间线和 slug 确认危险区。 | 完成 |
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
| Promotion review read model | `GET /api/variants/{variant_id}/promotion-review`；API contract 已记录；前端新增 `PromotionReviewPane`。 | 完成 |
| Promotion command | `POST /api/variants/promotions` 要求 evidence run 和 skill `owner/maintainer` 权限，写入 `promotion_decisions` 和 `audit_events`；API/Repository 测试覆盖。 | 完成 |
| 无风险 promotion | E2E `operator can review a candidate version before promoting it` 覆盖修复 case 后直接设为 current。 | 完成 |
| 风险 promotion | E2E `risky promotion requires a decision note before promoting` 覆盖回退时必须填写说明。 | 完成 |
| Diff 区域 promotion 入口 | `DiffPane` 对 current -> candidate 提供 `设为当前版本评审`；E2E happy path 从 diff 入口进入评审。 | 完成 |
| Run history | `GET /api/skills/{skill_id}/eval-runs`；前端 history mode 可过滤并查看 case result；E2E 覆盖。 | 完成 |
| Run matrix | `GET /api/skills/{skill_id}/eval-run-matrix`；History mode 展示 case x run pass/fail 矩阵；选择对照/候选后显示逐 case `修复/回退/稳定/缺失` impact；支持 impact 过滤、按 impact 分组、隐藏 run header 分数；E2E 覆盖多 case、多 run、impact 和矩阵控制。 | 完成 |
| Saved run views | `saved_views` 表；`GET /api/skills/{skill_id}/saved-views`、`POST /api/saved-views`、`DELETE /api/saved-views/{id}`；History mode 可保存、应用、删除当前 run filters 和 matrix 控制项；E2E/API 覆盖。 | 完成 |
| Run-to-run comparison | `GET /api/eval-runs/compare` 只允许同 `EvalSetVersion` 的 finished run 比较；History mode 可选择对照/候选并查看 delta、修复/回退。 | 完成 |
| Accepted verification | `POST /api/eval-runs/accepted-verifications` 要求 skill `owner/maintainer` 权限，写入 `(variant_id, eval_set_version_id)` 指针和 audit event；History row 显示 `Accepted`。 | 完成 |
| 上下文命令菜单 | `Cmd/Ctrl+K` 和可见按钮可打开命令菜单；E2E 覆盖搜索 `添加 case` 并跳转表单。 | 完成 |
| Case version history | `GET /api/eval-cases/{case_id}/versions`；E2E 覆盖 inline history。 | 完成 |
| Case restore | `POST /api/eval-cases/{case_id}/restores`；E2E 覆盖从旧 case version 恢复为新的当前版本；后端测试覆盖跨 case source 拒绝和 archived case 拒绝。 | 完成 |
| 视觉回归 | `apps/web/e2e/visual-workbench.spec.ts` 覆盖 empty launchpad、imported overview、manual eval、skill access panel、skill governance panel、promotion review、run comparison、mobile empty。 | 完成 |
| README | README 已用中文补充一键启动、验证命令、标准 bundle、manual eval 和 promotion 流程。 | 完成 |
| UX 复盘 | `docs/product-ux-review.md` 已更新，说明借鉴模式、已解决摩擦和下一轮优化。 | 完成 |

## 本轮真实验证记录

已执行并通过：

```bash
cd apps/api && uv run pytest
cd apps/web && npm run typecheck
cd apps/web && npm run build
cd apps/web && npm run e2e
```

结果：

- Web typecheck：通过。
- Web production build：通过。
- Playwright E2E：37 passed。
- API pytest：87 passed。

本轮新增视觉资产：

- `apps/web/e2e/visual-workbench.spec.ts-snapshots/empty-skill-workbench-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/imported-skill-overview-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/manual-eval-review-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/variants-workspace-composers-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/skill-access-panel-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/skill-governance-panel-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/promotion-review-ready-chromium-darwin.png`
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

1. **真实认证和多用户协作还没实现。** 当前已有 skill 作用域 owner/maintainer/evaluator/viewer、受保护动作门禁和请求级 ActorContext，但 actor 仍是本地开发 header，不是真正的服务端 session/token。
2. **部分操作仍偏表单。** 导入后清单、case 新增、case 详情内联编辑、主区创建 variant、主区追加候选版本、主区创建 skill、主区 skill 设置、访问控制、治理审计、记录 run 和 candidate 验证已更连续，但部分低频设置仍主要依赖 inspector 或尚未产品化。
3. **自动测评策略还没产品化。** 当前支持手工 pass/fail 和外部结果导入，但还没有内置 strategy registry、runner 调度和自动优化流水线。
4. **Run matrix 还不是完整多维表格。** 现在能保存筛选视图、看 case x run pass/fail、高亮对照/候选的修复和回退，并支持 impact 过滤/分组/分数显示控制，但还不能配置列、自定义指标、导出或保存对照/候选 run 指针。
5. **Accessibility 覆盖还浅。** 有键盘 smoke 和可见 label，但缺少系统化 focus order、screen reader、reduced-motion 验证。
6. **Ralph Loop 未真正持续运行。** 配置已安装，但本地 Docker Sandboxes 需要 `sbx login` 授权；没有登录就不能让 Ralph 持续接管任务。

## 下一步建议

不要把总目标标记为完成。

下一轮最有价值的方向：

1. 接入真实认证：actor 从 session/token 来，前端只展示 capability，不再声明本地开发 actor。
2. 把 run matrix 升级为多维表格：支持列配置、更多指标列、导出，并评估是否保存对照/候选 run 指针。
3. 把 audit events 升级为可搜索、可过滤、可导出的审计 explorer。
4. 把 eval strategy / runner registry 产品化。
5. 系统补 accessibility 和可用性测试。
