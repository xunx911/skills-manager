# SkillHub Product UX Review

Last updated: 2026-05-08

## Current Working Flow

- `/skills` is a tri-pane workbench: catalog, focused workspace, contextual inspector.
- Users can create a skill, import a standard skill folder or zip, create variants, add/edit/archive eval cases, and record manual pass/fail eval runs.
- The API persists local data to `.data/skillhub.sqlite3` through `scripts/dev.sh`.
- Empty databases show a real first-run state with import/new-skill actions instead of pretending sample data is persisted workspace data.
- Manual eval runs require every case to be explicitly marked pass or fail before submission.
- Playwright browser tests cover invalid folder import, zipped bundle import, the critical happy path, keyboard activation for primary inspector actions, edit/archive case management, and a mobile viewport width check.

## Borrowed Product Patterns

- Linear-style workspace density: one selected object, a compact left catalog, and a right inspector for contextual operations.
- GitHub-style import affordance: a bundle import has an explicit source, validates the contract, creates a versioned immutable artifact, and exposes bundle files through the read model.
- Claude Skills-style bundle contract: `SKILL.md` is the required root entry, and frontmatter supplies the product-facing name and description.

## Friction Found

1. The right inspector is functional but still form-heavy. Frequent actions such as adding a case and recording a run should become a guided flow with fewer visible fields at once.
2. Imported bundles expose a file list and `SKILL.md`, but version-to-version file diff is still not first-class in the main workbench.
3. Case editing creates a new case version, but the workbench does not yet show per-case version history inline.
4. Manual eval runs are explicit and safer, but the user cannot yet filter or compare historical runs in a table.
5. Import preview works for folders; zip preview still waits for backend validation because browser-side zip parsing is not implemented.
6. Browser interaction coverage now covers the highest-risk paths, but still lacks detailed visual regression screenshots and richer accessibility assertions.

## Next Optimization Queue

1. Add a guided case/eval flow: collapse advanced fields, keep pass/fail confirmation central, and reduce inspector form density.
2. Add bundle version diff: compare current vs previous variant version at file level, with changed/added/removed markers.
3. Add inline eval case history: each case row should expose previous versions and the eval set versions that included them.
4. Add a run history table: filter by variant version, eval set version, result, strategy, and created date.
5. Expand browser-level interaction tests with visual screenshot regression and richer accessibility assertions.
