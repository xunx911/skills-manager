from __future__ import annotations

from dataclasses import asdict
from typing import Any

from fastapi import Depends, FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.pool import StaticPool

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


class CreateVariantVersionPayload(BaseModel):
    variant_id: str
    content_ref: ContentRefPayload
    change_summary: str
    actor: str = "system"
    make_current: bool = False


class PromoteVariantVersionPayload(BaseModel):
    variant_id: str
    version_id: str


class CreateEvalCasePayload(BaseModel):
    skill_id: str
    title: str
    input_text: str
    expected_output: str
    actor: str = "system"
    notes: str | None = None


class CreateEvalCaseVersionPayload(BaseModel):
    case_id: str
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
    app.state.engine = engine or create_local_sqlite_engine()
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

    @app.post("/api/variants/promotions")
    def promote_variant_version(
        payload: PromoteVariantVersionPayload,
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        repository.promote_variant_version(variant_id=payload.variant_id, version_id=payload.version_id)
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
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    event.listen(engine, "connect", enable_sqlite_foreign_keys)
    return engine


def enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
    dbapi_connection.execute("pragma foreign_keys=on")


def repository_dependency(request: Request) -> SqlSkillRepository:
    return SqlSkillRepository(request.app.state.engine)


def content_ref(payload: ContentRefPayload) -> ContentRef:
    return ContentRef(kind=payload.kind, locator=payload.locator, digest=payload.digest, path=payload.path)  # type: ignore[arg-type]


def result_payload(result: Any) -> dict[str, Any]:
    return asdict(result)


app = create_app()
