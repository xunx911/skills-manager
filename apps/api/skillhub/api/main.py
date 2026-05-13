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
from skillhub.api.auth import ActorContext, actor_dependency
from skillhub.domain.errors import InvariantError, NotFoundError, PermissionDeniedError
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


class ImportSkillPayload(BaseModel):
    owner_ref: str
    tags: list[str] = Field(min_length=1)
    source: dict[str, Any]
    variant_label: str = "Imported"


class CreateVariantVersionPayload(BaseModel):
    variant_id: str
    content_ref: ContentRefPayload | None = None
    source: dict[str, Any] | None = None
    change_summary: str
    make_current: bool = False


class CreateVariantPayload(BaseModel):
    skill_id: str
    name: str
    label: str
    summary: str
    tags: list[str] = Field(min_length=1)
    content_ref: ContentRefPayload
    change_summary: str
    make_default: bool = False


class PromoteVariantVersionPayload(BaseModel):
    variant_id: str
    version_id: str
    evidence_eval_run_id: str | None = None
    eval_set_version_id: str | None = None
    decision_note: str | None = None
    accept_risk: bool = False


class UpdateSkillPayload(BaseModel):
    slug: str
    owner_ref: str
    default_variant_id: str | None = None


class AssignSkillRolePayload(BaseModel):
    subject_id: str
    role: str
    subject_type: str = "user"


class CreateEvalCasePayload(BaseModel):
    skill_id: str
    title: str
    input_text: str
    expected_output: str
    notes: str | None = None


class CreateEvalCaseItemPayload(BaseModel):
    title: str = Field(min_length=1)
    input_text: str = Field(min_length=1)
    expected_output: str = Field(min_length=1)
    notes: str | None = None


class CreateEvalCasesBatchPayload(BaseModel):
    skill_id: str
    cases: list[CreateEvalCaseItemPayload] = Field(min_length=1)


class CreateEvalCaseVersionPayload(BaseModel):
    case_id: str
    title: str | None = None
    input_text: str
    expected_output: str
    notes: str | None = None
    make_current: bool = True


class RestoreEvalCaseVersionPayload(BaseModel):
    source_case_version_id: str
    notes: str | None = None


class RecordEvalRunPayload(BaseModel):
    variant_version_id: str
    eval_set_version_id: str
    strategy: str = "manual_pass_fail"
    results: dict[str, bool]


class AcceptEvalRunVerificationPayload(BaseModel):
    eval_run_id: str
    note: str = ""


class CreateSavedViewPayload(BaseModel):
    skill_id: str
    name: str
    view_type: str = "run_history"
    config: dict[str, str] = Field(default_factory=dict)


def create_app(engine: Engine | None = None) -> FastAPI:
    app = FastAPI(title="SkillHub API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"http://(127\.0\.0\.1|localhost):\d+",
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

    @app.exception_handler(PermissionDeniedError)
    def permission_denied_handler(_request, exc: PermissionDeniedError):
        return JSONResponse(status_code=403, content={"detail": str(exc)})

    @app.get("/health")
    def health() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/api/skills")
    def list_skills(repository: SqlSkillRepository = Depends(repository_dependency)):
        return result_payload(repository.list_skills())

    @app.get("/api/skills/{skill_id}")
    def skill_detail(skill_id: str, repository: SqlSkillRepository = Depends(repository_dependency)):
        return result_payload(repository.skill_detail(skill_id))

    @app.get("/api/skills/{skill_id}/role-assignments")
    def skill_role_assignments(skill_id: str, repository: SqlSkillRepository = Depends(repository_dependency)):
        return result_payload(repository.list_skill_role_assignments(skill_id=skill_id))

    @app.get("/api/skills/{skill_id}/audit-events")
    def skill_audit_events(
        skill_id: str,
        limit: int = 10,
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(repository.list_skill_audit_events(skill_id=skill_id, limit=limit))

    @app.post("/api/skills/{skill_id}/role-assignments")
    def assign_skill_role(
        skill_id: str,
        payload: AssignSkillRolePayload,
        actor: ActorContext = Depends(actor_dependency),
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(
            repository.assign_skill_role(
                skill_id=skill_id,
                subject_id=payload.subject_id,
                role=payload.role,
                subject_type=payload.subject_type,
                actor=actor.id,
            )
        )

    @app.delete("/api/role-assignments/{role_assignment_id}")
    def revoke_role_assignment(
        role_assignment_id: str,
        actor: ActorContext = Depends(actor_dependency),
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(repository.revoke_role_assignment(role_assignment_id=role_assignment_id, actor=actor.id))

    @app.get("/api/skills/{skill_id}/eval-runs")
    def eval_run_history(
        skill_id: str,
        variant_version_id: str | None = None,
        eval_set_version_id: str | None = None,
        strategy: str | None = None,
        status: str | None = None,
        limit: int = 50,
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(
            repository.list_eval_runs_for_skill(
                skill_id=skill_id,
                variant_version_id=variant_version_id,
                eval_set_version_id=eval_set_version_id,
                strategy=strategy,
                status=status,
                limit=limit,
            )
        )

    @app.get("/api/skills/{skill_id}/eval-run-matrix")
    def eval_run_matrix(
        skill_id: str,
        variant_version_id: str | None = None,
        eval_set_version_id: str | None = None,
        strategy: str | None = None,
        status: str | None = None,
        limit: int = 50,
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(
            repository.eval_run_matrix_for_skill(
                skill_id=skill_id,
                variant_version_id=variant_version_id,
                eval_set_version_id=eval_set_version_id,
                strategy=strategy,
                status=status,
                limit=limit,
            )
        )

    @app.get("/api/skills/{skill_id}/saved-views")
    def saved_views(
        skill_id: str,
        view_type: str = "run_history",
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(repository.list_saved_views(skill_id=skill_id, view_type=view_type))

    @app.post("/api/saved-views")
    def create_saved_view(
        payload: CreateSavedViewPayload,
        actor: ActorContext = Depends(actor_dependency),
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(
            repository.create_saved_view(
                skill_id=payload.skill_id,
                name=payload.name,
                view_type=payload.view_type,
                config=payload.config,
                actor=actor.id,
            )
        )

    @app.delete("/api/saved-views/{saved_view_id}")
    def delete_saved_view(saved_view_id: str, repository: SqlSkillRepository = Depends(repository_dependency)):
        return result_payload(repository.delete_saved_view(saved_view_id))

    @app.get("/api/eval-set-versions/{eval_set_version_id}")
    def eval_set_version_detail(
        eval_set_version_id: str,
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(repository.eval_set_version_detail(eval_set_version_id))

    @app.get("/api/eval-runs/compare")
    def compare_eval_runs(
        baseline_run_id: str,
        candidate_run_id: str,
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(
            repository.compare_eval_runs(
                baseline_run_id=baseline_run_id,
                candidate_run_id=candidate_run_id,
            )
        )

    @app.get("/api/eval-runs/{eval_run_id}")
    def eval_run_detail(eval_run_id: str, repository: SqlSkillRepository = Depends(repository_dependency)):
        return result_payload(repository.eval_run_detail(eval_run_id))

    @app.get("/api/eval-cases/{case_id}/versions")
    def eval_case_history(case_id: str, repository: SqlSkillRepository = Depends(repository_dependency)):
        return result_payload(repository.eval_case_history(case_id))

    @app.get("/api/artifacts/diff")
    def artifact_diff(
        left_variant_version_id: str,
        right_variant_version_id: str,
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(
            repository.bundle_diff(
                left_variant_version_id=left_variant_version_id,
                right_variant_version_id=right_variant_version_id,
            )
        )

    @app.get("/api/variants/{variant_id}/promotion-review")
    def promotion_review(
        variant_id: str,
        candidate_version_id: str,
        eval_set_version_id: str | None = None,
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(
            repository.promotion_review(
                variant_id=variant_id,
                candidate_version_id=candidate_version_id,
                eval_set_version_id=eval_set_version_id,
            )
        )

    @app.post("/api/skills")
    def create_skill(
        payload: CreateSkillPayload,
        actor: ActorContext = Depends(actor_dependency),
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
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
                actor=actor.id,
            )
        )

    @app.post("/api/skill-imports")
    def import_skill(
        payload: ImportSkillPayload,
        actor: ActorContext = Depends(actor_dependency),
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        bundle = parse_skill_import_source(payload.source)
        artifact = repository.create_text_artifact(
            kind="skill_bundle",
            namespace=f"skill-import:{bundle.slug}",
            content=bundle.manifest_text,
            actor=actor.id,
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
            actor=actor.id,
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
        actor: ActorContext = Depends(actor_dependency),
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        if payload.source is not None:
            bundle = parse_skill_import_source(payload.source)
            artifact = repository.create_text_artifact(
                kind="skill_bundle",
                namespace=f"variant-version-import:{bundle.slug}",
                content=bundle.manifest_text,
                actor=actor.id,
            )
            content = ContentRef(
                kind="artifact",
                locator=f"artifact:{artifact['id']}",
                digest=artifact["digest"],
                path=bundle.entry_path,
            )
        elif payload.content_ref is not None:
            content = content_ref(payload.content_ref)
        else:
            raise InvariantError("Variant version requires either content_ref or standard skill bundle source.")
        return result_payload(
            repository.create_variant_version(
                variant_id=payload.variant_id,
                content_ref=content,
                change_summary=payload.change_summary,
                actor=actor.id,
                make_current=payload.make_current,
            )
        )

    @app.post("/api/variants")
    def create_variant(
        payload: CreateVariantPayload,
        actor: ActorContext = Depends(actor_dependency),
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(
            repository.create_variant(
                skill_id=payload.skill_id,
                name=payload.name,
                label=payload.label,
                summary=payload.summary,
                tags=payload.tags,
                content_ref=content_ref(payload.content_ref),
                change_summary=payload.change_summary,
                actor=actor.id,
                make_default=payload.make_default,
            )
        )

    @app.post("/api/variants/promotions")
    def promote_variant_version(
        payload: PromoteVariantVersionPayload,
        actor: ActorContext = Depends(actor_dependency),
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        decision = repository.promote_variant_version(
            variant_id=payload.variant_id,
            version_id=payload.version_id,
            evidence_eval_run_id=payload.evidence_eval_run_id,
            eval_set_version_id=payload.eval_set_version_id,
            decision_note=payload.decision_note,
            accept_risk=payload.accept_risk,
            actor=actor.id,
        )
        return {"ok": True, "promotion_decision": decision}

    @app.patch("/api/skills/{skill_id}")
    def update_skill(
        skill_id: str,
        payload: UpdateSkillPayload,
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(
            repository.update_skill(
                skill_id=skill_id,
                slug=payload.slug,
                owner_ref=payload.owner_ref,
                default_variant_id=payload.default_variant_id,
            )
        )

    @app.delete("/api/skills/{skill_id}")
    def archive_skill(
        skill_id: str,
        actor: ActorContext = Depends(actor_dependency),
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        repository.archive_skill(skill_id=skill_id, actor=actor.id)
        return {"ok": True}

    @app.post("/api/eval-cases")
    def create_eval_case(
        payload: CreateEvalCasePayload,
        actor: ActorContext = Depends(actor_dependency),
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(
            repository.create_eval_case(
                skill_id=payload.skill_id,
                title=payload.title,
                input_text=payload.input_text,
                expected_output=payload.expected_output,
                actor=actor.id,
                notes=payload.notes,
            )
        )

    @app.post("/api/eval-cases/batch")
    def create_eval_cases_batch(
        payload: CreateEvalCasesBatchPayload,
        actor: ActorContext = Depends(actor_dependency),
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(
            repository.create_eval_cases_batch(
                skill_id=payload.skill_id,
                cases=[case.model_dump() for case in payload.cases],
                actor=actor.id,
            )
        )

    @app.post("/api/eval-case-versions")
    def create_eval_case_version(
        payload: CreateEvalCaseVersionPayload,
        actor: ActorContext = Depends(actor_dependency),
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        if payload.title is not None:
            repository.update_eval_case_title(case_id=payload.case_id, title=payload.title)
        return result_payload(
            repository.create_eval_case_version(
                case_id=payload.case_id,
                input_text=payload.input_text,
                expected_output=payload.expected_output,
                actor=actor.id,
                notes=payload.notes,
                make_current=payload.make_current,
            )
        )

    @app.patch("/api/eval-cases/{case_id}")
    def update_eval_case(
        case_id: str,
        payload: CreateEvalCaseVersionPayload,
        actor: ActorContext = Depends(actor_dependency),
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        if payload.title is not None:
            repository.update_eval_case_title(case_id=case_id, title=payload.title)
        return result_payload(
            repository.create_eval_case_version(
                case_id=case_id,
                input_text=payload.input_text,
                expected_output=payload.expected_output,
                actor=actor.id,
                notes=payload.notes,
                make_current=payload.make_current,
            )
        )

    @app.post("/api/eval-cases/{case_id}/restores")
    def restore_eval_case_version(
        case_id: str,
        payload: RestoreEvalCaseVersionPayload,
        actor: ActorContext = Depends(actor_dependency),
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(
            repository.restore_eval_case_version(
                case_id=case_id,
                source_case_version_id=payload.source_case_version_id,
                actor=actor.id,
                notes=payload.notes,
            )
        )

    @app.delete("/api/eval-cases/{case_id}")
    def archive_eval_case(
        case_id: str,
        actor: ActorContext = Depends(actor_dependency),
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(repository.archive_eval_case(case_id=case_id, actor=actor.id))

    @app.post("/api/eval-runs")
    def record_eval_run(
        payload: RecordEvalRunPayload,
        actor: ActorContext = Depends(actor_dependency),
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        return result_payload(
            repository.record_eval_run(
                variant_version_id=payload.variant_version_id,
                eval_set_version_id=payload.eval_set_version_id,
                strategy=payload.strategy,
                results=payload.results,
                actor=actor.id,
            )
        )

    @app.post("/api/eval-runs/accepted-verifications")
    def accept_eval_run_verification(
        payload: AcceptEvalRunVerificationPayload,
        actor: ActorContext = Depends(actor_dependency),
        repository: SqlSkillRepository = Depends(repository_dependency),
    ):
        accepted = repository.accept_eval_run_verification(
            eval_run_id=payload.eval_run_id,
            note=payload.note,
            actor=actor.id,
        )
        return {"ok": True, "accepted_verification": accepted}

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
