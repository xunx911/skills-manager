# SkillHub Demo Backend

Python-only demo backend for validating the SkillHub domain model.

It intentionally uses only the Python standard library:

- no global packages
- SQLite runtime persistence by default
- JSON-file persistence remains available as a legacy/dev mode
- JSON API over `http.server`

The external eval import contract is stored at `../schemas/eval-result-import.schema.json`,
with a runnable fixture at `../fixtures/eval-result-import.code-reviewer.json`.

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

## Minimal External Runner

The runner reads the target eval set from the API, builds a standard import payload with the
returned `case_version_refs`, and posts it back to `/api/eval-result-imports`.

```bash
python -m skillhub_demo.external_runner \
  --variant-version-id version-a-v1 \
  --eval-set-version-id evalset-v1 \
  --fail-case-title-contains 仅重命名
```

Use `--dry-run` to print the payload without importing it.

Available demo strategies:

- `all_pass`: marks every case as passed.
- `title_contains_fail`: marks cases as failed by `--fail-case-version-id` or `--fail-case-title-contains`.
- `expected_keyword`: marks a case as passed when its expected output or expectation contains `--expected-keyword`.
- `external_command`: runs `--external-command`, passes `{"eval_set": ...}` on stdin, and expects JSON results on stdout.

Example external command output:

```json
{
  "results": {
    "casever-null-v1": true,
    "casever-auth-v1": false
  }
}
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
- `POST /api/eval-result-imports`
- `POST /api/reset`

The core invariant is:

```text
Skill -> default Variant -> current VariantVersion
EvalRun -> VariantVersion + EvalSetVersion
EvalCase -> current EvalCaseVersion
EvalSetVersion -> ordered EvalCaseVersion snapshot
CaseResult -> pass/fail for one EvalCaseVersion
External eval import -> EvalRun + result artifact
```
