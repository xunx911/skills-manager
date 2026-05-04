# SQLite Schema Spike

This spike validates that the current JSON object graph can be mapped to relational tables without changing the MVP domain model.

## Scope

Included:

- Create SQLite tables for the current MVP objects.
- Import an `AppData` object into SQLite.
- Persist and reload a full `AppData` snapshot for the demo runtime.
- Mirror the runtime snapshot into normalized tables after each save.
- Preserve append-only facts for `VariantVersion`, `EvalSetVersion`, `EvalRun`, and `CaseResult`.
- Query case details for an `EvalSetVersion`.
- Query pass/fail counts for `VariantVersion + EvalSetVersion`.
- Serve the hub, skill, variant, eval-set, and eval-result read paths from SQL when the SQLite repository is active.
- Track an explicit SQLite schema version in `schema_meta` with a migration hook for future versions.
- Use foreign keys to reject broken references.

Not included:

- Multi-version migrations beyond the current initial schema.
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
| `AppData` snapshot | `app_state`, one full JSON snapshot used by the demo repository for exact round-trip loading. |
| Schema metadata | `schema_meta`, stores the current schema version for migration discipline. |

The important point is `eval_set_cases`: a measured eval set is a snapshot of case membership and order. It should not remain an opaque JSON array once we move to a database.

## Current Implementation

Code lives in:

- `demo-backend/skillhub_demo/sqlite_store.py`
- `demo-backend/skillhub_demo/repository.py`
- `demo-backend/tests/test_sqlite_store.py`
- `demo-backend/tests/test_repository.py`

Run:

```bash
cd demo-backend
. .venv/bin/activate
python -m unittest discover -s tests
```

The backend now uses a repository boundary:

- `SqliteRepository` is the default runtime persistence.
- `JsonFileRepository` remains available with `--store json`.
- SQLite stores the exact runtime state in `app_state` and refreshes normalized tables after each save.
- `GET /api/skills`, `GET /api/skill`, `GET /api/variant-page`, `GET /api/eval-set`, and `GET /api/eval-result` use SQL read models when SQLite is active.

This is intentionally a bridge implementation. It lets the demo run on SQLite now without prematurely rewriting every CRUD path as SQL.

## Result

The spike confirms:

- Seed data imports into normalized tables.
- Runtime mutations round-trip through SQLite.
- The hub, skill, and variant SQL read models match the existing domain store API shape.
- The eval-result SQL read model uses the latest finished run for a given `VariantVersion + EvalSetVersion`.
- `version-a-v1 + evalset-v1` produces the same result counts as the JSON store: `2 passed / 1 failed / 0 missing`.
- Eval set pages can retrieve concrete case input and expected output from artifact joins.
- Foreign keys reject broken `VariantVersion.variant_ref` references.

## Next Decision

SQLite is viable for the local MVP. The next storage step is migration discipline:

- add real multi-step migrations when schema version 2 appears,
- move more high-value read paths from snapshot reads to SQL queries,
- keep append-only entities append-only at the database level,
- decide later whether skill bundle blobs should stay in SQLite, move to filesystem object storage, or move to Git-backed storage.
