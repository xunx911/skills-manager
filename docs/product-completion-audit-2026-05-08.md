# SkillHub 产品完成度审计

日期：2026-05-10

状态：尚未达到“成熟产品完成”。当前已经是一个强的正式垂直切片：标准 Skill bundle 导入、variant/version、candidate verification handoff、eval set version、manual eval review queue、历史查看、run-to-run comparison、accepted verification、bundle diff、candidate promotion review、上下文命令菜单和快速添加 case 都能闭环。但距离成熟产品还缺少更完整的权限、多用户协作、自动测评策略和更深的可访问性验证。

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
| 新建 skill | `POST /api/skills`；右侧 inspector `新建 skill`；键盘 smoke 能打开入口。 | 基础完成 |
| 新建 variant | `POST /api/variants`；E2E 创建 `Strict reviewer`。 | 完成 |
| 追加 candidate version | `POST /api/variant-versions` 支持 `make_current=false`；E2E 创建候选版本并保持 current 不变。 | 完成 |
| Candidate 验证交接 | E2E 覆盖追加 candidate 后自动切到测评页、自动选择新版本、清空旧草稿，并从 banner 进入 promotion review。 | 完成 |
| Eval case 新增 | `POST /api/eval-cases`；E2E `addEvalCase`。 | 完成 |
| Eval case 批量新增 | `POST /api/eval-cases/batch`；Repository/API 测试验证一次批量只生成一个 `EvalSetVersion`；E2E 覆盖批量粘贴后记录 run。 | 完成 |
| Eval case 编辑/版本化 | `PATCH /api/eval-cases/{case_id}`；E2E 覆盖编辑；后端测试验证生成新 eval set snapshot。 | 完成 |
| Eval case 归档 | `DELETE /api/eval-cases/{case_id}`；E2E 覆盖归档。 | 完成 |
| 手工 pass/fail eval | E2E 覆盖 current 和 candidate version 的手工测评；后端测试覆盖 exact binding。 | 完成 |
| 手工测评执行队列 | E2E 覆盖未确认筛选、结果后自动前进、未确认批量标为通过、键盘 `p/f` 连续确认。 | 完成 |
| Exact version binding | schema、repository、domain tests 约束同 skill 的 `VariantVersion + EvalSetVersion`；候选版本可在 promotion 前测评。 | 完成 |
| Active hub 隐藏 archived skill | Repository `list_skills` 过滤 active；API 测试覆盖 archived skill 不再出现在列表。 | 完成 |
| Skill bundle 文件可见 | Overview 显示文件列表和 `SKILL.md`；visual snapshot 覆盖导入后视图。 | 完成 |
| Bundle diff | `GET /api/artifacts/diff`；前端 diff mode 有文件 rail、筛选和行级 diff；E2E 覆盖版本比较。 | 完成 |
| Promotion review read model | `GET /api/variants/{variant_id}/promotion-review`；API contract 已记录；前端新增 `PromotionReviewPane`。 | 完成 |
| Promotion command | `POST /api/variants/promotions` 要求 evidence run，写入 `promotion_decisions` 和 `audit_events`；API/Repository 测试覆盖。 | 完成 |
| 无风险 promotion | E2E `operator can review a candidate version before promoting it` 覆盖修复 case 后直接设为 current。 | 完成 |
| 风险 promotion | E2E `risky promotion requires a decision note before promoting` 覆盖回退时必须填写说明。 | 完成 |
| Diff 区域 promotion 入口 | `DiffPane` 对 current -> candidate 提供 `设为当前版本评审`；E2E happy path 从 diff 入口进入评审。 | 完成 |
| Run history | `GET /api/skills/{skill_id}/eval-runs`；前端 history mode 可过滤并查看 case result；E2E 覆盖。 | 完成 |
| Run-to-run comparison | `GET /api/eval-runs/compare` 只允许同 `EvalSetVersion` 的 finished run 比较；History mode 可选择对照/候选并查看 delta、修复/回退。 | 完成 |
| Accepted verification | `POST /api/eval-runs/accepted-verifications` 写入 `(variant_id, eval_set_version_id)` 指针和 audit event；History row 显示 `Accepted`。 | 完成 |
| 上下文命令菜单 | `Cmd/Ctrl+K` 和可见按钮可打开命令菜单；E2E 覆盖搜索 `添加 case` 并跳转表单。 | 完成 |
| Case version history | `GET /api/eval-cases/{case_id}/versions`；E2E 覆盖 inline history。 | 完成 |
| 视觉回归 | `apps/web/e2e/visual-workbench.spec.ts` 覆盖 empty、imported overview、manual eval、promotion review、mobile empty。 | 完成 |
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
- Playwright E2E：22 passed。
- API pytest：71 passed。

本轮新增视觉资产：

- `apps/web/e2e/visual-workbench.spec.ts-snapshots/empty-skill-workbench-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/imported-skill-overview-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/manual-eval-review-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/promotion-review-ready-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/run-comparison-ready-chromium-darwin.png`
- `apps/web/e2e/visual-workbench.spec.ts-snapshots/mobile-empty-workbench-chromium-darwin.png`
- `.agent/screenshots/promotion-review-ready-2026-05-10.png`
- `.agent/screenshots/TASK-007-1.png`
- `.agent/screenshots/TASK-008-1.png`

## 仍然阻塞“成熟产品完成”的风险

1. **权限和多用户协作还没实现。** 当前仍是单用户工作台；没有 owner/maintainer/evaluator/viewer 的 scoped role enforcement。
2. **部分操作仍偏表单。** case 新增、记录 run 和 candidate 验证已进入主内容区连续流，但导入后引导还可以更连续。
3. **自动测评策略还没产品化。** 当前支持手工 pass/fail 和外部结果导入，但还没有内置 strategy registry、runner 调度和自动优化流水线。
4. **Run matrix / saved view 还没做。** 现在能比较两次 run，但不能把筛选保存成团队视图，也没有 case × variant/version 的多维矩阵。
5. **Case restore 还没做。** 可以查看 case 历史，但不能从旧版本一键生成恢复版本。
6. **Accessibility 覆盖还浅。** 有键盘 smoke 和可见 label，但缺少系统化 focus order、screen reader、reduced-motion 验证。
7. **Ralph Loop 未真正持续运行。** 配置已安装，但本地 Docker Sandboxes 需要 `sbx login` 授权；没有登录就不能让 Ralph 持续接管任务。

## 下一步建议

不要把总目标标记为完成。

下一轮最有价值的方向：

1. 把导入后引导做成更短路径，减少用户在 inspector、测评页、历史页之间来回跳转。
2. 开始权限模型和 scoped role assignment，尤其是 accepted verification / promotion 权限。
3. 做 run matrix / saved view，让团队能查询更多维度的测评证据。
4. 把 eval strategy / runner registry 产品化。
5. 系统补 accessibility 和可用性测试。
