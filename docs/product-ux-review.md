# SkillHub Product UX Review

Last updated: 2026-05-07

## Current Working Flow

- `/skills` is a tri-pane workbench: catalog, focused workspace, contextual inspector.
- Users can create a skill, import a standard skill folder or zip, create variants, add/edit/archive eval cases, and record manual pass/fail eval runs.
- The API persists local data to `.data/skillhub.sqlite3` through `scripts/dev.sh`.
- Empty databases show sample read-model data so the product is understandable on first launch.

## Borrowed Product Patterns

- Linear-style workspace density: one selected object, a compact left catalog, and a right inspector for contextual operations.
- GitHub-style import affordance: a bundle import has an explicit source, validates the contract, and creates a versioned immutable artifact.
- Claude Skills-style bundle contract: `SKILL.md` is the required root entry, and frontmatter supplies the product-facing name and description.

## Friction Found

1. The right inspector is functional but still form-heavy. Frequent actions such as adding a case and recording a run should become a guided flow with fewer visible fields at once.
2. Imported bundles currently show the `SKILL.md` content, but not a navigable file tree or diff between versions. Version review still feels weaker than GitHub.
3. Empty API state falls back to sample data. This helps first launch, but the UI should clearly mark sample data as sample to avoid confusing it with persisted data.
4. Case editing creates a new case version, but the workbench does not yet show per-case version history inline.
5. Manual eval runs are easy to record, but the user cannot yet filter or compare historical runs in a table.
6. Import errors are readable, but the form does not preview detected `SKILL.md` metadata before submitting.

## Next Optimization Queue

1. Add an import preview step: after selecting a folder or zip, parse `SKILL.md` in the browser, show name, description, file count, and warnings before submit.
2. Add bundle file tree and version diff: show all imported files, highlight `SKILL.md`, and compare current vs previous variant version.
3. Add inline eval case history: each case row should expose its previous versions and the eval set versions that included them.
4. Add a run history table: filter by variant version, eval set version, result, strategy, and created date.
5. Add sample-data marker and first-run CTA: distinguish example data from persisted workspace data.
