from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable, Dict, Optional
from urllib.parse import parse_qs, urlparse

from .models import ContentRef
from .repository import JsonFileRepository, SqliteRepository, StateRepository
from .seed import create_seed_data
from .store import SkillHubStore


DEFAULT_DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "skillhub-demo.json"
DEFAULT_SQLITE_PATH = Path(__file__).resolve().parents[1] / "data" / "skillhub-demo.sqlite3"
STORE: Optional[SkillHubStore] = None
REPOSITORY: Optional[StateRepository] = None
DATA_PATH: Optional[Path] = None


def store() -> SkillHubStore:
    if STORE is None:
        raise RuntimeError("Store is not initialized")
    return STORE


class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        self._send_json(204, {})

    def do_GET(self) -> None:
        self._handle(
            {
                "/health": lambda _query: {"ok": True},
                "/api/state": lambda _query: store().state(),
                "/api/skills": self._skills,
                "/api/skill": self._skill_detail,
                "/api/variant-page": self._variant_page,
                "/api/eval-set": self._eval_set,
                "/api/eval-result": self._eval_result,
                "/api/skill-bundle": self._skill_bundle,
            }
        )

    def do_POST(self) -> None:
        self._handle(
            {
                "/api/skills": self._create_skill,
                "/api/variants": self._create_variant,
                "/api/skill-bundles": self._import_skill_bundle,
                "/api/eval-cases": self._create_eval_case,
                "/api/eval-case-versions": self._create_eval_case_version,
                "/api/variant-versions": self._publish_variant_version,
                "/api/eval-runs": self._record_eval_run,
                "/api/reset": self._reset_state,
            }
        )

    def do_PATCH(self) -> None:
        self._handle(
            {
                "/api/skills": self._update_skill,
                "/api/variants": self._update_variant,
            }
        )

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _handle(self, routes: Dict[str, Callable[[Dict[str, str]], Any]]) -> None:
        try:
            parsed = urlparse(self.path)
            route = routes.get(parsed.path)
            if route is None:
                raise ApiError(404, "Unknown endpoint")
            query = {key: values[-1] for key, values in parse_qs(parsed.query).items()}
            self._send_json(200, route(query))
        except ApiError as error:
            self._send_json(error.status, {"error": error.message})
        except KeyError as error:
            self._send_json(404, {"error": str(error)})
        except ValueError as error:
            self._send_json(400, {"error": str(error)})
        except Exception as error:
            self._send_json(500, {"error": str(error)})

    def _variant_page(self, query: Dict[str, str]) -> Any:
        variant_id = self._required(query, "variant_id")
        version_id = query.get("version_id")
        eval_set_version_id = self._required(query, "eval_set_version_id")
        if REPOSITORY is not None and hasattr(REPOSITORY, "variant_page"):
            return REPOSITORY.variant_page(variant_id, version_id, eval_set_version_id)  # type: ignore[attr-defined]
        return store().variant_page(
            variant_id,
            version_id,
            eval_set_version_id,
        )

    def _skills(self, _query: Dict[str, str]) -> Any:
        if REPOSITORY is not None and hasattr(REPOSITORY, "skills"):
            return {"skills": REPOSITORY.skills()}  # type: ignore[attr-defined]
        return {"skills": store().skills()}

    def _skill_detail(self, query: Dict[str, str]) -> Any:
        skill_id = self._required(query, "skill_id")
        if REPOSITORY is not None and hasattr(REPOSITORY, "skill_detail"):
            return REPOSITORY.skill_detail(skill_id)  # type: ignore[attr-defined]
        return store().skill_detail(skill_id)

    def _eval_set(self, query: Dict[str, str]) -> Any:
        eval_set_version_id = self._required(query, "eval_set_version_id")
        if REPOSITORY is not None and hasattr(REPOSITORY, "eval_set_detail"):
            return REPOSITORY.eval_set_detail(eval_set_version_id)  # type: ignore[attr-defined]
        return store().eval_set_detail(eval_set_version_id)

    def _eval_result(self, query: Dict[str, str]) -> Any:
        variant_version_id = self._required(query, "variant_version_id")
        eval_set_version_id = self._required(query, "eval_set_version_id")
        if REPOSITORY is not None and hasattr(REPOSITORY, "eval_result_detail"):
            return REPOSITORY.eval_result_detail(variant_version_id, eval_set_version_id)  # type: ignore[attr-defined]
        return store().eval_result_detail(variant_version_id, eval_set_version_id)

    def _skill_bundle(self, query: Dict[str, str]) -> Any:
        artifact_id = self._required(query, "artifact_id")
        if REPOSITORY is not None and hasattr(REPOSITORY, "skill_bundle_detail"):
            return REPOSITORY.skill_bundle_detail(create_seed_data, artifact_id)  # type: ignore[attr-defined]
        return store().skill_bundle_detail(artifact_id)

    def _create_eval_case(self, _query: Dict[str, str]) -> Any:
        body = self._json_body()
        return self._mutate(
            lambda current_store: current_store.create_eval_case(
                skill_id=self._required(body, "skill_id"),
                title=self._required(body, "title"),
                input_text=self._required(body, "input"),
                expected_output=self._required(body, "expected_output"),
                source_type=body.get("source_type", "manual"),
            )
        )

    def _create_eval_case_version(self, _query: Dict[str, str]) -> Any:
        body = self._json_body()
        return self._mutate(
            lambda current_store: current_store.create_eval_case_version(
                case_id=self._required(body, "case_id"),
                input_text=self._required(body, "input"),
                expected_output=self._required(body, "expected_output"),
                make_current=bool(body.get("make_current", True)),
            )
        )

    def _create_skill(self, _query: Dict[str, str]) -> Any:
        body = self._json_body()
        default_variant = body.get("default_variant")
        if not isinstance(default_variant, dict):
            raise ApiError(400, "default_variant must be an object")
        owner_ref = body.get("owner_ref", "skillhub-lab")
        if not isinstance(owner_ref, str):
            raise ApiError(400, "owner_ref must be a string")
        tags = default_variant.get("tags")
        if not isinstance(tags, list) or not all(isinstance(item, str) for item in tags):
            raise ApiError(400, "default_variant.tags must be a string array")
        return self._mutate(
            lambda current_store: current_store.create_skill(
                slug=self._required(body, "slug"),
                owner_ref=owner_ref,
                variant_name=self._required(default_variant, "name"),
                variant_label=self._required(default_variant, "label"),
                variant_summary=self._required(default_variant, "summary"),
                tags=tags,
                change_note=default_variant.get("change_note", ""),
                content=default_variant.get("content", ""),
            )
        )

    def _create_variant(self, _query: Dict[str, str]) -> Any:
        body = self._json_body()
        tags = body.get("tags")
        if not isinstance(tags, list) or not all(isinstance(item, str) for item in tags):
            raise ApiError(400, "tags must be a string array")
        return self._mutate(
            lambda current_store: current_store.create_variant(
                skill_id=self._required(body, "skill_id"),
                name=self._required(body, "name"),
                label=self._required(body, "label"),
                summary=self._required(body, "summary"),
                tags=tags,
                change_note=body.get("change_note", ""),
                content=body.get("content", ""),
            )
        )

    def _import_skill_bundle(self, _query: Dict[str, str]) -> Any:
        body = self._json_body()
        files = body.get("files")
        if not isinstance(files, dict) or not all(isinstance(key, str) and isinstance(value, str) for key, value in files.items()):
            raise ApiError(400, "files must be an object mapping path to string content")
        if REPOSITORY is not None and hasattr(REPOSITORY, "import_skill_bundle"):
            result = REPOSITORY.import_skill_bundle(  # type: ignore[attr-defined]
                create_seed_data,
                body.get("name", "") if isinstance(body.get("name", ""), str) else "",
                files,
            )
            self._sync_store_cache()
            return result
        return self._mutate(
            lambda current_store: current_store.import_skill_bundle(
                name=body.get("name", "") if isinstance(body.get("name", ""), str) else "",
                files=files,
            )
        )

    def _update_variant(self, _query: Dict[str, str]) -> Any:
        body = self._json_body()
        label = body.get("label")
        summary = body.get("summary")
        lifecycle_status = body.get("lifecycle_status")
        if label is not None and not isinstance(label, str):
            raise ApiError(400, "label must be a string")
        if summary is not None and not isinstance(summary, str):
            raise ApiError(400, "summary must be a string")
        if lifecycle_status is not None and not isinstance(lifecycle_status, str):
            raise ApiError(400, "lifecycle_status must be a string")
        return self._mutate(
            lambda current_store: current_store.update_variant(
                variant_id=self._required(body, "variant_id"),
                label=label,
                summary=summary,
                lifecycle_status=lifecycle_status,
            )
        )

    def _update_skill(self, _query: Dict[str, str]) -> Any:
        body = self._json_body()
        slug = body.get("slug")
        owner_ref = body.get("owner_ref")
        default_variant_ref = body.get("default_variant_ref")
        lifecycle_status = body.get("lifecycle_status")
        if slug is not None and not isinstance(slug, str):
            raise ApiError(400, "slug must be a string")
        if owner_ref is not None and not isinstance(owner_ref, str):
            raise ApiError(400, "owner_ref must be a string")
        if default_variant_ref is not None and not isinstance(default_variant_ref, str):
            raise ApiError(400, "default_variant_ref must be a string")
        if lifecycle_status is not None and not isinstance(lifecycle_status, str):
            raise ApiError(400, "lifecycle_status must be a string")
        return self._mutate(
            lambda current_store: current_store.update_skill(
                skill_id=self._required(body, "skill_id"),
                slug=slug,
                owner_ref=owner_ref,
                default_variant_ref=default_variant_ref,
                lifecycle_status=lifecycle_status,
            )
        )

    def _publish_variant_version(self, _query: Dict[str, str]) -> Any:
        body = self._json_body()
        content_ref = body.get("content_ref")
        return self._mutate(
            lambda current_store: current_store.publish_variant_version(
                variant_id=self._required(body, "variant_id"),
                change_note=self._required(body, "change_note"),
                content=body.get("content", ""),
                content_ref=self._content_ref(content_ref) if content_ref is not None else None,
                make_current=bool(body.get("make_current", False)),
            )
        )

    def _record_eval_run(self, _query: Dict[str, str]) -> Any:
        body = self._json_body()
        results = body.get("results")
        if not isinstance(results, dict):
            raise ApiError(400, "results must be an object mapping case id to boolean")
        return self._mutate(
            lambda current_store: current_store.record_eval_run(
                variant_version_id=self._required(body, "variant_version_id"),
                eval_set_version_id=self._required(body, "eval_set_version_id"),
                results={key: bool(value) for key, value in results.items()},
            )
        )

    def _reset_state(self, _query: Dict[str, str]) -> Any:
        global STORE
        STORE = SkillHubStore(create_seed_data())
        if REPOSITORY is not None:
            REPOSITORY.save(STORE.data)
        return STORE.state()

    def _json_body(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        try:
            value = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as error:
            raise ApiError(400, "Invalid JSON: %s" % error) from error
        if not isinstance(value, dict):
            raise ApiError(400, "JSON body must be an object")
        return value

    def _required(self, source: Dict[str, Any], key: str) -> str:
        value = source.get(key)
        if not isinstance(value, str) or not value:
            raise ApiError(400, "Missing required field: %s" % key)
        return value

    def _content_ref(self, value: Any) -> ContentRef:
        if not isinstance(value, dict):
            raise ApiError(400, "content_ref must be an object")
        kind = self._required(value, "kind")
        locator = self._required(value, "locator")
        content_digest = self._required(value, "digest")
        path = value.get("path")
        if path is not None and not isinstance(path, str):
            raise ApiError(400, "content_ref.path must be a string")
        if kind not in {"inline_bundle", "skill_bundle", "artifact", "git", "external_repo"}:
            raise ApiError(400, "Unknown content_ref.kind")
        return ContentRef(kind=kind, locator=locator, digest=content_digest, path=path)  # type: ignore[arg-type]

    def _mutate(self, operation: Callable[[SkillHubStore], Any]) -> Any:
        global STORE
        if REPOSITORY is not None:
            result = REPOSITORY.mutate(create_seed_data, operation)
            self._sync_store_cache()
            return result
        result = operation(store())
        STORE = store()
        return result

    def _sync_store_cache(self) -> None:
        global STORE
        if REPOSITORY is not None:
            STORE = SkillHubStore(REPOSITORY.load(create_seed_data))

    def _send_json(self, status: int, payload: Any) -> None:
        body = b"" if status == 204 else json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if body:
            self.wfile.write(body)


def main() -> None:
    global DATA_PATH, REPOSITORY, STORE
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8788, type=int)
    parser.add_argument("--store", choices=("sqlite", "json"), default="sqlite")
    parser.add_argument("--data-file", default=str(DEFAULT_DATA_PATH))
    parser.add_argument("--sqlite-file", default=str(DEFAULT_SQLITE_PATH))
    args = parser.parse_args()
    DATA_PATH = Path(args.data_file)
    if args.store == "json":
        REPOSITORY = JsonFileRepository(DATA_PATH)
    else:
        REPOSITORY = SqliteRepository(args.sqlite_file, import_json_path=DATA_PATH)
    STORE = SkillHubStore(REPOSITORY.load(create_seed_data))
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print("SkillHub demo backend: http://%s:%d" % (args.host, args.port))
    print("SkillHub demo store: %s" % REPOSITORY.label)
    server.serve_forever()


if __name__ == "__main__":
    main()
