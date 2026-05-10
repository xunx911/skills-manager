# 手工测评执行队列设计

日期：2026-05-10

## 背景

当前 SkillHub 已经能记录 `EvalRun = exact VariantVersion + exact EvalSetVersion`，但测评页仍偏“表单确认”：用户逐条找到 case，再点通过/不通过，全部确认后才能记录 run。这个闭环是正确的，但操作感还不像成熟测试/评审工具。

本轮目标是把手工测评改成更顺手的执行队列：用户可以快速定位未确认 case，标记一个后自然进入下一个，必要时批量处理剩余项，同时保持 pass/fail 模型简单。

## 调研结论

- TestRail 的提交结果路径包括 status dropdown、三栏视图 `Add Result`、`Pass & Next`、批量提交和详情页提交。适配到 SkillHub：测评页应该同时支持单条确认、自动进入下一条和批量处理未确认项。参考：<https://support.testrail.com/hc/en-us/articles/15813183376148-Submitting-test-results>
- TestRail 的快捷键覆盖“下一条/上一条/通过当前项/打开结果”等高频操作。适配到 SkillHub：键盘快捷操作应该存在，但不需要把页面塞满说明文字。参考：<https://support.testrail.com/hc/en-us/articles/7076852613652-Keyboard-shortcuts-hotkeys>
- Airtable 的表格快捷键和筛选动作强调在大量记录里快速移动、筛选、批量处理。适配到 SkillHub：case 列表需要状态筛选，而不是只显示完整列表。参考：<https://support.airtable.com/docs/airtable-keyboard-shortcuts>

## 产品设计

在 `测评` 页把现有确认区升级为 `Review queue`：

1. **状态筛选**：提供 `全部`、`未确认`、`通过`、`不通过` 四个 filter chip，显示各自数量。默认 `全部`。
2. **自动前进**：点击某个 case 的 `通过` 或 `不通过` 后，如果后面还有未确认 case，自动选中下一条未确认 case。这样可以连续执行，不用每次重新找位置。
3. **下一条未确认**：提供一个轻量按钮，直接跳到第一条未确认 case。用户中途切走后可以快速回到剩余工作。
4. **批量处理未确认**：提供 `未确认标为通过`，只处理当前没有草稿结果的 case，不覆盖已经标记为不通过的风险项。
5. **清空草稿**：提供 `清空草稿`，只清除本地尚未提交的 pass/fail 草稿，不影响已落库的历史 run。
6. **键盘执行**：当焦点不在输入框/文本域/select 中时，支持：
   - `j` / `ArrowDown`：下一条 case
   - `k` / `ArrowUp`：上一条 case
   - `p`：当前 case 标为通过，并跳到下一条未确认
   - `f`：当前 case 标为不通过，并跳到下一条未确认

不新增结果状态。第一阶段仍只有通过/不通过；blocked、retest、comments、attachments 留给自动测评策略和更完整 result schema。

## 数据设计

本轮不改后端 schema，不新增 API。所有新增能力都是 `EvalRun` 提交前的本地草稿交互：

- `caseResults[case_version_id] = true | false | null`
- `recordEvalRun()` 仍要求当前 `EvalSetVersion` 的所有 case 都已确认。
- 记录 run 后仍通过现有 `POST /api/eval-runs` 落库。

这样可以避免把“执行中的临时状态”和“已经完成的测评事实”混在一起。

## 前端设计

新增 `apps/web/components/eval-cases/eval-review-controls.tsx`：

- 负责进度条、筛选 chips、批量按钮和记录 run 按钮。
- 不接触 API，只接收 stats 和 command props。
- 控制按钮 disabled 逻辑，避免在没有 case 或 busy 时误操作。

修改 `DecisionWorkbench` 的 `EvalsPane`：

- 增加本地 `reviewFilter`。
- 计算 `visibleCases`、`selectedIndex`、`nextPendingCase`。
- 点击 pass/fail 后调用 `onToggle` 并自动选择下一条未确认。
- 增加 `onMarkPendingPassed` 和 `onClearDraft`。
- 增加键盘事件监听；输入控件中不触发快捷键。

## 验收标准

1. E2E 覆盖：批量添加三条 case，筛选 `未确认`，点击第一条通过后自动选中下一条；再点击 `未确认标为通过` 后可以直接记录 run。
2. E2E 覆盖：键盘 `p` / `f` 可以连续标记当前 case，并能记录一次 pass/fail 混合 run。
3. 原有手工测评、批量 case、新增/编辑/归档 case、promotion 和 run comparison 流程不回归。
4. `npm run typecheck`、`npm run build`、`npm run e2e`、`uv run pytest` 全部通过。
5. README 和 UX 审计记录本轮借鉴来源、能力变化和仍未解决的摩擦。

## 非目标

- 不做后端草稿会话。
- 不新增第三种测评结果状态。
- 不做 comments、attachments、defect linking。
- 不做 run matrix / saved view。
- 不做权限控制。
