# Saved run view 保存对照/候选指针计划

## 目标

让 History mode 的命名 saved view 既能恢复筛选和矩阵展示偏好，也能恢复 run comparison 的 `对照` / `候选` 指针。

## 步骤

1. 写红灯测试
   - API saved view 测试期望 config 保留 `compare_baseline_run_id` / `compare_candidate_run_id`。
   - Repository 测试期望 normalizer 保留这两个字段。
   - E2E saved view 测试期望应用视图后恢复对照/候选按钮和 comparison panel。

2. 实现后端契约
   - saved view config allowlist 增加两个 comparison key。

3. 实现前端应用
   - `SavedView["config"]` 类型增加两个 key。
   - 保存视图时写入当前 compare run ids。
   - 应用视图时恢复或清空 compare run ids。
   - 手动切换对照/候选时回到 `adhoc`。

4. 文档和任务记录
   - 更新 README、产品 UX 复盘、完成度审计和摩擦审计。
   - 新增 TASK-072 记录。

5. 验证
   - 目标 API。
   - 目标 E2E。
   - 完整 API、Web unit、build、typecheck、audit、E2E。
   - `git diff --check` 和任务 JSON 检查。
