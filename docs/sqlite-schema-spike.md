# SQLite Schema Spike

This spike validates that the current JSON object graph can be mapped to relational tables without changing the MVP domain model.

## Scope

Included:

- Create SQLite tables for the current MVP objects.
- Import an `AppData` object into SQLite.
- Preserve append-only facts for `VariantVersion`, `EvalSetVersion`, `EvalRun`, and `CaseResult`.
- Query case details for an `EvalSetVersion`.
- Query pass/fail counts for `VariantVersion + EvalSetVersion`.
- Use foreign keys to reject broken references.

Not included:

- Replacing the JSON persistence backend.
- Migrations.
- Auth, tenancy, archive/deprecate workflows.
- Automatic eval execution.

## Key Mapping Decisions

| Domain object | SQLite mapping |
| --- | --- |
| `Skill` | `skills`, with `default_variant_ref` as a pointer. |
| `TagSet` | `tag_sets`, with tags stored as JSON because tags are a small normalized value object. |
| `Variant` | `variants`, with `current_version_ref` as a pointer. |
| `VariantVersion` | `variant_versions`, with `content_ref` split into columns. |
| `EvalCorpus` | `eval_corpora`, one corpus per skill for MVP. |
| `EvalCase` | `eval_cases`, with input and expected output stored as artifact refs. |
| `EvalSetVersion` | `eval_set_versions` plus `eval_set_cases` join table. |
| `EvalRun` | `eval_runs`, bound to one variant version and one eval set version. |
| `CaseResult` | `case_results`, keyed by `run_ref + case_ref`. |
| `Artifact` | `artifacts`, storing eval inputs, expected outputs, reports, and skill bundle snapshots. |

The important point is `eval_set_cases`: a measured eval set is a snapshot of case membership and order. It should not remain an opaque JSON array once we move to a database.

## Current Implementation

Code lives in:

- `demo-backend/skillhub_demo/sqlite_store.py`
- `demo-backend/tests/test_sqlite_store.py`

Run:

```bash
cd demo-backend
. .venv/bin/activate
python -m unittest discover -s tests
```

The spike currently uses in-memory SQLite in tests. It is deliberately separate from the HTTP backend so we can validate schema shape before committing to a storage migration.

## Result

The spike confirms:

- Seed data imports into normalized tables.
- `version-a-v1 + evalset-v1` produces the same result counts as the JSON store: `2 passed / 1 failed / 0 missing`.
- Eval set pages can retrieve concrete case input and expected output from artifact joins.
- Foreign keys reject broken `VariantVersion.variant_ref` references.

## Next Decision

SQLite is a viable next persistence layer for the local MVP. The next implementation step should be a repository interface that can be backed by either:

- current JSON file persistence, or
- SQLite tables from this spike.

Do not wire SQLite directly into handlers until that boundary exists.
