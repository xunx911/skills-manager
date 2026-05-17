# Character Count Hints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让低频长文本字段在提交前显示剩余或超出字符数，减少服务端超限错误后的返工。

**Architecture:** 在共享 `TextAreaField` 增加可选 `characterLimit`，未传入时保持现状。字段计数作为局部说明加入 `aria-describedby`，不使用 `maxLength` 截断输入，服务端仍是最终校验来源。

**Tech Stack:** React、Next.js、Playwright、Vitest。

---

### Task 1: Character count foundation

**Files:**
- Modify: `apps/web/components/forms/workbench-field.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/e2e/form-errors.spec.ts`

- [x] **Step 1: 写 E2E 红测**
  - 在 `form-errors.spec.ts` 新增 `limited textareas expose character count hints`。
  - 导入一个临时 skill，切到 `变体`，打开 `新建约束 variant`。
  - 定位 `.variantCreationComposer textarea[name="summary"]` 的父级 label。
  - 断言父级包含 `还可输入 1000 个字符`。
  - 填入 `"x".repeat(1001)`。
  - 断言父级包含 `已超出 1 个字符`。
  - 断言 textarea 的 `aria-describedby` 包含 `character-count`。

- [x] **Step 2: 跑 E2E 红灯**
  - Run: `cd apps/web && npm run e2e -- form-errors.spec.ts -g "limited textareas"`
  - Expected: FAIL，因为当前 `TextAreaField` 没有字符计数节点。

- [x] **Step 3: 实现 `TextAreaField.characterLimit`**
  - 在 `TextAreaFieldProps` 增加 `characterLimit?: number`。
  - 在 `TextAreaField` 中用 `useState` 跟踪当前长度，受控字段从 `props.value` 同步，非受控字段从 `defaultValue` 初始化。
  - 传入 `characterLimit` 时渲染 `<small className="workbenchFieldCharacterCount" id={`${controlId}-character-count`}>...</small>`。
  - 未超限显示 `还可输入 ${remaining} 个字符`，超限显示 `已超出 ${Math.abs(remaining)} 个字符`。
  - 把 count id 合并进 `aria-describedby`。
  - 保留调用方原有 `onChange`。

- [x] **Step 4: 补 CSS**
  - `.workbenchFieldCharacterCount` 使用和 hint 一致的 11px 辅助文本。
  - `[data-over-limit="true"]` 使用错误色和更高字重。

- [x] **Step 5: 跑 E2E 绿灯**
  - Run: `cd apps/web && npm run e2e -- form-errors.spec.ts -g "limited textareas"`
  - Expected: PASS。

### Task 2: 接入低频长文本字段

**Files:**
- Modify: `apps/web/components/skills/skill-launchpad.tsx`
- Modify: `apps/web/components/inspector/workbench-inspector.tsx`
- Modify: `apps/web/components/variants/variant-creation-composer.tsx`
- Modify: `apps/web/components/variants/workspace-version-composer.tsx`
- Modify: `apps/web/components/run-comparison/run-comparison-panel.tsx`
- Modify: `apps/web/components/promotion-review/promotion-review-pane.tsx`

- [x] **Step 1: 接入 1000 字符上限字段**
  - 为上述组件中的 variant summary、change summary、verification note 和 promotion decision note 传入 `characterLimit={1000}`。
  - `RunComparisonPanel` 的 `Verification note` 从 `TextField` 改为 `TextAreaField`，保留 `aria-label`、`name="note"`、`value` 和 `onChange`。

- [x] **Step 2: 跑目标 E2E 回归**
  - Run: `cd apps/web && npm run e2e -- form-errors.spec.ts`
  - Expected: PASS，确保既有字段错误摘要和超限错误不被破坏。

### Task 3: 文档、验证、提交

**Files:**
- Create: `.agent/tasks/TASK-067.json`
- Modify: `.agent/tasks.json`
- Modify: `.agent/logs/LOG.md`
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-ux-friction-audit-2026-05-14.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`

- [x] **Step 1: 更新中文文档和任务记录**
  - 记录低频长文本字段现在显示字符剩余/超出提示。
  - 明确这不改变服务端上限，也不截断输入。

- [x] **Step 2: 完整验证**
  - `cd apps/api && UV_NO_CACHE=1 uv run pytest`
  - `cd apps/web && npm run test:unit`
  - `cd apps/web && npm run typecheck`
  - `cd apps/web && npm run build`
  - `cd apps/web && npm audit --omit=dev`
  - `cd apps/web && npm run e2e`
  - `git diff --check`
  - `jq empty .agent/tasks.json .agent/tasks/TASK-067.json`
