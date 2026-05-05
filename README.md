# Skills Manager

Eval-backed SkillHub prototype for managing skill variants, versioned eval sets, manual eval runs, and standard skill bundle snapshots.

## What This Demo Proves

- A `Skill` is a stable hub entry.
- A `Variant` is the maintained best answer for a tag constraint set.
- A `VariantVersion` is an immutable content snapshot.
- An `EvalSetVersion` is a case snapshot.
- An `EvalRun` records pass/fail results for one `VariantVersion + EvalSetVersion`.
- External runners can import a standard eval result JSON and get the same `EvalRun + CaseResult` record.
- Standard skill folders can be imported as `skill_bundle` artifacts and viewed or diffed by version.

## Quick Start

Run the backend first, then the frontend in a second terminal.

### 1. Backend API

```bash
cd demo-backend
python3 -m venv .venv
. .venv/bin/activate
python -m unittest discover -s tests
python -m skillhub_demo.server --port 8788
```

The API will be available at `http://127.0.0.1:8788`.

Notes:

- The backend uses only the Python standard library.
- The virtual environment keeps your global Python install clean.
- Demo mutations are persisted to SQLite at `demo-backend/data/skillhub-demo.sqlite3` by default.
- Imported skill bundle contents are stored under `demo-backend/data/artifacts/` by default.
- On first SQLite startup, existing `demo-backend/data/skillhub-demo.json` state is imported as legacy seed data.
- Use `python -m skillhub_demo.server --store json --data-file /tmp/skillhub-demo.json` for the old JSON-file mode.

### 2. Frontend App

Open a second terminal:

```bash
cd demo
npm install
npm run dev
```

The app will be available at `http://127.0.0.1:5173`.

### Verification Commands

```bash
cd demo-backend
. .venv/bin/activate
python -m unittest discover -s tests
```

```bash
cd demo
npm run build
```

### External Eval Import Smoke

With the backend running:

```bash
cd demo-backend
. .venv/bin/activate
python -m skillhub_demo.external_runner \
  --variant-version-id version-a-v1 \
  --eval-set-version-id evalset-v1 \
  --fail-case-title-contains 仅重命名
```

To connect a real local evaluator, use the `external_command` strategy. The command receives
`{"eval_set": ...}` on stdin and prints `{ "results": { "<case_version_id>": true } }`.

## Main Docs

- [MVP spec](docs/MVP_SPEC.md)
- [API contract](docs/api-contract.md)
- [Eval result import schema](schemas/eval-result-import.schema.json)
- [Eval result import fixture](fixtures/eval-result-import.code-reviewer.json)
- [Design spec](docs/mvp-design-spec.md)
- [SQLite schema spike](docs/sqlite-schema-spike.md)
- [Storage adapter contract](docs/storage-adapter-contract.md)
- [Roadmap](docs/roadmap.md)
- [1.0 architecture review](docs/architecture-review-1.0.md)
