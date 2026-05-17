# Run matrix CSV 导出计划

## 目标

让 History mode 的 Run matrix 可以导出当前视图 CSV，补齐“查看证据 -> 带出证据”的基本闭环。

## 步骤

1. 写红灯测试
   - 新增 `run-matrix-export` 单元测试，先失败于 helper 不存在。
   - 扩展 Run matrix E2E，先失败于找不到 `Export CSV`。

2. 实现导出
   - 新增 `apps/web/components/run-matrix/run-matrix-export.ts`。
   - 从矩阵数据、可见 rows、可见列配置生成 CSV。
   - 提供浏览器下载函数。
   - 在 `RunMatrixPanel` 控件区加入 `Export CSV` 按钮。

3. 文档和任务记录
   - 更新 README 的 History/Run matrix 说明。
   - 更新产品 UX 复盘和完成度审计。
   - 新增 TASK-071 任务记录并标记验证结果。

4. 验证
   - 目标单元测试。
   - 目标 E2E。
   - 完整 API 测试。
   - 完整 Web unit、build、typecheck、audit、E2E。
   - `git diff --check` 和任务 JSON 检查。
