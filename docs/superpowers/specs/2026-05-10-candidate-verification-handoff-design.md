# 候选版本验证交接设计

日期：2026-05-10

## 背景

当前 SkillHub 已经能创建 candidate `VariantVersion`、选择候选版本手工测评、再进入 promotion review。但用户路径仍有断点：追加候选版本后页面停在 inspector 表单，用户必须自己切到 `测评`、打开目标版本下拉、找到候选版本，再记录 run。这个过程模型正确，但不像成熟发布/预览工具。

本轮目标是把“追加候选版本 -> 测评候选版本 -> 进入设为当前版本评审”串成连续路径，不改变后端事实模型。

## 调研结论

- Vercel 的 preview promotion 工作流强调先找到 preview deployment、inspect、test、check logs，然后 promote。适配到 SkillHub：候选版本创建后应该立即进入“验证候选”的上下文，而不是让用户自己重新定位。参考：<https://vercel.com/docs/deployments/promote-preview-to-production>
- Vercel 的 deployment promotion 明确区分 staged、promoted、current。适配到 SkillHub：非 current `VariantVersion` 应该在 UI 上保持 candidate/staged 语义，promotion 只是移动 current 指针。参考：<https://vercel.com/docs/deployments/promoting-a-deployment>
- Netlify Deploy Preview 会在 PR 上暴露 preview 状态和 URL，让团队先体验变化再发布。适配到 SkillHub：候选版本在测评页应有可见 banner，说明当前正在测 candidate，而不是 current。参考：<https://docs.netlify.com/deploy/deploy-types/deploy-previews/>

## 产品设计

### 追加版本后的交接

当用户在 `追加版本` 表单中取消 `设为 current` 并提交：

1. 创建新的不可变 `VariantVersion`。
2. 自动切到 `测评` tab。
3. 自动选择刚创建的 candidate 作为 `测评目标版本`。
4. 清空本地 pass/fail 草稿，避免把 current 版本的手工结果误用到 candidate。
5. 显示成功提示：`Variant 版本已创建。已切到候选 vN 测评。`

如果用户选择 `设为 current`，保持原行为：创建版本并刷新当前 skill，不强行切换工作流。

### Candidate banner

当 `测评目标版本` 是非 current 版本时，在测评目标条下显示 `candidateVerificationBanner`：

- 显示当前 candidate 的 `variant label`、`vN`、`change_summary`。
- 文案明确：测评结果会绑定到这个 exact candidate version。
- 提供 `进入设为当前版本评审` 按钮，直接打开 promotion review。
- 如果还没记录 candidate run，promotion review 页面会显示证据不足；如果已经记录 run，则显示 readiness、case impact 和 diff。

### 目标版本切换

用户手动切换 `测评目标版本` 时，也清空本地 pass/fail 草稿。原因：草稿只属于当前 target version；跨版本复用草稿容易制造虚假测评。

## 数据设计

不新增 API，不改 schema。

- `POST /api/variant-versions` 已返回 `variant_version_id` 和 `version_number`。
- 前端用返回值设置 `evalTargetVersionId`。
- `EvalRun` 仍只在用户点击 `记录本次测评` 后通过现有 `POST /api/eval-runs` 落库。
- Promotion review 仍使用现有 `GET /api/variants/{variant_id}/promotion-review?candidate_version_id=...`。

## 前端设计

新增组件：

```text
apps/web/components/eval-cases/candidate-verification-banner.tsx
```

职责：

- 只负责展示 candidate 上下文和评审入口。
- 接收 `variant`、`version`、`onPromotionReview`。
- 不知道 API，不管理全局状态。

修改 `DecisionWorkbench`：

- `createVariantVersion` 读取 `CreateVariantVersionResult`。
- 当 `make_current=false` 时调用 `selectEvalTargetVersion(result.variant_version_id)`，切换 `mode="evals"` 和 `actionMode="run"`。
- 新增 `selectEvalTargetVersion(versionId)`，统一处理目标切换和草稿清空。
- `EvalsPane` 计算当前 target option；如果不是 current，渲染 candidate banner。

## 验收标准

1. E2E 覆盖：追加 candidate version 后自动进入 `测评` tab，目标版本选中 `v2 · candidate`。
2. E2E 覆盖：candidate banner 可见，并显示 `进入设为当前版本评审`。
3. E2E 覆盖：给 candidate 记录 run 后，从 banner 进入 promotion review，看到 readiness。
4. 切换测评目标版本会清空本地草稿；不能复用旧版本的 pass/fail。
5. 原有 version compare、promotion happy path、risky path、manual eval queue 不回归。

## 非目标

- 不做后端 draft session。
- 不新增 preview/candidate 状态表。
- 不改变 promotion command。
- 不做权限控制。
- 不做自动测评 runner。
