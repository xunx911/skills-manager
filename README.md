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

The formal product workspace lives under `apps/api` and `apps/web`.

### One-command local run

```bash
bash scripts/dev.sh
```

This starts:

- API: `http://127.0.0.1:8000`
- Web: `http://127.0.0.1:3000/skills`

The script uses `uv` for the Python API and installs `apps/web` npm dependencies when `node_modules` is missing. It does not write to your global Python environment.
Local API data is persisted to `.data/skillhub.sqlite3` by default. Override with `SKILLHUB_DATABASE_URL` or `SKILLHUB_DATA_DIR`.

### Manual run

Terminal 1:

```bash
cd apps/api
mkdir -p ../../.data
SKILLHUB_DATABASE_URL=sqlite:///$PWD/../../.data/skillhub.sqlite3 \
uv run uvicorn skillhub.api.main:app --host 127.0.0.1 --port 8000
```

Terminal 2:

```bash
cd apps/web
npm install
SKILLHUB_API_URL=http://127.0.0.1:8000 \
NEXT_PUBLIC_SKILLHUB_API_URL=http://127.0.0.1:8000 \
npm run dev -- --hostname 127.0.0.1 --port 3000
```

### Product flow to try

1. Open `http://127.0.0.1:3000/skills`.
2. Use the left catalog to switch skills.
3. Use the right inspector to create a skill, import a standard skill bundle, create variants, add test cases, edit case versions, and record manual pass/fail eval runs.
4. In `导入 bundle`, upload either:
   - a folder containing root `SKILL.md`, or
   - a zip whose root folder contains `SKILL.md`.
5. `SKILL.md` must start with frontmatter:

```markdown
---
name: security-reviewing
description: Review pull requests for auth and data access regressions.
---

# Security Reviewing
```

The imported bundle is stored as a `skill_bundle` artifact, and the created variant version points to that immutable artifact.

### Verification Commands

Run before pushing changes:

```bash
cd apps/api
uv run pytest
```

```bash
cd apps/web
npm run typecheck
npm run build
```

Smoke-check the running app:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:3000/skills
```

Formal API Alembic migrations live under `apps/api/migrations`; the first migration executes
`apps/api/skillhub/infrastructure/db/schema.sql`.

### Legacy prototype

The older proof-of-concept remains in `demo-backend`, `demo`, and `prototype` for reference. New product work should target `apps/api` and `apps/web`.

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
See [keyword_evaluator.py](examples/evaluators/keyword_evaluator.py) for a minimal evaluator script.

```bash
python -m skillhub_demo.external_runner \
  --variant-version-id version-a-v1 \
  --eval-set-version-id evalset-v1 \
  --strategy external_command \
  --external-command '../demo-backend/.venv/bin/python ../examples/evaluators/keyword_evaluator.py --keyword ownerId'
```

## Main Docs

- [MVP spec](docs/MVP_SPEC.md)
- [API contract](docs/api-contract.md)
- [Eval result import schema](schemas/eval-result-import.schema.json)
- [Eval result import fixture](fixtures/eval-result-import.code-reviewer.json)
- [Design spec](docs/mvp-design-spec.md)
- [SQLite schema spike](docs/sqlite-schema-spike.md)
- [Storage adapter contract](docs/storage-adapter-contract.md)
- [Formal tech stack](docs/formal-tech-stack.md)
- [Formal architecture v0.1](docs/formal-architecture-v0.1.md)
- [Formal UI design v0.1](docs/formal-ui-design.md)
- [Roadmap](docs/roadmap.md)
- [1.0 architecture review](docs/architecture-review-1.0.md)
