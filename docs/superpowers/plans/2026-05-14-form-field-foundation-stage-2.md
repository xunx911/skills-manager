# 表单字段基础件第二阶段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把剩余工作台表单和筛选控件迁移到共享字段基础件，统一 label、hint、error、autocomplete 和 focus 行为。

**Architecture:** 扩展 `WorkbenchField` 支持字段级 error 和 checkbox hit target；业务组件只替换字段壳层，不改 submit handler。`WorkbenchHistoryPane` 抽出 `HistoryRunFiltersBar`，让 history 主视图继续保持在文件大小边界内。

**Tech Stack:** React client components、HTML form controls、CSS `:focus-visible`、Playwright E2E、TypeScript、Next.js。

---

### Task 1: 写第二阶段红灯 E2E

**Files:**
- Modify: `apps/web/e2e/accessibility-workbench.spec.ts`

- [x] **Step 1: 新增 secondary forms 测试**

添加测试 `secondary workbench forms use shared field semantics`，覆盖：

- `QuickAddCases` 单条模式：`quick_title`、`quick_input_text`、`quick_expected_output`、`quick_notes` 均有 `autocomplete="off"`，并位于 `.workbenchField` 内。
- `QuickAddCases` 批量模式：`批量 case 文本` textarea 有 `autocomplete="off"`。
- `EvalCaseDetailPanel` 内联编辑：标题/input/expected output/notes 都有 `autocomplete="off"`。
- `SkillSettingsPanel`：`slug`、`owner_ref` 有 `autocomplete="off"`，默认 variant select 位于 `.workbenchField`。
- `SkillAccessPanel`：`subject_id` 有 `autocomplete="off"`，role select 位于 `.workbenchField`。
- `SavedRunViews`、history filters、run matrix controls、diff selectors 使用 `.workbenchField` 或 `.workbenchCheckboxField`。

- [x] **Step 2: 运行红灯**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/accessibility-workbench.spec.ts --project=chromium -g "secondary workbench forms use shared field semantics"
```

Expected: FAIL，因为剩余表单还没有共享字段 wrapper 和 explicit autocomplete。

### Task 2: 扩展 WorkbenchField

**Files:**
- Modify: `apps/web/components/forms/workbench-field.tsx`
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: 增加 error API**

`FieldBaseProps` 增加 `error?: ReactNode`。`useFieldDescription` 同时生成 hint 和 error id；有 error 时把 error id 拼入 `aria-describedby`，并让 control `aria-invalid=true`。

- [x] **Step 2: 增加 CheckboxField**

新增 `CheckboxField`，输出 `<label className="workbenchCheckboxField">`，内部包含 input 和 label 文案，保证 checkbox 与文字共用 hit target。

- [x] **Step 3: 补通用样式**

新增 `.workbenchFieldError` 和 `.workbenchCheckboxField` 样式；通用 `.workbenchField :where(input, textarea, select):focus-visible` 提供一致 focus ring，容器级样式继续覆盖尺寸。

### Task 3: 迁移测评 case 表单

**Files:**
- Modify: `apps/web/components/eval-cases/quick-add-cases.tsx`
- Modify: `apps/web/components/eval-cases/eval-case-detail-panel.tsx`
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: 迁移 QuickAddCases**

用 `TextField`、`TextAreaField` 替换单条和批量 case 输入，保留原字段名和 submit 行为。

- [x] **Step 2: 迁移 EvalCaseDetailPanel**

用共享字段替换详情内联编辑表单，并保留现有 `aria-label`，避免现有 E2E 和读屏标签回归。

- [x] **Step 3: 调整 CSS**

把 `.quickCaseGrid`、`.quickCaseBatch`、`.evalCaseInlineForm` 中直接 input/textarea/label 选择器调整为 `.workbenchField` 子选择器。

### Task 4: 迁移概览设置和访问控制表单

**Files:**
- Modify: `apps/web/components/skills/skill-settings-panel.tsx`
- Modify: `apps/web/components/skills/skill-access-panel.tsx`
- Modify: `apps/web/components/skills/skill-governance-panel.tsx`
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: 迁移 SkillSettingsPanel**

用 `TextField` 和 `SelectField` 替换 Skill ID、归属和默认分发 variant。

- [x] **Step 2: 迁移 SkillAccessPanel**

用 `TextField` 和 `SelectField` 替换成员和角色字段。

- [x] **Step 3: 迁移 SkillGovernancePanel**

用 `TextField` 替换危险区确认输入，保留受控 value 和 placeholder。

- [x] **Step 4: 调整 CSS**

把 settings/access/governance 表单样式改为针对 `.workbenchField` 控件。

### Task 5: 迁移历史、矩阵和 diff 控件

**Files:**
- Create: `apps/web/components/history/history-run-filters-bar.tsx`
- Modify: `apps/web/components/history/workbench-history-pane.tsx`
- Modify: `apps/web/components/saved-views/saved-run-views.tsx`
- Modify: `apps/web/components/run-matrix/run-matrix-panel.tsx`
- Modify: `apps/web/components/diff/workbench-diff-pane.tsx`
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: 抽出 HistoryRunFiltersBar**

新组件接收 `filters`、`variantVersions`、`evalSetVersions` 和 `onFilterChange`，内部使用 `SelectField` 输出四个 history filters。

- [x] **Step 2: 迁移 SavedRunViews**

用 `SelectField` 和 `TextField` 替换保存视图选择和名称输入。

- [x] **Step 3: 迁移 RunMatrixPanel controls**

用 `SelectField` 替换 impact/group select，用 `CheckboxField` 替换 score toggle。

- [x] **Step 4: 迁移 WorkbenchDiffPane selectors**

用 `SelectField` 替换 From/To version selectors。

- [x] **Step 5: 绿色验证**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/accessibility-workbench.spec.ts --project=chromium -g "secondary workbench forms use shared field semantics"
```

Expected: 1 passed.

### Task 6: 文档、任务记录和完整验证

**Files:**
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-ux-friction-audit-2026-05-14.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Create: `.agent/tasks/TASK-048.json`
- Modify: `.agent/tasks.json`
- Modify: `.agent/logs/LOG.md`

- [x] **Step 1: 更新中文文档**

记录表单字段基础件第二阶段已覆盖剩余工作台表单/筛选控件，并说明仍未做错误 summary、真实认证、组织级权限。

- [x] **Step 2: 完整验证**

Run:

```bash
cd apps/web && npm run test:unit
cd apps/web && npm run typecheck
cd apps/web && npm run build
cd apps/web && npm audit --omit=dev
cd apps/api && uv run pytest
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e
git diff --check
jq empty .agent/tasks.json .agent/tasks/TASK-048.json
wc -l apps/web/components/history/workbench-history-pane.tsx apps/web/components/history/history-run-filters-bar.tsx apps/web/components/forms/workbench-field.tsx
```

Expected: all pass；`WorkbenchHistoryPane` 小于 300 行。
