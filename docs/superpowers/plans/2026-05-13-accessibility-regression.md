# Accessibility Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 为 SkillHub 工作台补上可测试的键盘、焦点、读屏通知和 reduced-motion 回归护栏。

**Architecture:** 用低风险的 shell/CSS 改动提升全局 accessibility 基线；用独立 Playwright spec 覆盖用户能感知的行为。保持现有三栏信息架构，不引入 axe 依赖，也不重写 command menu。

**Tech Stack:** Next.js、CSS `:focus-visible`、`prefers-reduced-motion`、Playwright E2E。

---

### Task 1: 任务登记和红色 E2E

**Files:**
- Create: `.agent/tasks/TASK-025.json`
- Modify: `.agent/tasks.json`
- Create: `apps/web/e2e/accessibility-workbench.spec.ts`

- [x] **Step 1: 登记 TASK-025**

在 `.agent/tasks.json` 追加：

```json
{
  "id": "025",
  "title": "补齐 Accessibility 回归护栏",
  "priority": 25,
  "passes": false,
  "spec": ".agent/tasks/TASK-025.json"
}
```

- [x] **Step 2: 写红色 E2E**

新增 `apps/web/e2e/accessibility-workbench.spec.ts`，覆盖 skip link、focus ring、reduced motion 和 `aria-live` notice。

- [x] **Step 3: 验证红灯**

运行：

```bash
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e -- accessibility-workbench.spec.ts
```

预期至少 skip link 测试失败，因为当前 shell 没有 skip link。

### Task 2: AppShell 和状态通知

**Files:**
- Modify: `apps/web/components/chrome.tsx`
- Modify: `apps/web/components/decision-workbench.tsx`

- [x] **Step 1: 增加 skip link**

在 `AppShell` 的 `.shell` 内最前面加入：

```tsx
<a className="skipLink" href="#main-content">跳到主要内容</a>
```

并把 `<main className="main">` 改为：

```tsx
<main className="main" id="main-content" tabIndex={-1}>
```

- [x] **Step 2: 增加 aria-live notice**

把 `linearNotice` 改为：

```tsx
<div aria-live="polite" className={`linearNotice linearNotice-${notice.tone}`} role="status">
  {notice.message}
</div>
```

### Task 3: Focus 和 reduced-motion CSS

**Files:**
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: 增加 focus token**

在 `:root` 增加：

```css
--focus-ring: #111827;
--focus-ring-soft: #bfdbfe;
```

- [x] **Step 2: 强化全局 focus-visible**

把全局 `:focus-visible` 改成高对比双层 ring：

```css
button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
a:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 3px;
  box-shadow: 0 0 0 6px var(--focus-ring-soft);
}
```

- [x] **Step 3: 增加 skip link 样式**

新增 `.skipLink` 和 `.skipLink:focus-visible`，默认视觉隐藏，聚焦时固定显示在左上角。

- [x] **Step 4: 增加 reduced motion**

新增：

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-delay: 0ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Task 4: 文档、验证、提交

**Files:**
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Modify: `.agent/logs/LOG.md`
- Modify: `.agent/tasks.json`
- Modify: `.agent/tasks/TASK-025.json`

- [x] **Step 1: 更新中文文档**

记录本轮新增 accessibility 护栏、借鉴来源、验证命令和仍未覆盖的 ARIA 深水区。

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

设置 TASK-025 complete / passes true，提交：

```bash
git commit -m "test: add accessibility regression guardrails"
```
