# Identity Field Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `owner_ref` 和 role `subject_id` 增加统一身份引用格式校验，并让概览页低频身份表单展示字段级错误。

**Architecture:** 后端新增共享 `IdentityRef` Pydantic 类型，所有本地身份引用写入路径复用同一 pattern 和 120 字符上限。前端把 `SkillSettingsPanel` 和 `SkillAccessPanel` 从 raw form 迁移到 `ValidatedForm`，API `field_errors` 由表单捕获并回填到具体字段。

**Tech Stack:** FastAPI、Pydantic、pytest、React、Next.js、Playwright。

---

### Task 1: API identity ref validation

**Files:**
- Modify: `apps/api/skillhub/api/main.py`
- Modify: `apps/api/tests/test_api_commands.py`

- [x] **Step 1: 写 API 红测**
  - 新增 `test_identity_ref_fields_reject_invalid_values`。
  - `POST /api/skills` 使用 `owner_ref = "team name"` 应返回 `422`，`field_errors[0].field == "owner_ref"`。
  - `PATCH /api/skills/{skill_id}` 使用 `owner_ref = "platform team"` 应返回 `422`，字段仍为 `owner_ref`。
  - `POST /api/skills/{skill_id}/role-assignments` 使用 `subject_id = "qa reviewer"` 应返回 `422`，`field_errors[0].field == "subject_id"`。

- [x] **Step 2: 跑 API 红灯**
  - Run: `cd apps/api && UV_NO_CACHE=1 uv run pytest tests/test_api_commands.py -k "identity_ref"`
  - Expected: FAIL，因为当前 `owner_ref` 和 `subject_id` 没有 pattern 校验。

- [x] **Step 3: 实现后端校验**
  - 在 `main.py` 常量区新增：
    - `IDENTITY_REF_PATTERN = r"^[A-Za-z0-9._@-]{1,120}$"`
    - `IdentityRef = Annotated[str, Field(min_length=1, max_length=120, pattern=IDENTITY_REF_PATTERN)]`
  - 把 `CreateSkillPayload.owner_ref`、`ImportSkillPayload.owner_ref`、`UpdateSkillPayload.owner_ref` 和 `AssignSkillRolePayload.subject_id` 改成 `IdentityRef`。
  - `API_FIELD_LABELS` 增加 `"subject_id": "成员"`。
  - `request_validation_message` 对 `owner_ref` / `subject_id` 的 `string_pattern_mismatch`、`string_too_long`、`string_too_short` 返回中文规则文案。

- [x] **Step 4: 跑 API 绿灯**
  - Run: `cd apps/api && UV_NO_CACHE=1 uv run pytest tests/test_api_commands.py -k "identity_ref"`
  - Expected: PASS。

### Task 2: Frontend field error mapping

**Files:**
- Modify: `apps/web/components/skills/skill-settings-panel.tsx`
- Modify: `apps/web/components/skills/skill-access-panel.tsx`
- Modify: `apps/web/components/decision-workbench.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/e2e/form-errors.spec.ts`

- [x] **Step 1: 写 E2E 红测**
  - 在 `form-errors.spec.ts` 新增 `identity reference format errors map to low-frequency admin fields`。
  - 导入一个 skill。
  - 在 `.skillSettingsPanel` 把 `归属` 填成 `platform team`，点击 `保存 skill 设置`，断言 `.formErrorSummary` 可见且 `input[name="owner_ref"]` 有 `aria-invalid="true"`。
  - 在 `.skillAccessPanel` 把 `成员` 填成 `qa reviewer`，点击 `添加成员`，断言 `.formErrorSummary` 可见且 `input[name="subject_id"]` 有 `aria-invalid="true"`。

- [x] **Step 2: 跑 E2E 红灯**
  - Run: `cd apps/web && npm run e2e -- form-errors.spec.ts -g "identity reference"`
  - Expected: FAIL，因为两个 panel 仍是 raw form，API field errors 不会回填到字段。

- [x] **Step 3: 更新 SkillSettingsPanel**
  - 引入 `ValidatedForm`。
  - 把 `<form className="skillSettingsForm" ...>` 改为 `<ValidatedForm className="skillSettingsForm" ... onValidSubmit={onUpdateSkill}>`。
  - 保留 `key={selectedDetail.skill.id}`、字段和按钮。

- [x] **Step 4: 更新 SkillAccessPanel**
  - 引入 `ValidatedForm`。
  - 把 `<form className="skillAccessForm" onSubmit={onAssignRole}>` 改为 `<ValidatedForm className="skillAccessForm" onValidSubmit={onAssignRole}>`。
  - 保留成员、角色和按钮。

- [x] **Step 5: 更新 mutation 错误传递和 CSS**
  - `DecisionWorkbench.assignSkillRole` 的 `runCommand` 加上 `{ rethrowFieldErrors: true }`。
  - 在 `globals.css` 增加：
    - `.skillSettingsForm .formErrorSummary { grid-column: 1 / -1; }`
    - `.skillAccessForm .formErrorSummary { grid-column: 1 / -1; }`

- [x] **Step 6: 跑 E2E 绿灯**
  - Run: `cd apps/web && npm run e2e -- form-errors.spec.ts -g "identity reference"`
  - Expected: PASS。

### Task 3: 文档、完整验证、提交

**Files:**
- Modify: `README.md`
- Modify: `docs/api-contract.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-ux-friction-audit-2026-05-14.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Modify: `.agent/logs/LOG.md`
- Modify: `.agent/tasks.json`
- Create: `.agent/tasks/TASK-065.json`

- [x] **Step 1: 更新中文文档和任务记录**
  - 记录 `owner_ref` / `subject_id` 的字符规则和 120 字符上限。
  - 记录这仍不是 identity store 或真实认证。

- [x] **Step 2: 完整验证**
  - `cd apps/api && UV_NO_CACHE=1 uv run pytest`
  - `cd apps/web && npm run test:unit`
  - `cd apps/web && npm run typecheck`
  - `cd apps/web && npm run build`
  - `cd apps/web && npm audit --omit=dev`
  - `cd apps/web && npm run e2e`
  - `git diff --check`
  - `jq empty .agent/tasks.json .agent/tasks/TASK-065.json`
