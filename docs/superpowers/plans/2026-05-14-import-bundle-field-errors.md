# 导入 bundle 字段错误映射第一阶段 Implementation Plan

**Goal:** 让标准 Skill bundle 导入过程中的 `SKILL.md`、frontmatter 和 zip 解析错误通过 `field_errors` 回填到文件上传控件。

## Steps

- [x] **Step 1: 任务登记和红测**
  - 新增 `.agent/tasks/TASK-053.json` 并登记到 `.agent/tasks.json`。
  - API 测试覆盖 folder 导入缺少 `description` 的 frontmatter。
  - API 测试覆盖不可读取 zip。
  - E2E 测试覆盖不合法 folder bundle 的错误摘要和 `folder_files` 字段状态。

- [x] **Step 2: 后端字段错误映射**
  - 在 `POST /api/skill-imports` 捕获 bundle parser 的 `InvariantError`。
  - 根据 `source.kind` 映射到 `folder_files` 或 `zip_file`。
  - 保留历史兼容的 `detail`，并返回稳定中文 `message` 和机器可读 `code`。

- [x] **Step 3: 前端错误冒泡**
  - 导入 skill 的 `runCommand` 使用 `rethrowFieldErrors`，让 `ValidatedForm` 接管字段错误。
  - 复用现有 `FileField` 的 `error`、`aria-invalid` 和摘要链接聚焦行为。

- [x] **Step 4: 文档与验证**
  - 更新 README、API contract、产品体验评审、完成度审计、摩擦审计、任务日志和本任务规格。
  - 运行 API、unit、typecheck、build、audit、E2E、diff check 和 JSON 校验。

## Rollback

如果某类 parser 错误被误判到错误字段，先保留 `field_errors` 契约和前端冒泡行为，只调整 `skill_import_field_error` 的字段或错误码映射。不要回退 TASK-050 到 TASK-052 已建立的通用表单错误路径。
