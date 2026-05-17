# Saved run view 保存对照/候选指针设计

## 背景

History mode 已经支持保存 run filters 和 Run matrix 展示偏好，但 `对照` / `候选` run 仍只存在于当前 URL state 和页面状态里。用户保存一个用于复盘的视图后，再次应用该视图还需要重新点两条 run，比较上下文没有真正被保存下来。

## 用户目标

用户选择两条 run 作为 `对照` / `候选`，调整矩阵视图后保存为命名视图。之后应用该视图时，页面应恢复同一组筛选、矩阵偏好和同一对 run comparison 指针，并自动显示对应比较结果。

## 范围

- saved view config 新增 `compare_baseline_run_id`。
- saved view config 新增 `compare_candidate_run_id`。
- 保存视图时写入当前 `对照` / `候选` run id。
- 应用视图时恢复 `对照` / `候选` run id。
- 用户手动更改对照/候选后，当前 saved view 状态回到 `adhoc`。
- 继续复用现有 URL state：URL 已经支持 `compare_base` 和 `compare_candidate`，本任务不新增 URL 参数。

## 非范围

- 不新增 saved view schema 表结构。
- 不校验 run id 是否仍属于当前筛选；现有可见 run 清理逻辑继续负责失效状态。
- 不保存 run comparison 结果快照；比较结果仍实时读取后端。
- 不做 saved view 分享权限提示。

## 验收

- API saved view round trip 保留 `compare_baseline_run_id` 和 `compare_candidate_run_id`。
- 前端应用 saved view 后恢复对照/候选按钮状态，并显示对应 run comparison。
- 更改对照/候选后，saved view 下拉回到临时视图。
- 完整回归继续覆盖 API、unit、build、typecheck、audit、E2E 和 diff check。
