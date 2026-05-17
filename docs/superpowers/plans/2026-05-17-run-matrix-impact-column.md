# Run Matrix Impact 列配置实现计划

> **给执行代理：** 使用 `superpowers:test-driven-development`。先写失败测试，再实现最小代码。

**目标：** 为 Run matrix 增加 `Impact column` 显示开关，并把这个列配置保存到 URL state 和 saved run views。

**架构：** 扩展现有 `RunMatrixControls`，不改 matrix API 数据结构。前端根据控制项决定是否渲染 Impact 列；URL state、saved view config 和后端 saved view allowlist 同步新增 `matrix_show_impact`。

**技术栈：** React、Next.js、Playwright、FastAPI saved view config。

---

### 任务 1：红绿测试

**文件：**
- 修改：`apps/web/e2e/skills-workbench.spec.ts`
- 修改：`apps/web/e2e/url-state.spec.ts`
- 修改：`apps/api/tests/test_api_commands.py`

- [x] **Step 1: 写 run matrix E2E 红测**
  - 在 `operator can inspect run matrix across eval runs` 中断言存在 `Impact column` checkbox。
  - 取消勾选后，`Impact` column header 不存在，`.runMatrixImpactCell` 为 0，`aria-colcount` 从 4 变为 3。

- [x] **Step 2: 写 URL state 红测**
  - 在 history URL state 测试中取消 `Impact column`。
  - 断言 URL 包含 `matrix_impact_column=false`。
  - 刷新后 checkbox 仍未选中。

- [x] **Step 3: 写 saved view API 红测**
  - 在 saved view config 测试中加入 `matrix_show_impact: "false"`。
  - 断言 create/list 保留该 key。

- [x] **Step 4: 跑红灯**
  - `cd apps/web && npm run e2e -- skills-workbench.spec.ts -g "run matrix"`
  - `cd apps/web && npm run e2e -- url-state.spec.ts -g "history comparison"`
  - `cd apps/api && UV_NO_CACHE=1 uv run pytest tests/test_api_commands.py -k "saved_run_view_endpoints"`

### 任务 2：实现

**文件：**
- 修改：`apps/web/components/run-matrix/run-matrix-panel.tsx`
- 修改：`apps/web/lib/workbench-url-state.ts`
- 修改：`apps/web/lib/types.ts`
- 修改：`apps/web/components/decision-workbench.tsx`
- 修改：`apps/api/skillhub/infrastructure/db/repositories.py`

- [x] **Step 1: 扩展控制类型和默认值**
  - `RunMatrixControls` 增加 `matrix_show_impact`。
  - 默认值为 `"true"`。

- [x] **Step 2: 渲染 Impact column checkbox**
  - 增加 `CheckboxField`，label 为 `Impact column`。
  - `RunMatrixPanel` 根据控制项计算 `showImpact`。

- [x] **Step 3: 条件渲染列**
  - `showImpact=false` 时隐藏 Impact 表头和单元格。
  - 更新 `aria-colcount`、run column `aria-colindex` 和 group row `colSpan`。

- [x] **Step 4: 同步 URL 和 saved views**
  - URL 参数为 `matrix_impact_column=false`。
  - saved view config 支持 `matrix_show_impact`。
  - 应用 saved view 后恢复 checkbox 状态。

- [x] **Step 5: 跑绿色目标测试**
  - 重跑任务 1 的目标测试。

### 任务 3：文档和完整验证

**文件：**
- 修改：`README.md`
- 修改：`docs/product-ux-review.md`
- 修改：`docs/product-ux-friction-audit-2026-05-14.md`
- 修改：`docs/product-completion-audit-2026-05-08.md`
- 新建：`.agent/tasks/TASK-070.json`
- 修改：`.agent/tasks.json`
- 修改：`.agent/logs/LOG.md`

- [x] **Step 1: 更新中文文档**
  - 记录 run matrix 已完成第一条列配置。
  - 下一轮仍保留自定义指标和导出。

- [x] **Step 2: 视觉基线**
  - 如果默认可见的 `Impact column` checkbox 改变视觉截图，更新对应视觉基线。

- [x] **Step 3: 完整验证**
  - `cd apps/api && UV_NO_CACHE=1 uv run pytest`
  - `cd apps/web && npm run test:unit`
  - `cd apps/web && npm run typecheck`
  - `cd apps/web && npm run build`
  - `cd apps/web && npm audit --omit=dev`
  - `cd apps/web && npm run e2e`
  - `git diff --check`
  - `jq empty .agent/tasks.json .agent/tasks/TASK-070.json`
