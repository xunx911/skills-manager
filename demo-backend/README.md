# SkillHub Demo Backend

Python-only demo backend for validating the SkillHub domain model.

It intentionally uses only the Python standard library:

- no global packages
- SQLite runtime persistence by default
- JSON-file persistence remains available as a legacy/dev mode
- JSON API over `http.server`

## Setup

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m unittest
python -m skillhub_demo.server --port 8788
```

By default, mutations are saved to `data/skillhub-demo.sqlite3`, and imported skill bundle
contents are saved under `data/artifacts/`. If `data/skillhub-demo.json` exists and the SQLite
file has no snapshot yet, the server imports that JSON state once.

Use JSON mode when you want a disposable text file:

```bash
python -m skillhub_demo.server --store json --data-file /tmp/skillhub-demo.json
```

Use a disposable SQLite file:

```bash
python -m skillhub_demo.server --sqlite-file /tmp/skillhub-demo.sqlite3
```

## API Sketch

- `GET /health`
- `GET /api/state`
- `GET /api/skills`
- `GET /api/skill?skill_id=skill-code-reviewer`
- `POST /api/skills`
- `PATCH /api/skills`
- `GET /api/variant-page?variant_id=variant-a&version_id=version-a-v1&eval_set_version_id=evalset-v1`
- `GET /api/eval-set?eval_set_version_id=evalset-v1`
- `GET /api/eval-result?variant_version_id=version-a-v1&eval_set_version_id=evalset-v1`
- `GET /api/skill-bundle?artifact_id=artifact-skill-bundle-code-reviewer-bundle-abc123`
- `POST /api/variants`
- `PATCH /api/variants`
- `POST /api/skill-bundles`
- `POST /api/eval-cases`
- `POST /api/eval-case-versions`
- `POST /api/variant-versions`
- `POST /api/eval-runs`
- `POST /api/reset`

The core invariant is:

```text
Skill -> default Variant -> current VariantVersion
EvalRun -> VariantVersion + EvalSetVersion
EvalCase -> current EvalCaseVersion
EvalSetVersion -> ordered EvalCaseVersion snapshot
CaseResult -> pass/fail for one EvalCaseVersion
```
