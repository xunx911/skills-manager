# Skills Manager

Eval-backed SkillHub prototype for managing skill variants, versioned eval sets, manual eval runs, and standard skill bundle snapshots.

## What This Demo Proves

- A `Skill` is a stable hub entry.
- A `Variant` is the maintained best answer for a tag constraint set.
- A `VariantVersion` is an immutable content snapshot.
- An `EvalSetVersion` is a case snapshot.
- An `EvalRun` records pass/fail results for one `VariantVersion + EvalSetVersion`.
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
- Demo mutations are persisted to `demo-backend/data/skillhub-demo.json`.

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

## Main Docs

- [MVP spec](docs/MVP_SPEC.md)
- [API contract](docs/api-contract.md)
- [Design spec](docs/mvp-design-spec.md)
