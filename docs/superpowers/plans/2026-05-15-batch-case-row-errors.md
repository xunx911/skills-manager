# 批量 case 行级错误第一阶段 Implementation Plan

**Goal:** 批量粘贴 eval case 时，把无效行显示为可修正的行级错误，并阻止静默跳过后提交。

## Steps

- [x] **Step 1: 任务登记和红测**
  - 新增 `.agent/tasks/TASK-054.json` 并登记到 `.agent/tasks.json`。
  - Unit 测试覆盖 parser 返回 `invalidRows`。
  - E2E 覆盖有无效行时错误摘要聚焦、textarea `aria-invalid` 和不创建部分 case。

- [x] **Step 2: 抽离 parser**
  - 新增 `quick-add-cases-parser.ts`。
  - 保留 `|` 和 tab 分隔。
  - 输出有效 drafts、无效行明细和无效计数。

- [x] **Step 3: 接入表单错误**
  - `ValidatedForm` 增加可选 `validate(form)` 扩展点。
  - 批量 case 表单改用 `ValidatedForm`。
  - 无效行回填到 `batch_cases` textarea，并展示前三条行级错误。

- [x] **Step 4: 文档与验证**
  - 更新 README、产品体验评审、完成度审计、摩擦审计、任务日志和本任务规格。
  - 运行 unit、typecheck、build、audit、E2E、diff check 和 JSON 校验。

## Rollback

如果行级校验误伤合法粘贴格式，先放宽 `parseBatchCases` 的分隔和缺字段判断，保留 `ValidatedForm.validate` 扩展点和错误摘要体验。
