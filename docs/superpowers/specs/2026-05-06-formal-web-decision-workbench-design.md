# SkillHub Formal Web Decision Workbench Design

Date: 2026-05-06

Status: Approved for implementation planning

## 1. Purpose

SkillHub formal web should not be a generic admin dashboard, a card-wall marketplace, or a GitHub repository clone. Its primary job is to help a user decide whether a skill is usable and trustworthy under a specific constraint set.

The homepage must answer four questions in one screen:

1. What skills exist?
2. What does the selected skill do?
3. Which variant is the default/current answer?
4. What evidence proves it is safe to use?

This is why the selected homepage model is **Decision Workbench**:

```text
left: skill catalog
middle: selected skill / default variant / usage surface
right: evidence rail
bottom: variant and eval matrix preview
```

## 2. Borrowed Product Patterns

### Linear: dense navigation and low-noise switching

Linear's redesign emphasizes reducing visual noise, maintaining alignment, and increasing navigation hierarchy/density so the product can act as a purpose-built work system instead of a simple list. SkillHub needs the same kind of "fast switching" between skills and variants.

Applied here:

- Left-side catalog is dense and persistent.
- Selecting a skill should update the middle and right panels without forcing a route change.
- Navigation is secondary to the active work object.

Reference: https://linear.app/now/how-we-redesigned-the-linear-ui

### GitHub Marketplace: skill value before implementation details

GitHub Marketplace listings prioritize name, description, feature card, screenshots, and listing details. That pattern is useful because normal users need to understand what an item does before they care about internals.

Applied here:

- The middle panel starts with skill purpose, default variant, tags, and use/install action.
- Internal IDs, digests, locators, and version bindings are visible but secondary.
- Public browsing can still use a lightweight marketplace-like mode later.

Reference: https://docs.github.com/en/developers/github-marketplace/writing-a-listing-description-for-your-app

### Observable: evidence as an interactive document

Observable notebooks combine prose, code, outputs, tables, and visualizations in one document. Eval run and eval set details have the same shape: explanation plus exact artifacts plus result tables.

Applied here:

- EvalRun pages should behave like evidence notebooks.
- Case input, expected output, result, artifacts, and notes should be presented together.
- Users should be able to drill from summary to exact case version.

Reference: https://observablehq.com/documentation/notebooks/

### Hex: drill, filter, explore

Hex data apps emphasize interactive data experiences where users can drill, filter, and explore from dashboards into details. SkillHub's eval data needs the same exploration path.

Applied here:

- Bottom matrix preview shows variant/eval status without requiring a separate compare view.
- Clicking a variant, eval set, run, or failed case opens the corresponding detail surface.
- Future multi-dimensional tables fit naturally into this area.

Reference: https://hex.tech/product/data-apps/

## 3. Information Architecture

### Homepage: Decision Workbench

The homepage route remains:

```text
/skills
```

It becomes a single-screen workbench rather than a list page.

Desktop layout:

```text
Global shell
  Left app nav
  Main workbench
    Header/search/filter row
    3-column active workspace
      Skill Catalog
      Selected Skill Panel
      Evidence Rail
    Bottom Matrix Preview
```

Responsive layout:

```text
Mobile/tablet
  Top nav
  Segmented tabs:
    Catalog
    Skill
    Evidence
    Matrix
```

### Skill Catalog

Purpose:

- Let users find and switch skills quickly.
- Preserve the familiar skillhub browsing behavior.

Content per row:

- Skill slug/name.
- Owner/namespace.
- Default variant label.
- Tags.
- Verification status.
- Latest accepted score if available.

Interactions:

- Click row selects the skill in-place.
- Search filters skill name, owner, tags.
- Tags are clickable filters.
- Verification status filter supports: `verified`, `failed`, `unverified`, `archived`.

Why this is good:

- Avoids the card-wall problem.
- Supports dense comparison.
- Keeps the user's current context visible while switching.

### Selected Skill Panel

Purpose:

- Explain what the skill does.
- Show the default variant as the recommended ordinary entrypoint.
- Provide the primary use action.

Content:

- Skill name and one-sentence description.
- Default variant label.
- Current variant tags.
- Current variant version.
- Use/install/copy action.
- Skill bundle preview:
  - `SKILL.md`
  - examples
  - tests/eval fixtures
  - content digest and locator collapsed by default.

Interactions:

- Primary action: Use selected variant.
- Secondary actions: View files, open variant page, create new version.
- File tree selection updates file content preview.

Why this is good:

- Keeps normal users out of eval internals until they need them.
- Still gives maintainers a fast path into files and versions.

### Evidence Rail

Purpose:

- Make trust visible at the moment of selection.
- Show exact evidence without making the user open a detail page.

Content:

- Latest accepted eval run summary.
- Exact binding:
  - `VariantVersion`
  - `EvalSetVersion`
- Pass/fail total.
- Failed case count and top failed case title.
- Strategy and run status.
- Promotion eligibility signal.

Interactions:

- Click score opens EvalRun page.
- Click eval set opens EvalSetVersion page.
- Click failed case opens the case result anchor within EvalRun page.
- Click binding opens version detail.

Why this is good:

- This is the core product difference.
- Ordinary skillhubs do not show proof adjacent to distribution.
- It prevents "looks good but unverified" from being confused with "safe to use."

### Matrix Preview

Purpose:

- Show that variants are maintained answers under different constraint tags.
- Let users compare without turning the homepage into a full analytics page.

Content:

- Variant label.
- Tags.
- Current version.
- Primary eval set score.
- Last run time.
- Current/historical marker.

Interactions:

- Click variant selects/open variant.
- Click score opens eval run.
- Filter/sort is light in v0.1; full multi-dimensional query comes later.

Why this is good:

- It replaces an overcomplicated variant graph.
- It makes variant state comparable.
- It supports the user's earlier requirement that variants are visible.

## 4. Detail Page Model

### Variant Page

Variant page is a focused release/experiment page.

Layout:

```text
Header: variant label, tags, current version, verification summary
Main: skill bundle file tree and selected file content
Evidence rail: current eval set, latest run, failed cases
History: version timeline
Matrix: this variant's runs across eval set versions
```

Rules:

- Variant does not show parent/child lineage.
- History is only this variant's version history.
- Candidate versions are normal immutable versions not pointed to by `current_version_id`.

### EvalSetVersion Page

EvalSetVersion page uses the evidence notebook model.

Layout:

```text
Header: eval set name, exact version, case count
Cells/sections:
  Snapshot summary
  Case table
  Selected case detail
  Input artifact
  Expected output artifact
  Related eval runs
```

Rules:

- Must show exact case versions, not just case count.
- Must preserve snapshot semantics.

### EvalRun Page

EvalRun page uses the evidence notebook model.

Layout:

```text
Header: run id, strategy, status, timestamp
Binding block: VariantVersion + EvalSetVersion
Summary block: pass/fail/total
Case result matrix
Selected case result detail:
  input
  expected output
  actual/result artifact
  pass/fail
  notes/logs
Conclusion block:
  supports promotion?
```

Rules:

- MVP result is pass/fail only.
- No nested checklist layer.
- Result rows bind exact case versions.

## 5. Visual Direction

Tone:

```text
evidence lab + reliability ledger
```

This should feel more like a technical decision instrument than a SaaS marketing dashboard.

Visual principles:

- Controlled density over empty card grids.
- Strong typographic contrast.
- One memorable layout idea: catalog + selected object + evidence rail.
- Evidence gets its own consistent visual language.
- Avoid generic grey cards, purple gradients, decorative blobs, and dashboard ornament.

Recommended aesthetic:

- Dark left rail for workspace identity and navigation.
- Light work surface for content and evidence.
- Serif or editorial display type for product identity/headlines.
- Monospace only for IDs, digests, locators, and file content.
- Functional colors:
  - green/mint: verified/pass/current.
  - coral/red: failed/risk.
  - blue: selected/version/tag.
  - gold/amber: unverified/caution.

## 6. Why This Is Better Than the Current UI

The current UI improved styling but kept the old interaction:

```text
list -> click detail -> scan modules
```

That is not enough because the product's core value is trust at selection time.

The approved model changes the interaction to:

```text
select skill -> see purpose and evidence immediately -> drill only when needed
```

Benefits:

- Faster for normal users.
- More rigorous for maintainers.
- Makes variants visible without making a lineage graph.
- Makes eval evidence adjacent to distribution.
- Provides a clear home for later diff, promotion, and query features.

## 7. Scope for v0.1 Implementation

In scope:

- Rebuild `/skills` as Decision Workbench.
- Add in-place selected skill state in the frontend.
- Use current mock/read-model data first.
- Preserve routes for:
  - `/skills/:skillId`
  - `/variants/:variantId`
  - `/variants/:variantId/versions/:versionId`
  - `/eval-set-versions/:evalSetVersionId`
  - `/eval-runs/:evalRunId`
- Adjust visual system to match the evidence lab direction.
- Keep responsive layout usable with segmented sections.

Out of scope:

- Real artifact content API.
- Real diff engine.
- Full multi-dimensional query builder.
- Promotion workflow.
- Auth/permissions UI.
- Final marketing/public homepage.

## 8. Acceptance Criteria

The implementation is acceptable when:

1. `/skills` shows catalog, selected skill panel, evidence rail, and matrix preview in one coherent workbench.
2. Selecting a skill updates the selected skill and evidence rail without requiring a full page navigation.
3. The selected skill panel clearly explains what the skill does and exposes a primary use action.
4. The evidence rail shows exact version binding and latest accepted eval result.
5. The matrix preview shows variants and their current verification state.
6. EvalRun and EvalSetVersion pages visually read as evidence notebook/detail pages, not generic tables.
7. Mobile layout does not overlap text or force unreadable cards.
8. `npm run typecheck` and `npm run build` pass in `apps/web`.

## 9. Spec Self-Review

Placeholder scan:

- No TBD or TODO placeholders remain.

Internal consistency:

- Homepage model, detail page model, and visual direction all use the same evidence-chain concept.

Scope check:

- This spec is focused on frontend interaction and visual architecture. It intentionally excludes artifact APIs and backend workflows.

Ambiguity check:

- "Good" is defined as shorter decision path, visible evidence, lower cognitive load, and clear drill-down paths.
