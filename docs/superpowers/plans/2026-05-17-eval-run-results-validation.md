# EvalRun Results 精确字段校验实现计划

> **给执行代理：** 使用 `superpowers:test-driven-development`。先写失败测试，再实现最小代码。

**目标：** `POST /api/eval-runs` 的 `results` 必须完整、精确匹配目标 `EvalSetVersion` 的 case versions；缺失和多余 key 都返回机器可读 `field_errors`。

**架构：** 在 `SqlSkillRepository.record_eval_run` 读取目标 eval set case versions 后、计算 summary 前做结果 key 校验。API 继续复用 `FieldInvariantError -> detail + field_errors` 的现有错误响应。

**技术栈：** FastAPI、SQLAlchemy、pytest、Next.js/Playwright 回归。

---

### 任务 1：API / Repository 红绿测试

**文件：**
- 修改：`apps/api/tests/test_api_commands.py`
- 修改：`apps/api/tests/test_sql_repository.py`
- 修改：`apps/api/skillhub/infrastructure/db/repositories.py`

- [x] **Step 1: 写 API 红测**
  - 新增 `test_eval_run_results_must_match_eval_set_version`。
  - 创建包含两条 case 的 eval set version。
  - 只提交其中一条 result，期望 `400`、`field_errors[0].field == results.<missing_case_version_id>`、`code == eval_run.result_required`。
  - 再提交一个未知 result key，期望 `400` 和 `eval_run.result_unexpected`。

- [x] **Step 2: 写 Repository 红测**
  - 新增 `test_record_eval_run_requires_exact_result_keys`。
  - 直接调用 repository，断言缺失和多余 key 都抛 `FieldInvariantError`。

- [x] **Step 3: 跑红灯**
  - `cd apps/api && UV_NO_CACHE=1 uv run pytest tests/test_api_commands.py -k "eval_run_results_must_match_eval_set_version"`
  - `cd apps/api && UV_NO_CACHE=1 uv run pytest tests/test_sql_repository.py -k "record_eval_run_requires_exact_result_keys"`
  - 预期：失败，因为当前实现会把缺失 result 当 `false`，未知 key 会被忽略。

- [x] **Step 4: 实现校验**
  - 在 repository 中增加私有 helper 校验 `results` keys。
  - 缺失 key 返回 `eval_run.result_required`。
  - 多余 key 返回 `eval_run.result_unexpected`。
  - 同时返回全部字段错误，排序稳定。

- [x] **Step 5: 修正旧测试语义**
  - 原本依赖“缺失默认 false”的测试改成显式提交 `false`。
  - 保持 summary 和 case result 断言不变。

- [x] **Step 6: 跑绿色目标测试**
  - 重跑 Step 3 的两个目标测试。
  - 运行 `cd apps/api && UV_NO_CACHE=1 uv run pytest`。

### 任务 2：文档和任务记录

**文件：**
- 修改：`docs/api-contract.md`
- 修改：`README.md`
- 修改：`docs/product-ux-review.md`
- 修改：`docs/product-ux-friction-audit-2026-05-14.md`
- 修改：`docs/product-completion-audit-2026-05-08.md`
- 新建：`.agent/tasks/TASK-069.json`
- 修改：`.agent/tasks.json`
- 修改：`.agent/logs/LOG.md`

- [x] **Step 1: 更新契约文档**
  - `Record Eval Run` 删除“未提供默认 false”。
  - 补充 `results.<case_version_id>` 字段错误。

- [x] **Step 2: 更新中文产品文档**
  - 记录这是表单/字段错误后续的一部分。
  - 明确前端手工测评已有完整提交，本轮是 API 防线。

- [x] **Step 3: 完整验证**
  - `cd apps/api && UV_NO_CACHE=1 uv run pytest`
  - `cd apps/web && npm run test:unit`
  - `cd apps/web && npm run typecheck`
  - `cd apps/web && npm run build`
  - `cd apps/web && npm audit --omit=dev`
  - `cd apps/web && npm run e2e`
  - `git diff --check`
  - `jq empty .agent/tasks.json .agent/tasks/TASK-069.json`
