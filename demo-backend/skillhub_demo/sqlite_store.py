from __future__ import annotations

import json
import sqlite3
from typing import Any, Dict, Iterable, List, Tuple

from .models import AppData, to_jsonable
from .persistence import app_data_from_dict


SCHEMA_VERSION = 3
MIGRATIONS: Dict[int, str] = {
    2: """
    ALTER TABLE skills ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE skills ADD COLUMN archived_at TEXT;
    ALTER TABLE variants ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'active';
    ALTER TABLE variants ADD COLUMN archived_at TEXT;
    """,
    3: """
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS case_results;
    DROP TABLE IF EXISTS eval_runs;
    DROP TABLE IF EXISTS eval_set_cases;
    DROP TABLE IF EXISTS eval_set_versions;
    DROP TABLE IF EXISTS eval_case_versions;
    DROP TABLE IF EXISTS eval_cases;
    DROP TABLE IF EXISTS eval_corpora;
    PRAGMA foreign_keys = ON;
    """,
}

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  owner_ref TEXT NOT NULL,
  default_variant_ref TEXT,
  created_at TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL DEFAULT 'active',
  archived_at TEXT,
  FOREIGN KEY (default_variant_ref) REFERENCES variants(id)
);

CREATE TABLE IF NOT EXISTS tag_sets (
  id TEXT PRIMARY KEY,
  tags_hash TEXT NOT NULL UNIQUE,
  tags_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  media_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  skill_ref TEXT NOT NULL,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  summary TEXT NOT NULL,
  tag_set_ref TEXT NOT NULL,
  current_version_ref TEXT,
  created_at TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL DEFAULT 'active',
  archived_at TEXT,
  FOREIGN KEY (skill_ref) REFERENCES skills(id),
  FOREIGN KEY (tag_set_ref) REFERENCES tag_sets(id),
  FOREIGN KEY (current_version_ref) REFERENCES variant_versions(id)
);

CREATE TABLE IF NOT EXISTS variant_versions (
  id TEXT PRIMARY KEY,
  variant_ref TEXT NOT NULL,
  version TEXT NOT NULL,
  content_kind TEXT NOT NULL,
  content_locator TEXT NOT NULL,
  content_digest TEXT NOT NULL,
  content_path TEXT,
  change_note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (variant_ref) REFERENCES variants(id),
  UNIQUE (variant_ref, version)
);

CREATE TABLE IF NOT EXISTS eval_corpora (
  id TEXT PRIMARY KEY,
  skill_ref TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (skill_ref) REFERENCES skills(id)
);

CREATE TABLE IF NOT EXISTS eval_cases (
  id TEXT PRIMARY KEY,
  corpus_ref TEXT NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  current_version_ref TEXT,
  origin_ref TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (corpus_ref) REFERENCES eval_corpora(id),
  FOREIGN KEY (current_version_ref) REFERENCES eval_case_versions(id)
);

CREATE TABLE IF NOT EXISTS eval_case_versions (
  id TEXT PRIMARY KEY,
  case_ref TEXT NOT NULL,
  version TEXT NOT NULL,
  input_artifact_ref TEXT NOT NULL,
  expectation_artifact_ref TEXT NOT NULL,
  grader_ref TEXT NOT NULL,
  expectation TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (case_ref) REFERENCES eval_cases(id),
  FOREIGN KEY (input_artifact_ref) REFERENCES artifacts(id),
  FOREIGN KEY (expectation_artifact_ref) REFERENCES artifacts(id),
  UNIQUE (case_ref, version)
);

CREATE TABLE IF NOT EXISTS eval_set_versions (
  id TEXT PRIMARY KEY,
  corpus_ref TEXT NOT NULL,
  version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (corpus_ref) REFERENCES eval_corpora(id),
  UNIQUE (corpus_ref, version)
);

CREATE TABLE IF NOT EXISTS eval_set_cases (
  eval_set_version_ref TEXT NOT NULL,
  case_version_ref TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (eval_set_version_ref, case_version_ref),
  FOREIGN KEY (eval_set_version_ref) REFERENCES eval_set_versions(id),
  FOREIGN KEY (case_version_ref) REFERENCES eval_case_versions(id)
);

CREATE TABLE IF NOT EXISTS eval_runs (
  id TEXT PRIMARY KEY,
  variant_version_ref TEXT NOT NULL,
  eval_set_version_ref TEXT NOT NULL,
  strategy_ref TEXT NOT NULL,
  run_config_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  result_artifact_ref TEXT,
  FOREIGN KEY (variant_version_ref) REFERENCES variant_versions(id),
  FOREIGN KEY (eval_set_version_ref) REFERENCES eval_set_versions(id),
  FOREIGN KEY (result_artifact_ref) REFERENCES artifacts(id)
);

CREATE TABLE IF NOT EXISTS case_results (
  run_ref TEXT NOT NULL,
  case_version_ref TEXT NOT NULL,
  passed INTEGER NOT NULL CHECK (passed IN (0, 1)),
  score INTEGER NOT NULL,
  PRIMARY KEY (run_ref, case_version_ref),
  FOREIGN KEY (run_ref) REFERENCES eval_runs(id),
  FOREIGN KEY (case_version_ref) REFERENCES eval_case_versions(id)
);

CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


def connect(path: str = ":memory:") -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize(connection: sqlite3.Connection) -> None:
    connection.executescript(SCHEMA)
    _migrate_schema(connection)


def _migrate_schema(connection: sqlite3.Connection) -> None:
    row = connection.execute("SELECT version FROM schema_meta WHERE id = 1").fetchone()
    if row is None:
        with connection:
            connection.execute(
                "INSERT INTO schema_meta (id, version, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP)",
                (SCHEMA_VERSION,),
            )
        return

    version = int(row["version"])
    if version > SCHEMA_VERSION:
        raise RuntimeError("SQLite schema version %d is newer than supported version %d" % (version, SCHEMA_VERSION))
    for next_version in range(version + 1, SCHEMA_VERSION + 1):
        migration = MIGRATIONS.get(next_version)
        if migration:
            connection.executescript(migration)
        with connection:
            connection.execute(
                "UPDATE schema_meta SET version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
                (next_version,),
            )


def set_schema_version_for_test(connection: sqlite3.Connection, version: int) -> None:
    connection.executescript(SCHEMA)
    with connection:
        connection.execute(
            """
            INSERT INTO schema_meta (id, version, updated_at)
            VALUES (1, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET version = excluded.version, updated_at = CURRENT_TIMESTAMP
            """,
            (version,),
        )


def current_schema_version(connection: sqlite3.Connection) -> int:
    initialize(connection)
    row = connection.execute("SELECT version FROM schema_meta WHERE id = 1").fetchone()
    return int(row["version"])


def import_app_data(connection: sqlite3.Connection, data: AppData) -> None:
    initialize(connection)
    with connection:
        _insert_tag_sets(connection, data)
        _insert_artifacts(connection, data)
        _insert_skills_without_default(connection, data)
        _insert_variants_without_current(connection, data)
        _insert_variant_versions(connection, data)
        _update_variant_current_versions(connection, data)
        _update_skill_default_variants(connection, data)
        _insert_eval_corpora(connection, data)
        _insert_eval_cases(connection, data)
        _insert_eval_case_versions(connection, data)
        _update_eval_case_current_versions(connection, data)
        _insert_eval_set_versions(connection, data)
        _insert_eval_runs(connection, data)
        _insert_case_results(connection, data)


def replace_app_data(connection: sqlite3.Connection, data: AppData) -> None:
    initialize(connection)
    _drop_domain_tables(connection)
    import_app_data(connection, data)


def save_app_snapshot(connection: sqlite3.Connection, data: AppData) -> None:
    replace_app_data(connection, data)
    state_json = json.dumps(to_jsonable(data), ensure_ascii=False, sort_keys=True)
    with connection:
        connection.execute(
            """
            INSERT INTO app_state (id, state_json, updated_at)
            VALUES (1, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = CURRENT_TIMESTAMP
            """,
            (state_json,),
        )


def load_app_snapshot(connection: sqlite3.Connection) -> AppData | None:
    initialize(connection)
    row = connection.execute("SELECT state_json FROM app_state WHERE id = 1").fetchone()
    if row is None:
        return None
    raw = json.loads(row["state_json"])
    if not isinstance(raw, dict):
        raise ValueError("SQLite app_state.state_json must be an object")
    return app_data_from_dict(raw)


def skills_overview(connection: sqlite3.Connection) -> List[Dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT id, default_variant_ref
        FROM skills
        WHERE lifecycle_status = 'active'
        ORDER BY created_at, id
        """
    ).fetchall()
    pages = []
    for row in rows:
        eval_set = latest_eval_set_for_skill(connection, row["id"])
        pages.append(variant_page(connection, row["default_variant_ref"], None, eval_set["id"]))
    return pages


def skill_detail(connection: sqlite3.Connection, skill_id: str) -> Dict[str, Any]:
    skill = _skill_row(connection, skill_id)
    variants = [
        _variant_payload(row)
        for row in connection.execute(
            """
            SELECT id, skill_ref, name, label, summary, tag_set_ref, current_version_ref, created_at, lifecycle_status, archived_at
            FROM variants
            WHERE skill_ref = ?
            ORDER BY created_at, id
            """,
            (skill_id,),
        ).fetchall()
    ]
    return {
        "skill": _compact(dict(skill)),
        "variants": variants,
        "eval_set_version": latest_eval_set_for_skill(connection, skill_id),
    }


def variant_page(
    connection: sqlite3.Connection,
    variant_id: str,
    version_id: str | None,
    eval_set_version_id: str,
) -> Dict[str, Any]:
    variant = _variant_row(connection, variant_id)
    selected_version_id = version_id or variant["current_version_ref"]
    version = _variant_version_row(connection, selected_version_id)
    eval_set = eval_set_detail(connection, eval_set_version_id)["eval_set_version"]
    history = [
        _variant_version_payload(row)
        for row in connection.execute(
            """
            SELECT
              id,
              variant_ref,
              version,
              content_kind,
              content_locator,
              content_digest,
              content_path,
              change_note,
              created_at
            FROM variant_versions
            WHERE variant_ref = ?
            ORDER BY created_at DESC, id DESC
            """,
            (variant_id,),
        ).fetchall()
    ]
    counts = eval_result_counts(connection, selected_version_id, eval_set_version_id)
    return {
        "variant": _variant_payload(variant),
        "variant_version": _variant_version_payload(version),
        "tags": tags_for_variant(connection, variant_id),
        "history": history,
        "eval_set_version": eval_set,
        "score": _score_from_counts(counts),
        "result_counts": counts,
        "content_ref": _content_ref_payload(version),
        "verification_runs": _verification_runs(connection, variant["skill_ref"], selected_version_id),
    }


def latest_eval_set_for_skill(connection: sqlite3.Connection, skill_id: str) -> Dict[str, Any]:
    row = _required_row(
        connection,
        """
        SELECT esv.id, esv.corpus_ref, esv.version, esv.created_at
        FROM eval_set_versions esv
        JOIN eval_corpora ec ON ec.id = esv.corpus_ref
        WHERE ec.skill_ref = ?
        ORDER BY esv.created_at DESC, esv.id DESC
        LIMIT 1
        """,
        (skill_id,),
        "No eval set version for skill %s" % skill_id,
    )
    case_version_refs = _eval_set_case_version_refs(connection, row["id"])
    return {**dict(row), "case_version_refs": case_version_refs, "case_refs": case_version_refs}


def tags_for_variant(connection: sqlite3.Connection, variant_id: str) -> List[str]:
    row = _required_row(
        connection,
        """
        SELECT ts.tags_json
        FROM variants v
        JOIN tag_sets ts ON ts.id = v.tag_set_ref
        WHERE v.id = ?
        """,
        (variant_id,),
        "Unknown variant %s" % variant_id,
    )
    tags = json.loads(row["tags_json"])
    if not isinstance(tags, list) or not all(isinstance(item, str) for item in tags):
        raise ValueError("Invalid tag set JSON for variant %s" % variant_id)
    return tags


def eval_result_counts(connection: sqlite3.Connection, variant_version_id: str, eval_set_version_id: str) -> Dict[str, int]:
    latest_run_id = _latest_finished_run_id(connection, variant_version_id, eval_set_version_id)
    rows = connection.execute(
        """
        SELECT esc.case_version_ref, cr.passed
        FROM eval_set_cases esc
        LEFT JOIN case_results cr
          ON cr.run_ref = ?
         AND cr.case_version_ref = esc.case_version_ref
        WHERE esc.eval_set_version_ref = ?
        ORDER BY esc.position
        """,
        (latest_run_id, eval_set_version_id),
    ).fetchall()
    counts = {"passed": 0, "failed": 0, "missing": 0, "total": len(rows)}
    for row in rows:
        if row["passed"] is None:
            counts["missing"] += 1
        elif row["passed"]:
            counts["passed"] += 1
        else:
            counts["failed"] += 1
    return counts


def eval_set_case_details(connection: sqlite3.Connection, eval_set_version_id: str) -> Iterable[Dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT
          ecv.id AS id,
          ec.id AS case_ref,
          ec.corpus_ref,
          ec.title,
          ec.source_type,
          ec.current_version_ref,
          ec.origin_ref,
          ecv.id AS case_version_ref,
          ecv.version AS case_version,
          ecv.input_artifact_ref,
          ecv.expectation_artifact_ref,
          ecv.grader_ref,
          ecv.expectation,
          ecv.created_at,
          input.content AS input,
          expected.content AS expected_output
        FROM eval_set_cases esc
        JOIN eval_case_versions ecv ON ecv.id = esc.case_version_ref
        JOIN eval_cases ec ON ec.id = ecv.case_ref
        JOIN artifacts input ON input.id = ecv.input_artifact_ref
        JOIN artifacts expected ON expected.id = ecv.expectation_artifact_ref
        WHERE esc.eval_set_version_ref = ?
        ORDER BY esc.position
        """,
        (eval_set_version_id,),
    ).fetchall()
    return [
        _compact(
            {
                **dict(row),
                "case_version": {
                    "id": row["case_version_ref"],
                    "case_ref": row["case_ref"],
                    "version": row["case_version"],
                    "input_artifact_ref": row["input_artifact_ref"],
                    "expectation_artifact_ref": row["expectation_artifact_ref"],
                    "grader_ref": row["grader_ref"],
                    "expectation": row["expectation"],
                    "created_at": row["created_at"],
                },
            }
        )
        for row in rows
    ]


def eval_set_detail(connection: sqlite3.Connection, eval_set_version_id: str) -> Dict[str, Any]:
    eval_set = _required_row(
        connection,
        "SELECT id, corpus_ref, version, created_at FROM eval_set_versions WHERE id = ?",
        (eval_set_version_id,),
        "Unknown eval set version %s" % eval_set_version_id,
    )
    case_version_refs = _eval_set_case_version_refs(connection, eval_set_version_id)
    return {
        "eval_set_version": {
            **dict(eval_set),
            "case_version_refs": case_version_refs,
            "case_refs": case_version_refs,
        },
        "cases": list(eval_set_case_details(connection, eval_set_version_id)),
    }


def eval_result_detail(connection: sqlite3.Connection, variant_version_id: str, eval_set_version_id: str) -> Dict[str, Any]:
    version = _variant_version_row(connection, variant_version_id)
    variant = _variant_row(connection, version["variant_ref"])
    eval_set_payload = eval_set_detail(connection, eval_set_version_id)
    latest_run_id = _latest_finished_run_id(connection, variant_version_id, eval_set_version_id)
    counts = eval_result_counts(connection, variant_version_id, eval_set_version_id)
    score = None
    if counts["total"] > 0 and counts["missing"] == 0:
        score = counts["passed"] / counts["total"]

    cases = []
    for case in eval_set_payload["cases"]:
        result_row = None
        if latest_run_id is not None:
            result_row = connection.execute(
                "SELECT run_ref, case_version_ref, passed, score FROM case_results WHERE run_ref = ? AND case_version_ref = ?",
                (latest_run_id, case["id"]),
            ).fetchone()
        result = None
        if result_row is not None:
            result = {
                "run_ref": result_row["run_ref"],
                "case_version_ref": result_row["case_version_ref"],
                "case_ref": result_row["case_version_ref"],
                "passed": bool(result_row["passed"]),
                "score": result_row["score"],
            }
        cases.append({**case, "result": result})

    return {
        "variant": _variant_payload(variant),
        "variant_version": _variant_version_payload(version),
        "eval_set_version": eval_set_payload["eval_set_version"],
        "score": score,
        "result_counts": counts,
        "cases": cases,
    }


def _latest_finished_run_id(connection: sqlite3.Connection, variant_version_id: str, eval_set_version_id: str) -> str | None:
    row = connection.execute(
        """
        SELECT id
        FROM eval_runs
        WHERE variant_version_ref = ?
          AND eval_set_version_ref = ?
          AND status = 'finished'
        ORDER BY started_at DESC
        LIMIT 1
        """,
        (variant_version_id, eval_set_version_id),
    ).fetchone()
    return row["id"] if row is not None else None


def _verification_runs(connection: sqlite3.Connection, skill_id: str, variant_version_id: str) -> List[Dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT esv.id, esv.corpus_ref, esv.version, esv.created_at
        FROM eval_set_versions esv
        JOIN eval_corpora ec ON ec.id = esv.corpus_ref
        WHERE ec.skill_ref = ?
        ORDER BY esv.created_at DESC, esv.id DESC
        """,
        (skill_id,),
    ).fetchall()
    runs = []
    for row in rows:
        case_version_refs = _eval_set_case_version_refs(connection, row["id"])
        eval_set = {**dict(row), "case_version_refs": case_version_refs, "case_refs": case_version_refs}
        run = _latest_finished_run(connection, variant_version_id, row["id"])
        counts = eval_result_counts(connection, variant_version_id, row["id"])
        runs.append(
            {
                "eval_set_version": eval_set,
                "eval_run": run,
                "score": _score_from_counts(counts),
                "result_counts": counts,
            }
        )
    return runs


def _latest_finished_run(connection: sqlite3.Connection, variant_version_id: str, eval_set_version_id: str) -> Dict[str, Any] | None:
    row = connection.execute(
        """
        SELECT
          id,
          variant_version_ref,
          eval_set_version_ref,
          strategy_ref,
          run_config_hash,
          status,
          started_at,
          finished_at,
          result_artifact_ref
        FROM eval_runs
        WHERE variant_version_ref = ?
          AND eval_set_version_ref = ?
          AND status = 'finished'
        ORDER BY started_at DESC
        LIMIT 1
        """,
        (variant_version_id, eval_set_version_id),
    ).fetchone()
    return _compact(dict(row)) if row is not None else None


def _score_from_counts(counts: Dict[str, int]) -> float | None:
    if counts["total"] == 0 or counts["missing"] > 0:
        return None
    return counts["passed"] / counts["total"]


def _eval_set_case_version_refs(connection: sqlite3.Connection, eval_set_version_id: str) -> List[str]:
    return [
        row["case_version_ref"]
        for row in connection.execute(
            "SELECT case_version_ref FROM eval_set_cases WHERE eval_set_version_ref = ? ORDER BY position",
            (eval_set_version_id,),
        ).fetchall()
    ]


def _skill_row(connection: sqlite3.Connection, skill_id: str) -> sqlite3.Row:
    return _required_row(
        connection,
        "SELECT id, slug, owner_ref, default_variant_ref, created_at, lifecycle_status, archived_at FROM skills WHERE id = ?",
        (skill_id,),
        "Unknown skill %s" % skill_id,
    )


def _variant_row(connection: sqlite3.Connection, variant_id: str) -> sqlite3.Row:
    return _required_row(
        connection,
        """
        SELECT id, skill_ref, name, label, summary, tag_set_ref, current_version_ref, created_at, lifecycle_status, archived_at
        FROM variants
        WHERE id = ?
        """,
        (variant_id,),
        "Unknown variant %s" % variant_id,
    )


def _variant_version_row(connection: sqlite3.Connection, variant_version_id: str) -> sqlite3.Row:
    return _required_row(
        connection,
        """
        SELECT
          id,
          variant_ref,
          version,
          content_kind,
          content_locator,
          content_digest,
          content_path,
          change_note,
          created_at
        FROM variant_versions
        WHERE id = ?
        """,
        (variant_version_id,),
        "Unknown variant version %s" % variant_version_id,
    )


def _variant_payload(row: sqlite3.Row) -> Dict[str, Any]:
    return _compact(dict(row))


def _variant_version_payload(row: sqlite3.Row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "variant_ref": row["variant_ref"],
        "version": row["version"],
        "content_ref": {
            "kind": row["content_kind"],
            "locator": row["content_locator"],
            "digest": row["content_digest"],
            "path": row["content_path"],
        },
        "change_note": row["change_note"],
        "created_at": row["created_at"],
    }


def _content_ref_payload(row: sqlite3.Row) -> Dict[str, Any]:
    return _compact(
        {
            "kind": row["content_kind"],
            "locator": row["content_locator"],
            "digest": row["content_digest"],
            "path": row["content_path"],
        }
    )


def _compact(payload: Dict[str, Any]) -> Dict[str, Any]:
    return {key: value for key, value in payload.items() if value is not None}


def _required_row(connection: sqlite3.Connection, query: str, params: Tuple[Any, ...], message: str) -> sqlite3.Row:
    row = connection.execute(query, params).fetchone()
    if row is None:
        raise KeyError(message)
    return row


def _drop_domain_tables(connection: sqlite3.Connection) -> None:
    tables: Tuple[str, ...] = (
        "case_results",
        "eval_runs",
        "eval_set_cases",
        "eval_set_versions",
        "eval_case_versions",
        "eval_cases",
        "eval_corpora",
        "variant_versions",
        "variants",
        "skills",
        "tag_sets",
        "artifacts",
    )
    with connection:
        connection.execute("PRAGMA foreign_keys = OFF")
        for table in tables:
            connection.execute("DROP TABLE IF EXISTS %s" % table)
        connection.execute("PRAGMA foreign_keys = ON")


def _insert_tag_sets(connection: sqlite3.Connection, data: AppData) -> None:
    connection.executemany(
        "INSERT INTO tag_sets (id, tags_hash, tags_json) VALUES (?, ?, ?)",
        [(item.id, item.tags_hash, json.dumps(item.tags, ensure_ascii=False)) for item in data.tag_sets],
    )


def _insert_artifacts(connection: sqlite3.Connection, data: AppData) -> None:
    connection.executemany(
        """
        INSERT INTO artifacts (id, kind, content, content_hash, media_type, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [(item.id, item.kind, item.content, item.content_hash, item.media_type, item.created_at) for item in data.artifacts],
    )


def _insert_skills_without_default(connection: sqlite3.Connection, data: AppData) -> None:
    connection.executemany(
        """
        INSERT INTO skills (id, slug, owner_ref, default_variant_ref, created_at, lifecycle_status, archived_at)
        VALUES (?, ?, ?, NULL, ?, ?, ?)
        """,
        [(item.id, item.slug, item.owner_ref, item.created_at, item.lifecycle_status, item.archived_at) for item in data.skills],
    )


def _insert_variants_without_current(connection: sqlite3.Connection, data: AppData) -> None:
    connection.executemany(
        """
        INSERT INTO variants (id, skill_ref, name, label, summary, tag_set_ref, current_version_ref, created_at, lifecycle_status, archived_at)
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
        """,
        [
            (
                item.id,
                item.skill_ref,
                item.name,
                item.label,
                item.summary,
                item.tag_set_ref,
                item.created_at,
                item.lifecycle_status,
                item.archived_at,
            )
            for item in data.variants
        ],
    )


def _insert_variant_versions(connection: sqlite3.Connection, data: AppData) -> None:
    connection.executemany(
        """
        INSERT INTO variant_versions
          (id, variant_ref, version, content_kind, content_locator, content_digest, content_path, change_note, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                item.id,
                item.variant_ref,
                item.version,
                item.content_ref.kind,
                item.content_ref.locator,
                item.content_ref.digest,
                item.content_ref.path,
                item.change_note,
                item.created_at,
            )
            for item in data.variant_versions
        ],
    )


def _update_variant_current_versions(connection: sqlite3.Connection, data: AppData) -> None:
    connection.executemany(
        "UPDATE variants SET current_version_ref = ? WHERE id = ?",
        [(item.current_version_ref, item.id) for item in data.variants],
    )


def _update_skill_default_variants(connection: sqlite3.Connection, data: AppData) -> None:
    connection.executemany(
        "UPDATE skills SET default_variant_ref = ? WHERE id = ?",
        [(item.default_variant_ref, item.id) for item in data.skills],
    )


def _insert_eval_corpora(connection: sqlite3.Connection, data: AppData) -> None:
    connection.executemany(
        "INSERT INTO eval_corpora (id, skill_ref, created_at) VALUES (?, ?, ?)",
        [(item.id, item.skill_ref, item.created_at) for item in data.eval_corpora],
    )


def _insert_eval_cases(connection: sqlite3.Connection, data: AppData) -> None:
    connection.executemany(
        """
        INSERT INTO eval_cases
          (id, corpus_ref, title, source_type, current_version_ref, origin_ref, created_at)
        VALUES (?, ?, ?, ?, NULL, ?, ?)
        """,
        [
            (
                item.id,
                item.corpus_ref,
                item.title,
                item.source_type,
                item.origin_ref,
                item.created_at,
            )
            for item in data.eval_cases
        ],
    )


def _insert_eval_case_versions(connection: sqlite3.Connection, data: AppData) -> None:
    connection.executemany(
        """
        INSERT INTO eval_case_versions
          (id, case_ref, version, input_artifact_ref, expectation_artifact_ref, grader_ref, expectation, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                item.id,
                item.case_ref,
                item.version,
                item.input_artifact_ref,
                item.expectation_artifact_ref,
                item.grader_ref,
                item.expectation,
                item.created_at,
            )
            for item in data.eval_case_versions
        ],
    )


def _update_eval_case_current_versions(connection: sqlite3.Connection, data: AppData) -> None:
    connection.executemany(
        "UPDATE eval_cases SET current_version_ref = ? WHERE id = ?",
        [(item.current_version_ref, item.id) for item in data.eval_cases],
    )


def _insert_eval_set_versions(connection: sqlite3.Connection, data: AppData) -> None:
    connection.executemany(
        "INSERT INTO eval_set_versions (id, corpus_ref, version, created_at) VALUES (?, ?, ?, ?)",
        [(item.id, item.corpus_ref, item.version, item.created_at) for item in data.eval_set_versions],
    )
    connection.executemany(
        "INSERT INTO eval_set_cases (eval_set_version_ref, case_version_ref, position) VALUES (?, ?, ?)",
        [
            (item.id, case_version_ref, index)
            for item in data.eval_set_versions
            for index, case_version_ref in enumerate(item.case_version_refs)
        ],
    )


def _insert_eval_runs(connection: sqlite3.Connection, data: AppData) -> None:
    connection.executemany(
        """
        INSERT INTO eval_runs
          (id, variant_version_ref, eval_set_version_ref, strategy_ref, run_config_hash, status, started_at, finished_at, result_artifact_ref)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                item.id,
                item.variant_version_ref,
                item.eval_set_version_ref,
                item.strategy_ref,
                item.run_config_hash,
                item.status,
                item.started_at,
                item.finished_at,
                item.result_artifact_ref,
            )
            for item in data.eval_runs
        ],
    )


def _insert_case_results(connection: sqlite3.Connection, data: AppData) -> None:
    connection.executemany(
        "INSERT INTO case_results (run_ref, case_version_ref, passed, score) VALUES (?, ?, ?, ?)",
        [(item.run_ref, item.case_version_ref, int(item.passed), item.score) for item in data.case_results],
    )


def table_counts(connection: sqlite3.Connection) -> Dict[str, int]:
    tables: Tuple[str, ...] = (
        "skills",
        "tag_sets",
        "variants",
        "variant_versions",
        "eval_corpora",
        "eval_cases",
        "eval_case_versions",
        "eval_set_versions",
        "eval_set_cases",
        "eval_runs",
        "case_results",
        "artifacts",
    )
    return {
        table: connection.execute("SELECT COUNT(*) AS count FROM %s" % table).fetchone()["count"]
        for table in tables
    }
