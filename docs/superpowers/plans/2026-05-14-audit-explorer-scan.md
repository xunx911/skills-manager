# Audit Explorer Scanability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Audit Explorer 从 Raw JSON 优先的日志页，变成可快速扫读 actor/action/resource/time/summary 的治理审计视图。

**Architecture:** 不改后端契约。前端在 `SkillAuditExplorer` 内基于已有 `AuditEvent[]` 派生 action chips、可读标题和 payload fields；CSS 只调整 Audit Explorer 相关 class；Playwright 覆盖 quick filter、timeline row 和 Raw payload disclosure。

**Tech Stack:** React client component、CSS Grid、native `details/summary`、Playwright E2E、existing visual snapshot。

---

### Task 1: 写 Audit Explorer 红灯测试

**Files:**
- Modify: `apps/web/e2e/skills-workbench.spec.ts`

- [x] **Step 1: 扩展现有审计 Explorer 测试**

在 `operator can filter skill audit events in the explorer` 中增加断言：

```ts
await expect(explorer.getByRole("button", { name: /筛选 role.assigned/ })).toBeVisible();
await explorer.getByRole("button", { name: /筛选 role.assigned/ }).click();
await expect(explorer.getByLabel("Action filter")).toHaveValue("role.assigned");
await expect(explorer.locator(".auditExplorerEvent")).toHaveCount(2);

const qaEvent = explorer.locator(".auditExplorerEvent").filter({ hasText: "qa-reviewer" });
await expect(qaEvent).toContainText("Access role assigned");
await expect(qaEvent).toContainText("product-operator");
await qaEvent.click();

const payloadPanel = explorer.locator(".auditPayloadPanel");
await expect(payloadPanel).toContainText("Readable summary");
await expect(payloadPanel).toContainText("qa-reviewer");
await expect(payloadPanel.locator(".auditRawPayload pre")).toBeHidden();
await payloadPanel.getByText("Raw payload").click();
await expect(payloadPanel.locator(".auditRawPayload pre")).toContainText('"subject_id": "qa-reviewer"');
```

- [x] **Step 2: 验证红灯**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/skills-workbench.spec.ts --project=chromium -g "operator can filter skill audit events in the explorer"
```

Expected: FAIL because quick filter, readable title, structured summary, and collapsed raw payload do not exist yet.

### Task 2: 实现扫读 UI

**Files:**
- Modify: `apps/web/components/skills/skill-audit-explorer.tsx`
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: 增加 action chips**

从 `events` 派生 action counts。每个 chip 是 button，点击调用 `onFilterChange("action", action)`。

- [x] **Step 2: 增加 readable event model**

在组件内新增 helper：

```ts
function auditActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function auditPayloadFields(event: AuditEvent) {
  return Object.entries(event.payload)
    .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    .slice(0, 6);
}
```

- [x] **Step 3: 重排 timeline row**

每条 row 显示 action label、action code、payload summary、actor/resource/time metadata，并设置 `aria-pressed` 表达选中态。

- [x] **Step 4: 重排 detail panel**

默认显示 `Readable summary` 和 key/value list；Raw JSON 放入 `<details className="auditRawPayload">`。

- [x] **Step 5: CSS 收敛**

更新 `.auditExplorerEvent`、`.auditEventActionLine`、`.auditEventMetaLine`、`.auditActionChips`、`.auditPayloadFields`、`.auditRawPayload` 等样式，保证 1280px 和移动端都不重叠。

- [x] **Step 6: 验证绿色**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/skills-workbench.spec.ts --project=chromium -g "operator can filter skill audit events in the explorer"
```

Expected: 1 passed.

### Task 3: 视觉基线和文档

**Files:**
- Modify: `apps/web/e2e/visual-workbench.spec.ts-snapshots/skill-audit-explorer-chromium-darwin.png`
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-ux-friction-audit-2026-05-14.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Create: `.agent/tasks/TASK-043.json`
- Modify: `.agent/tasks.json`
- Modify: `.agent/logs/LOG.md`

- [x] **Step 1: 更新视觉基线**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/visual-workbench.spec.ts --project=chromium -g "visual baseline: skill audit explorer" --update-snapshots
```

Actual: snapshot updated and visually inspected.

- [x] **Step 2: 更新文档**

记录 Audit Explorer 已改为 quick filters、readable timeline、structured detail 和 Raw JSON disclosure；下一轮不再把 “Audit Explorer 扫读重构” 列为待办。

- [x] **Step 3: 完整验证**

Run:

```bash
cd apps/web && npm run test:unit
cd apps/web && npm run typecheck
cd apps/web && npm run build
cd apps/web && npm audit --omit=dev
cd apps/api && uv run pytest
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e
git diff --check
jq empty .agent/tasks.json .agent/tasks/TASK-043.json
```

Actual: all pass. Web unit 1 file / 3 tests passed；typecheck passed；build passed；audit 0 vulnerabilities；API pytest 90 passed；Playwright E2E 54 passed。`git diff --check` 和任务 JSON 检查在提交前执行。
