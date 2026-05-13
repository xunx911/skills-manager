# Inspector Action 焦点交接 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让键盘用户触发导入、新建、添加 case 等 Inspector action 后，焦点进入对应表单。

**Architecture:** 在 `DecisionWorkbench` 中用计数器表示“这次 action 需要交接焦点”，由 `Inspector` 在 action 表单渲染后把焦点送到第一个可操作控件。初始加载和普通 skill 切换不会触发 handoff，不使用正 `tabindex`。

**Tech Stack:** React refs/effects、Next.js client component、Playwright E2E、WCAG focus order。

---

### Task 1: 任务登记和红色 E2E

**Files:**
- Create: `.agent/tasks/TASK-028.json`
- Modify: `.agent/tasks.json`
- Modify: `apps/web/e2e/accessibility-workbench.spec.ts`

- [x] **Step 1: 登记 TASK-028**

在 `.agent/tasks.json` 追加：

```json
{
  "id": "028",
  "title": "补齐 Inspector Action 焦点交接",
  "priority": 28,
  "passes": false,
  "spec": ".agent/tasks/TASK-028.json"
}
```

- [x] **Step 2: 写红色 E2E**

新增两个测试：

```ts
test("catalog action moves focus into the inspector form", async ({ page }) => {
  await page.goto("/skills");
  await page.getByLabel("Skill catalog").getByRole("button", { name: "导入", exact: true }).click();
  await expect(page.getByLabel("Inspector").locator('input[name="owner_ref"]')).toBeFocused();
});
```

```ts
test("command menu action moves focus into the inspector form", async ({ page }) => {
  await importSkillBundle(page, `focus-handoff-${Date.now()}`);
  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  await page.getByRole("combobox", { name: "Search" }).fill("添加 case");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Inspector").locator('input[name="title"]')).toBeFocused();
});
```

- [x] **Step 3: 验证红灯**

运行：

```bash
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e -- accessibility-workbench.spec.ts --grep "inspector form"
```

预期失败，因为当前 action 切换后没有 focus handoff。

### Task 2: Inspector focus handoff 实现

**Files:**
- Modify: `apps/web/components/decision-workbench.tsx`

- [x] **Step 1: 增加 focus request state**

在 `DecisionWorkbench` 中新增：

```ts
const [inspectorFocusRequest, setInspectorFocusRequest] = useState(0);
```

- [x] **Step 2: 扩展 chooseAction**

把 `chooseAction` 改为：

```ts
function chooseAction(nextActionMode: ActionMode, options: { focusInspector?: boolean } = {}) {
  setActionMode(nextActionMode);
  if (options.focusInspector !== false) {
    setInspectorFocusRequest((current) => current + 1);
  }
  // 保留现有 mode 切换
}
```

初始空数据 `chooseAction("import-skill")` 和 skill list 切换 `chooseAction("skill")` 传 `{ focusInspector: false }`。

- [x] **Step 3: Inspector 接收 request**

给 `Inspector` prop 增加：

```ts
actionFocusRequest: number;
```

- [x] **Step 4: Inspector 执行一次 focus**

在 `Inspector` 内新增 `useRef` / `useEffect`：

```ts
const stackRef = useRef<HTMLDivElement>(null);
const lastFocusRequestRef = useRef(0);

useEffect(() => {
  if (!actionFocusRequest || lastFocusRequestRef.current === actionFocusRequest) return;
  lastFocusRequestRef.current = actionFocusRequest;
  const panel = stackRef.current?.querySelector<HTMLElement>(".inspectorForm");
  const target = panel?.querySelector<HTMLElement>(
    'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href]',
  );
  if (!target) return;
  const frame = window.requestAnimationFrame(() => target.focus());
  return () => window.cancelAnimationFrame(frame);
}, [actionFocusRequest, actionMode]);
```

### Task 3: 文档、验证和提交

**Files:**
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Modify: `.agent/logs/LOG.md`
- Modify: `.agent/tasks.json`
- Modify: `.agent/tasks/TASK-028.json`

- [x] **Step 1: 中文文档**

记录 Inspector action focus handoff 已完成，剩余 accessibility 深水区是人工读屏验收和更广的全路径焦点巡检。

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

设置 TASK-028 complete / passes true，提交：

```bash
git commit -m "fix: improve inspector focus handoff"
```
