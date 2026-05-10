# Run Comparison And Accepted Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 实现两个 finished EvalRuns 的同快照比较，并允许把一个 run 标记为当前 variant/eval set snapshot 的 accepted verification。

**Architecture:** 后端新增 `accepted_verifications` 指针表、run comparison read model 和 accept command。前端在 History mode 里选择 baseline/candidate run，进入独立 Run Compare pane，展示 score delta、逐 case 修复/回退，并可把 candidate run 接受为验证依据。

**Tech Stack:** FastAPI、SQLAlchemy Core、SQLite/Postgres DDL、Next.js App Router、React 19、Playwright E2E。

---

## 文件结构

- Create: `apps/api/skillhub/application/run_comparison.py`
  - 纯函数：pass/fail change、summary、pass rate、case comparison。
- Modify: `apps/api/skillhub/infrastructure/db/tables.py`
  - 新增 `accepted_verifications` table 和 indexes。
- Modify: `apps/api/skillhub/infrastructure/db/schema.sql`
  - 新增 DDL。
- Modify: `apps/api/migrations/versions/0001_initial_schema.py`
  - downgrade 删除新增表。
- Modify: `apps/api/skillhub/infrastructure/db/repositories.py`
  - 新增 `compare_eval_runs(...)`、`accept_eval_run_verification(...)`、accepted pointer helper。
  - `_skill_summary` 优先返回 accepted verification run。
  - `list_eval_runs_for_skill` 每行附加 `accepted_verification`。
- Modify: `apps/api/skillhub/api/main.py`
  - 新增 `GET /api/eval-runs/compare`。
  - 新增 `POST /api/eval-runs/accepted-verifications`。
- Modify: `apps/api/tests/test_sqlalchemy_metadata.py`
  - 覆盖新表、FK、unique、index。
- Modify: `apps/api/tests/test_sql_repository.py`
  - 覆盖 comparison、跨 eval set 拒绝、accept verification、summary 优先 accepted。
- Modify: `apps/api/tests/test_api_commands.py`
  - 覆盖 API read model 和 command。
- Modify: `apps/web/lib/types.ts`
  - 新增 `EvalRunComparison`、`AcceptedVerification` 类型。
- Create: `apps/web/components/run-comparison/run-comparison-panel.tsx`
  - 展示比较和接受按钮。
  - 展示逐 case 修复/回退。
- Modify: `apps/web/components/decision-workbench.tsx`
  - `history` 中选择 baseline/candidate，进入 `run-compare` mode。
  - 接受 verification 后刷新 history 和 skill summary。
- Modify: `apps/web/e2e/skills-workbench.spec.ts`
  - 新增 happy path。
- Modify: `apps/web/e2e/visual-workbench.spec.ts`
  - 新增 run compare 视觉基线。
- Modify: `README.md`、`docs/api-contract.md`、`docs/product-ux-review.md`、`docs/product-completion-audit-2026-05-08.md`
  - 中文记录新能力和剩余风险。

## Task 1: Backend Red Tests

**Files:**
- Modify: `apps/api/tests/test_sqlalchemy_metadata.py`
- Modify: `apps/api/tests/test_sql_repository.py`
- Modify: `apps/api/tests/test_api_commands.py`

- [x] **Step 1: Metadata failing test**

Add checks that `accepted_verifications` exists, has unique `(variant_id, eval_set_version_id)`, and FKs to variant, variant version, eval set version, eval run.

Run:

```bash
cd apps/api && uv run pytest tests/test_sqlalchemy_metadata.py -q
```

Expected: FAIL because table does not exist.

- [x] **Step 2: Repository failing tests**

Add tests:

```python
def test_compare_eval_runs_returns_fixed_and_regressed_summary(self): ...
def test_compare_eval_runs_rejects_different_eval_set_versions(self): ...
def test_accept_eval_run_verification_records_pointer_and_audit(self): ...
def test_accept_eval_run_verification_rejects_failed_run(self): ...
def test_skill_summary_prefers_accepted_verification_over_latest_finished_run(self): ...
```

Run:

```bash
cd apps/api && uv run pytest tests/test_sql_repository.py -q
```

Expected: FAIL because repository methods do not exist.

- [x] **Step 3: API failing tests**

Add tests for:

```http
GET /api/eval-runs/compare?baseline_run_id=...&candidate_run_id=...
POST /api/eval-runs/accepted-verifications
```

Run:

```bash
cd apps/api && uv run pytest tests/test_api_commands.py -q
```

Expected: FAIL because endpoints do not exist.

## Task 2: Backend Implementation

**Files:**
- Create: `apps/api/skillhub/application/run_comparison.py`
- Modify: `apps/api/skillhub/infrastructure/db/tables.py`
- Modify: `apps/api/skillhub/infrastructure/db/schema.sql`
- Modify: `apps/api/migrations/versions/0001_initial_schema.py`
- Modify: `apps/api/skillhub/infrastructure/db/repositories.py`
- Modify: `apps/api/skillhub/api/main.py`

- [x] **Step 1: Add pure comparison helpers**

Implement:

```python
def run_change(*, baseline_passed: bool | None, candidate_passed: bool | None) -> str: ...
def build_run_case_comparisons(...): ...
def pass_rate(summary: dict[str, int]) -> int | None: ...
def build_run_comparison_summary(...): ...
```

- [x] **Step 2: Add accepted_verifications table**

DDL follows the design spec. Add:

```python
Index("accepted_verifications_variant_eval_set_idx", accepted_verifications.c.variant_id, accepted_verifications.c.eval_set_version_id)
Index("accepted_verifications_eval_run_id_idx", accepted_verifications.c.eval_run_id)
```

- [x] **Step 3: Add repository read model**

`compare_eval_runs` must:

- load both runs.
- require same skill.
- require same eval set version.
- require both status `finished`.
- load eval set cases for that eval set version.
- compare `case_results` by case_version_id.
- return baseline/candidate binding and summary.

- [x] **Step 4: Add accept command**

`accept_eval_run_verification` must:

- require run `finished`.
- resolve variant through variant version.
- upsert unique `(variant_id, eval_set_version_id)` pointer.
- write audit event.

- [x] **Step 5: Add API routes**

Add payload:

```python
class AcceptEvalRunVerificationPayload(BaseModel):
    eval_run_id: str
    note: str = ""
    actor: str = "system"
```

Routes:

```python
@app.get("/api/eval-runs/compare")
@app.post("/api/eval-runs/accepted-verifications")
```

- [x] **Step 6: Run backend tests**

Run:

```bash
cd apps/api && uv run pytest
```

Expected:  all pass.

## Task 3: Frontend Red Test

**Files:**
- Modify: `apps/web/e2e/skills-workbench.spec.ts`

- [x] **Step 1: Add failing E2E**

Add:

```ts
test("operator can compare two eval runs and accept one as verification", async ({ page }) => {
  // import skill, add case
  // record baseline fail on v1
  // append v2 candidate, record candidate pass
  // open history
  // choose baseline/candidate
  // compare
  // expect +100, 修复
  // click 接受为验证依据
  // expect Accepted badge
});
```

Run:

```bash
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e -- --grep "operator can compare two eval runs"
```

初次编写该测试时预期失败，因为当时 UI 还没有 comparison mode。

## Task 4: Frontend Implementation

**Files:**
- Modify: `apps/web/lib/types.ts`
- Create: `apps/web/components/run-comparison/run-comparison-panel.tsx`
- Modify: `apps/web/components/decision-workbench.tsx`
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: Add types**

Add `AcceptedVerification`, `EvalRunComparisonCase`, `EvalRunComparison`.

- [x] **Step 2: Add comparison components**

`EvalRunComparisonPane` props:

```ts
{
  comparison: EvalRunComparison | null;
  loading: boolean;
  busy: boolean;
  onAccept(note: string): void;
}
```

- [x] **Step 3: Integrate Workbench**

Use History mode comparison state, state:

```ts
baselineRunId
candidateRunId
runComparison
runComparisonLoading
```

History rows get `对照` and `候选` buttons; the detail panel renders comparison when both are selected.

- [x] **Step 4: Add styles**

Use restrained operation-console style:

- summary cards
- delta badge
- case impact list
- sticky accept bar

## Task 5: Visual, Docs, Verification, Push

**Files:**
- Modify: `apps/web/e2e/visual-workbench.spec.ts`
- Add: `apps/web/e2e/visual-workbench.spec.ts-snapshots/run-comparison-ready-chromium-darwin.png`
- Modify: `README.md`
- Modify: `docs/api-contract.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Modify: `.agent/tasks.json` or add `.agent/tasks/TASK-004.json`

- [x] **Step 1: Add visual baseline**

Create run comparison screenshot and hide volatile IDs through `hideVolatileUi`.

- [x] **Step 2: Update docs**

中文说明:

- run comparison flow.
- accepted verification marker semantics.
- commands and endpoints.

- [x] **Step 3: Full verification**

Run:

```bash
cd apps/web && npm run typecheck
cd apps/web && npm run build
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e
cd apps/api && uv run pytest
git diff --check
```

- [ ] **Step 4: Commit and push**

Commit:

```bash
git add .
git commit -m "feat: add eval run comparison"
git push
```

## 自检

- 规格覆盖：same EvalSetVersion comparison、accepted pointer、audit、frontend flow、visual regression、docs。
- 无占位：所有行为均有明确 API、数据表和测试。
- 范围控制：不做多 run matrix、跨 eval set alignment、charts、权限或 runner。
