# Run Matrix 表格语义 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 History 页 Run matrix 从视觉矩阵升级为可被辅助技术严谨理解的原生数据表。

**Architecture:** 保留现有 `RunMatrixPanel` 和原生 `<table>`，补齐 caption、description、header scope、row/col index 和单元格 aria-label。用 Playwright E2E 锁定真实 DOM accessibility 语义，不引入 data grid 或外部组件库。

**Tech Stack:** React、Next.js client component、HTML table semantics、WAI-ARIA table properties、Playwright E2E。

---

### Task 1: 任务登记和红色 E2E

**Files:**
- Create: `.agent/tasks/TASK-027.json`
- Modify: `.agent/tasks.json`
- Modify: `apps/web/e2e/skills-workbench.spec.ts`

- [x] **Step 1: 登记 TASK-027**

在 `.agent/tasks.json` 追加：

```json
{
  "id": "027",
  "title": "补齐 Run Matrix 表格语义",
  "priority": 27,
  "passes": false,
  "spec": ".agent/tasks/TASK-027.json"
}
```

- [x] **Step 2: 写红色 E2E**

在 `operator can inspect run matrix across eval runs` 中新增断言：

```ts
const matrixTable = page.getByRole("table", { name: "Run matrix results" });
await expect(matrixTable).toBeVisible();
await expect(matrixTable.getByRole("columnheader", { name: "Case" })).toBeVisible();
await expect(matrixTable.getByRole("columnheader", { name: "Impact" })).toBeVisible();
await expect(matrixTable.getByRole("rowheader", { name: /PR: missing tenant scope/ })).toBeVisible();
await expect(matrixTable.getByRole("cell", { name: /PR: missing tenant scope.*不通过/ })).toBeVisible();
await expect(matrixTable.getByRole("cell", { name: /PR: token logging.*通过/ })).toBeVisible();
```

- [x] **Step 3: 验证红灯**

运行：

```bash
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e -- skills-workbench.spec.ts --grep "run matrix"
```

预期失败，因为当前 table 没有 caption/name，cell 也没有完整可读名称。

### Task 2: RunMatrixPanel 表格语义

**Files:**
- Modify: `apps/web/components/run-matrix/run-matrix-panel.tsx`
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: 添加隐藏 caption 和 description**

在 `RunMatrixPanel` 内创建稳定 label/description id，表格使用：

```tsx
<table
  aria-colcount={runs.length + 2}
  aria-describedby={descriptionId}
  aria-rowcount={visibleDataRowCount}
  className="runMatrixTable"
>
  <caption className="visuallyHidden" id={captionId}>Run matrix results</caption>
</table>
```

- [x] **Step 2: 添加 header scope 和 row/col index**

列标题使用 `scope="col"` 和 `aria-colindex`；case 标题使用 `scope="row"`；group row 使用 `scope="rowgroup"`。

- [x] **Step 3: 给 impact 和结果单元格添加 aria-label**

新增小 helper：

```ts
function runLabel(row: EvalRunMatrix["runs"][number]) {
  return `${row.variant.label} v${row.variant_version.version_number} / ${row.eval_set.name} v${row.eval_set_version.version_number}`;
}

function resultLabel(caseTitle: string, run: EvalRunMatrix["runs"][number], passed: boolean | null) {
  const result = passed === null ? "未覆盖" : passed ? "通过" : "不通过";
  return `${caseTitle} 在 ${runLabel(run)} 的结果：${result}`;
}
```

- [x] **Step 4: 增加 `.visuallyHidden` 通用样式**

如果全局没有隐藏但读屏可读样式，添加：

```css
.visuallyHidden {
  position: absolute !important;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}
```

### Task 3: 文档、验证和提交

**Files:**
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Modify: `.agent/logs/LOG.md`
- Modify: `.agent/tasks.json`
- Modify: `.agent/tasks/TASK-027.json`

- [x] **Step 1: 中文文档**

记录 Run matrix 已补齐 table/caption/header/cell 语义，剩余 accessibility 深水区改为完整焦点顺序和人工读屏验收。

- [x] **Step 2: 完整验证**

运行：

```bash
cd apps/api && uv run pytest
cd apps/web && npm run typecheck
cd apps/web && npm run build
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e
git diff --check
```

- [x] **Step 3: 提交**

设置 TASK-027 complete / passes true，提交：

```bash
git commit -m "fix: improve run matrix table semantics"
```
