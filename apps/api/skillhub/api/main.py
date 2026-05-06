from __future__ import annotations

from dataclasses import asdict, is_dataclass
from os import environ
from typing import Any

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.pool import StaticPool

from skillhub.application.skill_imports import parse_skill_import_source
from skillhub.domain.errors import InvariantError, NotFoundError
from skillhub.domain.models import ContentRef
from skillhub.infrastructure.db.repositories import SqlSkillRepository
from skillhub.infrastructure.db.tables import metadata


class ContentRefPayload(BaseModel):
    kind: str
    locator: str
    digest: str
    path: str | None = None


class CreateSkillPayload(BaseModel):
    slug: str
    owner_ref: str
    variant_name: str
    variant_label: str
    variant_summary: str
    tags: list[str] = Field(min_length=1)
    content_ref: ContentRefPayload
    change_summary: str
    actor: str = "system"


class ImportSkillPayload(BaseModel):
    owner_ref: str
    tags: list[str] = Field(min_length=1)
    source: dict[str, Any]
    actor: str = "system"
    variant_label: str = "Imported"


class CreateVariantVersionPayload(BaseModel):
    variant_id: str
    content_ref: ContentRefPayload
    change_summary: str
    actor: str = "system"
    make_current: bool = False


class CreateVariantPayload(BaseModel):
    skill_id: str
    name: str
    label: str
    summary: str
    tags: list[str] = Field(min_length=1)
    content_ref: ContentRefPayload
    change_summary: str
    actor: str = "system"
    make_default: bool = False


class PromoteVariantVersionPayload(BaseModel):
    variant_id: str
    version_id: str


class UpdateSkillPayload(BaseModel):
    slug: str
    owner_ref: str


class ArchivePayload(BaseModel):
    actor: str = "system"


class CreateEvalCasePayload(BaseModel):
    skill_id: str
    title: str
    input_text: str
    expected_output: str
    actor: str = "system"
    notes: str | None = None


class CreateEvalCaseVersionPayload(BaseModel):
    case_id: str
    title: str | None = None
    input_text: str
    expected_output: str
    actor: str = "system"
    notes: str | None = None
    make_current: bool = True


class RecordEvalRunPayload(BaseModel):
    variant_version_id: str
    eval_set_version_id: str
    strategy: str = "manual_pass_fail"
    results: dict[str, bool]
    actor: str = "system"


def create_app(engine: Engine | None = None) -> FastAPI:
    app = FastAPI(title="SkillHub API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:3000", "http://localhost:3000"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.engine = engine or create_sqlite_engine(environ.get("SKILLHUB_DATABASE_URL", "sqlite:///:memory:"))
    metadata.create_all(app.state.engine)

    @app.exception_handler(NotFoundError)
    def not_found_handler(_request, exc: NotFoundError):
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(InvariantError)
    def invariant_handler(_request, exc: InvariantError):
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.get("/health")
    def health() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/api/skills")
    def list_skills(repository: SqlSkillRepository = Depends(repository_dependency)):
        return result_payload(repository.list_skills())

    @app.get("/api/skills/{skill_id}")
    def skill_detail(skill_id: str, repository: SqlSkillRepository = Depends(repository_dependency)):
        return result_payload(repository.skill_detail(skill_id))

    @app.get("/api/eval-set-versions/{eval_set_version_id}")
    def eval_set_version_detail(
        eval_set_version_id: str,
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(repository.eval_set_version_detail(eval_set_version_id))

    @app.get("/api/eval-runs/{eval_run_id}")
    def eval_run_detail(eval_run_id: str, repository: SqlSkillRepository = Depends(repository_dependency)):
        return result_payload(repository.eval_run_detail(eval_run_id))

    @app.post("/api/skills")
    def create_skill(payload: CreateSkillPayload, repository: SqlSkillRepository = Depends(repository_dependency)):
        return result_payload(
            repository.create_skill(
                slug=payload.slug,
                owner_ref=payload.owner_ref,
                variant_name=payload.variant_name,
                variant_label=payload.variant_label,
                variant_summary=payload.variant_summary,
                tags=payload.tags,
                content_ref=content_ref(payload.content_ref),
                change_summary=payload.change_summary,
                actor=payload.actor,
            )
        )

    @app.post("/api/skill-imports")
    def import_skill(payload: ImportSkillPayload, repository: SqlSkillRepository = Depends(repository_dependency)):
        bundle = parse_skill_import_source(payload.source)
        artifact = repository.create_text_artifact(
            kind="skill_bundle",
            namespace=f"skill-import:{bundle.slug}",
            content=bundle.manifest_text,
            actor=payload.actor,
        )
        result = repository.create_skill(
            slug=bundle.slug,
            owner_ref=payload.owner_ref,
            variant_name=payload.variant_label,
            variant_label=payload.variant_label,
            variant_summary=bundle.description,
            tags=payload.tags,
            content_ref=ContentRef(
                kind="artifact",
                locator=f"artifact:{artifact['id']}",
                digest=artifact["digest"],
                path=bundle.entry_path,
            ),
            change_summary=f"Imported standard skill bundle with {bundle.file_count} files.",
            actor=payload.actor,
        )
        return {
            **asdict(result),
            "slug": bundle.slug,
            "description": bundle.description,
            "file_count": bundle.file_count,
            "entry_path": bundle.entry_path,
            "bundle_artifact_id": artifact["id"],
            "bundle_digest": bundle.digest,
        }

    @app.post("/api/variant-versions")
    def create_variant_version(
        payload: CreateVariantVersionPayload,
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(
            repository.create_variant_version(
                variant_id=payload.variant_id,
                content_ref=content_ref(payload.content_ref),
                change_summary=payload.change_summary,
                actor=payload.actor,
                make_current=payload.make_current,
            )
        )

    @app.post("/api/variants")
    def create_variant(payload: CreateVariantPayload, repository: SqlSkillRepository = Depends(repository_dependency)):
        return result_payload(
            repository.create_variant(
                skill_id=payload.skill_id,
                name=payload.name,
                label=payload.label,
                summary=payload.summary,
                tags=payload.tags,
                content_ref=content_ref(payload.content_ref),
                change_summary=payload.change_summary,
                actor=payload.actor,
                make_default=payload.make_default,
            )
        )

    @app.post("/api/variants/promotions")
    def promote_variant_version(
        payload: PromoteVariantVersionPayload,
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        repository.promote_variant_version(variant_id=payload.variant_id, version_id=payload.version_id)
        return {"ok": True}

    @app.patch("/api/skills/{skill_id}")
    def update_skill(
        skill_id: str,
        payload: UpdateSkillPayload,
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(repository.update_skill(skill_id=skill_id, slug=payload.slug, owner_ref=payload.owner_ref))

    @app.delete("/api/skills/{skill_id}")
    def archive_skill(skill_id: str, repository: SqlSkillRepository = Depends(repository_dependency)):
        repository.archive_skill(skill_id=skill_id)
        return {"ok": True}

    @app.post("/api/eval-cases")
    def create_eval_case(payload: CreateEvalCasePayload, repository: SqlSkillRepository = Depends(repository_dependency)):
        return result_payload(
            repository.create_eval_case(
                skill_id=payload.skill_id,
                title=payload.title,
                input_text=payload.input_text,
                expected_output=payload.expected_output,
                actor=payload.actor,
                notes=payload.notes,
            )
        )

    @app.post("/api/eval-case-versions")
    def create_eval_case_version(
        payload: CreateEvalCaseVersionPayload,
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        if payload.title is not None:
            repository.update_eval_case_title(case_id=payload.case_id, title=payload.title)
        return result_payload(
            repository.create_eval_case_version(
                case_id=payload.case_id,
                input_text=payload.input_text,
                expected_output=payload.expected_output,
                actor=payload.actor,
                notes=payload.notes,
                make_current=payload.make_current,
            )
        )

    @app.patch("/api/eval-cases/{case_id}")
    def update_eval_case(
        case_id: str,
        payload: CreateEvalCaseVersionPayload,
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        if payload.title is not None:
            repository.update_eval_case_title(case_id=case_id, title=payload.title)
        return result_payload(
            repository.create_eval_case_version(
                case_id=case_id,
                input_text=payload.input_text,
                expected_output=payload.expected_output,
                actor=payload.actor,
                notes=payload.notes,
                make_current=payload.make_current,
            )
        )

    @app.delete("/api/eval-cases/{case_id}")
    def archive_eval_case(
        case_id: str,
        payload: ArchivePayload | None = None,
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(repository.archive_eval_case(case_id=case_id, actor=payload.actor if payload else "system"))

    @app.post("/api/eval-runs")
    def record_eval_run(payload: RecordEvalRunPayload, repository: SqlSkillRepository = Depends(repository_dependency)):
        return result_payload(
            repository.record_eval_run(
                variant_version_id=payload.variant_version_id,
                eval_set_version_id=payload.eval_set_version_id,
                strategy=payload.strategy,
                results=payload.results,
                actor=payload.actor,
            )
        )

    return app


def create_local_sqlite_engine() -> Engine:
    return create_sqlite_engine("sqlite:///:memory:")


def create_sqlite_engine(database_url: str) -> Engine:
    if database_url == "sqlite:///:memory:":
        engine = create_engine(
            database_url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    else:
        engine = create_engine(database_url, connect_args={"check_same_thread": False})
    event.listen(engine, "connect", enable_sqlite_foreign_keys)
    return engine


def enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
    dbapi_connection.execute("pragma foreign_keys=on")


def repository_dependency(request: Request) -> SqlSkillRepository:
    return SqlSkillRepository(request.app.state.engine)


def content_ref(payload: ContentRefPayload) -> ContentRef:
    return ContentRef(kind=payload.kind, locator=payload.locator, digest=payload.digest, path=payload.path)  # type: ignore[arg-type]


def result_payload(result: Any) -> Any:
    if is_dataclass(result):
        return asdict(result)
    return result


app = create_app()
