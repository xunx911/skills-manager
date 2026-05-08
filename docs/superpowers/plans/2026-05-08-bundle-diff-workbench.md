# Bundle Diff Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a runnable bundle version diff workflow: upload a new standard skill bundle version, compare it to a previous immutable bundle snapshot, and show file-level line diffs in the `/skills` workbench.

**Architecture:** Backend owns diff truth through `SqlSkillRepository.bundle_diff(left, right)`, reading immutable `skill_bundle` artifact manifests and returning a read model. The existing `POST /api/variant-versions` endpoint accepts either an existing `content_ref` or a standard bundle `source`, so users can create a second comparable bundle version from the UI. The Next.js workbench renders a focused diff mode with version selectors, status filters, changed file rail, and selected-file diff.

**Tech Stack:** FastAPI, SQLAlchemy, Python `difflib`, Next.js React client component, Playwright E2E and screenshot regression.

---

### Task 1: Backend Diff API

**Files:**
- Modify: `apps/api/skillhub/infrastructure/db/repositories.py`
- Modify: `apps/api/skillhub/api/main.py`
- Test: `apps/api/tests/test_api_commands.py`

- [x] **Step 1: Write failing API tests**

Add tests that import a skill bundle, create a second bundle version through `POST /api/variant-versions` with `source`, then call `GET /api/artifacts/diff`. Assert changed `SKILL.md`, added file, removed file, binary marker, and cross-skill rejection.

- [x] **Step 2: Run failing tests**

Run: `uv run pytest tests/test_api_commands.py -k "bundle_diff or variant_version_from_bundle" -v`

Expected: FAIL because `source` is not accepted and `/api/artifacts/diff` does not exist.

- [x] **Step 3: Implement repository diff read model**

Add `bundle_diff(left_variant_version_id, right_variant_version_id)`. It must:

- load both variant versions.
- reject different `skill_id`.
- resolve `content_ref.kind == "artifact"` and `locator == "artifact:{id}"`.
- parse artifact `content_text` as the normalized bundle manifest.
- compare files by path.
- return `added`, `removed`, `changed`, `unchanged`, `binary` summary and file entries.
- produce line hunks for UTF-8 text files using `difflib.SequenceMatcher`.

- [x] **Step 4: Implement API payload and routes**

Update `CreateVariantVersionPayload` so `content_ref` is optional when `source` is provided. Add:

```text
GET /api/artifacts/diff?left_variant_version_id=...&right_variant_version_id=...
```

- [x] **Step 5: Run backend tests**

Run: `uv run pytest tests/test_api_commands.py -k "bundle_diff or variant_version_from_bundle" -v`

Expected: PASS.

### Task 2: Frontend Diff Workbench

**Files:**
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/components/decision-workbench.tsx`
- Modify: `apps/web/app/globals.css`
- Test: `apps/web/e2e/helpers.ts`
- Test: `apps/web/e2e/skills-workbench.spec.ts`
- Test: `apps/web/e2e/visual-workbench.spec.ts`

- [x] **Step 1: Write failing Playwright tests**

Add an E2E helper to create a second bundle version from a folder. Add tests that import a skill, upload a new bundle version, open `比较版本`, and assert changed/added/removed files plus line-level added/removed text.

- [x] **Step 2: Run failing E2E test**

Run: `npm run e2e -- --grep "bundle diff"`

Expected: FAIL because the UI has no bundle version upload and no diff mode.

- [x] **Step 3: Add frontend types and API calls**

Add `BundleDiff`, `BundleDiffFile`, `BundleDiffLine`, and `BundleDiffStatus` to `apps/web/lib/types.ts`. Add client calls in `decision-workbench.tsx` for creating variant versions from `source` and loading artifact diffs.

- [x] **Step 4: Add UI mode**

Add `Mode = "diff"` and render:

- version selectors defaulting previous -> current.
- changed-file summary.
- file status filters.
- changed file rail.
- selected file diff panel.
- empty state when a variant has fewer than two versions.

- [x] **Step 5: Style diff workbench**

Add CSS for `.diffWorkbench`, `.diffFileRail`, `.diffLine-added`, `.diffLine-removed`, `.diffLine-context`, and responsive layout.

- [x] **Step 6: Run E2E**

Run: `npm run e2e -- --grep "bundle diff"`

Expected: PASS.

### Task 3: Verification And Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`

- [x] **Step 1: Update docs after implementation**

Change README from “diff queued next” to real support only after tests pass. Update UX review and audit gaps.

- [x] **Step 2: Run full verification**

Run:

```bash
cd apps/api && uv run pytest
cd apps/web && npm run typecheck
cd apps/web && npm run build
cd apps/web && npm run e2e
git diff --check
```

Expected: all pass.

- [x] **Step 3: Commit and push**

Commit a runnable state to `main` and push.

## Self-Review

Spec coverage:

- Implements backend diff read model, UI workbench, exact variant version binding, tests, and docs.

Placeholder scan:

- No TBD/TODO placeholders.

Type consistency:

- Backend route uses `left_variant_version_id` and `right_variant_version_id`; frontend types use the same names through API query parameters.
