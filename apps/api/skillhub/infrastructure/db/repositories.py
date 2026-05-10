from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from difflib import SequenceMatcher
import json
from typing import Any

from sqlalchemy import Engine, desc, insert, select, update
from sqlalchemy.exc import IntegrityError

from skillhub.application.promotion_review import build_promotion_case_comparisons, build_promotion_readiness
from skillhub.application.run_comparison import build_run_case_comparisons, build_run_comparison_summary
from skillhub.domain.errors import InvariantError, NotFoundError
from skillhub.domain.models import ContentRef, digest_text, new_id, normalize_tags, utc_now
from skillhub.infrastructure.db import tables


@dataclass(frozen=True)
class CreateSkillResult:
    skill_id: str
    eval_set_id: str
    eval_set_version_id: str
    tag_set_id: str
    variant_id: str
    variant_version_id: str


@dataclass(frozen=True)
class CreateVariantVersionResult:
    skill_id: str
    variant_id: str
    variant_version_id: str
    version_number: int


@dataclass(frozen=True)
class CreateVariantResult:
    skill_id: str
    tag_set_id: str
    variant_id: str
    variant_version_id: str


@dataclass(frozen=True)
class CreateEvalCaseResult:
    skill_id: str
    eval_set_id: str
    eval_set_version_id: str
    eval_case_id: str
    eval_case_version_id: str
    input_artifact_id: str
    expected_output_artifact_id: str


@dataclass(frozen=True)
class RecordEvalRunResult:
    eval_run_id: str
    skill_id: str
    variant_version_id: str
    eval_set_version_id: str
    passed: int
    failed: int
    total: int


@dataclass(frozen=True)
class EvalSetVersionDetail:
    eval_set_version: dict[str, Any]
    eval_set: dict[str, Any]
    cases: list[dict[str, Any]]


@dataclass(frozen=True)
class EvalRunDetail:
    eval_run: dict[str, Any]
    skill: dict[str, Any]
    variant_version: dict[str, Any]
    eval_set_version: dict[str, Any]
    case_results: list[dict[str, Any]]


class SqlSkillRepository:
    def __init__(self, engine: Engine):
        self.engine = engine

    def create_skill(
        self,
        *,
        slug: str,
        owner_ref: str,
        variant_name: str,
        variant_label: str,
        variant_summary: str,
        tags: list[str],
        content_ref: ContentRef,
        change_summary: str,
        actor: str,
    ) -> CreateSkillResult:
        normalized_tags = normalize_tags(tags)
        normalized_hash = digest_text("\n".join(normalized_tags))
        created_at = utc_now()
        skill_id = new_id("skill")
        eval_set_id = new_id("evalset")
        eval_set_version_id = new_id("evalsetver")
        variant_id = new_id("variant")
        variant_version_id = new_id("varver")

        try:
            with self.engine.begin() as connection:
                tag_set_id = self._get_or_create_tag_set(
                    connection,
                    tags=normalized_tags,
                    normalized_hash=normalized_hash,
                    created_at=created_at,
                )

                connection.execute(
                    insert(tables.skills).values(
                        id=skill_id,
                        slug=slug,
                        owner_ref=owner_ref,
                        default_variant_id=None,
                        lifecycle_status="active",
                        created_at=created_at,
                        updated_at=created_at,
                    )
                )
                connection.execute(
                    insert(tables.eval_sets).values(
                        id=eval_set_id,
                        skill_id=skill_id,
                        name="Primary",
                        description="Primary regression suite",
                        current_version_id=None,
                        lifecycle_status="active",
                        created_at=created_at,
                        updated_at=created_at,
                    )
                )
                connection.execute(
                    insert(tables.eval_set_versions).values(
                        id=eval_set_version_id,
                        skill_id=skill_id,
                        eval_set_id=eval_set_id,
                        version_number=1,
                        created_at=created_at,
                        created_by=actor,
                    )
                )
                connection.execute(
                    update(tables.eval_sets)
                    .where(tables.eval_sets.c.id == eval_set_id)
                    .values(current_version_id=eval_set_version_id, updated_at=created_at)
                )
                connection.execute(
                    insert(tables.variants).values(
                        id=variant_id,
                        skill_id=skill_id,
                        name=variant_name,
                        label=variant_label,
                        summary=variant_summary,
                        tag_set_id=tag_set_id,
                        current_version_id=None,
                        lifecycle_status="active",
                        created_at=created_at,
                        updated_at=created_at,
                    )
                )
                connection.execute(
                    insert(tables.variant_versions).values(
                        id=variant_version_id,
                        skill_id=skill_id,
                        variant_id=variant_id,
                        version_number=1,
                        content_ref=self._content_ref_payload(content_ref),
                        content_digest=content_ref.digest,
                        change_summary=change_summary,
                        created_at=created_at,
                        created_by=actor,
                    )
                )
                connection.execute(
                    update(tables.variants)
                    .where(tables.variants.c.id == variant_id)
                    .values(current_version_id=variant_version_id, updated_at=created_at)
                )
                connection.execute(
                    update(tables.skills)
                    .where(tables.skills.c.id == skill_id)
                    .values(default_variant_id=variant_id, updated_at=created_at)
                )
        except IntegrityError as exc:
            raise InvariantError(f"Skill slug already exists: {slug}") from exc

        return CreateSkillResult(
            skill_id=skill_id,
            eval_set_id=eval_set_id,
            eval_set_version_id=eval_set_version_id,
            tag_set_id=tag_set_id,
            variant_id=variant_id,
            variant_version_id=variant_version_id,
        )

    def create_variant_version(
        self,
        *,
        variant_id: str,
        content_ref: ContentRef,
        change_summary: str,
        actor: str,
        make_current: bool,
    ) -> CreateVariantVersionResult:
        created_at = utc_now()
        variant_version_id = new_id("varver")

        with self.engine.begin() as connection:
            variant = self._variant_row(connection, variant_id)
            version_number = self._next_variant_version_number(connection, variant_id)
            connection.execute(
                insert(tables.variant_versions).values(
                    id=variant_version_id,
                    skill_id=variant["skill_id"],
                    variant_id=variant_id,
                    version_number=version_number,
                    content_ref=self._content_ref_payload(content_ref),
                    content_digest=content_ref.digest,
                    change_summary=change_summary,
                    created_at=created_at,
                    created_by=actor,
                )
            )
            if make_current:
                connection.execute(
                    update(tables.variants)
                    .where(tables.variants.c.id == variant_id)
                    .values(current_version_id=variant_version_id, updated_at=created_at)
                )

        return CreateVariantVersionResult(
            skill_id=variant["skill_id"],
            variant_id=variant_id,
            variant_version_id=variant_version_id,
            version_number=version_number,
        )

    def promote_variant_version(
        self,
        *,
        variant_id: str,
        version_id: str,
        evidence_eval_run_id: str | None = None,
        eval_set_version_id: str | None = None,
        decision_note: str | None = None,
        accept_risk: bool = False,
        actor: str = "system",
    ) -> dict[str, Any]:
        updated_at = utc_now()
        with self.engine.begin() as connection:
            variant = self._variant_row(connection, variant_id)
            version = self._variant_version_row(connection, version_id)
            if version["variant_id"] != variant_id:
                raise InvariantError("Variant current_version_id must point to its own version.")
            if evidence_eval_run_id is None or eval_set_version_id is None:
                raise InvariantError("Promotion requires evidence eval run and eval set version.")

            evidence_run = self._eval_run_row(connection, evidence_eval_run_id)
            if evidence_run["variant_version_id"] != version_id:
                raise InvariantError("Promotion evidence eval run must bind the candidate version.")
            if evidence_run["eval_set_version_id"] != eval_set_version_id:
                raise InvariantError("Promotion evidence eval run must bind the requested eval set version.")
            if evidence_run["status"] != "finished":
                raise InvariantError("Promotion evidence eval run must be finished.")

            review = self._promotion_review(
                connection,
                variant_id=variant_id,
                candidate_version_id=version_id,
                eval_set_version_id=eval_set_version_id,
            )
            if review["candidate_run"] is None or review["candidate_run"]["id"] != evidence_eval_run_id:
                raise InvariantError("Promotion evidence eval run must be the latest finished candidate run.")
            readiness = review["readiness"]
            if readiness["status"] in {"unverified", "blocked"}:
                raise InvariantError(f"Promotion is not ready: {readiness['reason']}")
            if readiness["requires_note"] and not (decision_note or "").strip():
                raise InvariantError("Promotion decision note is required when review has risk.")
            if readiness["requires_note"] and not accept_risk:
                raise InvariantError("Promotion risk must be accepted before promoting this version.")

            decision_id = new_id("promodec")
            audit_event_id = new_id("audit")
            from_version_id = variant["current_version_id"]
            baseline_run = review["current_run"]
            clean_note = (decision_note or "").strip()

            connection.execute(
                update(tables.variants)
                .where(tables.variants.c.id == variant_id)
                .values(current_version_id=version_id, updated_at=updated_at)
            )
            connection.execute(
                insert(tables.promotion_decisions).values(
                    id=decision_id,
                    skill_id=variant["skill_id"],
                    variant_id=variant_id,
                    from_version_id=from_version_id,
                    to_version_id=version_id,
                    eval_set_version_id=eval_set_version_id,
                    evidence_eval_run_id=evidence_eval_run_id,
                    baseline_eval_run_id=baseline_run["id"] if baseline_run is not None else None,
                    readiness_status=readiness["status"],
                    summary=review["comparison_summary"],
                    decision_note=clean_note,
                    created_at=updated_at,
                    created_by=actor,
                )
            )
            connection.execute(
                insert(tables.audit_events).values(
                    id=audit_event_id,
                    actor_ref=actor,
                    action="variant.promoted",
                    resource_type="variant",
                    resource_id=variant_id,
                    payload={
                        "promotion_decision_id": decision_id,
                        "from_version_id": from_version_id,
                        "to_version_id": version_id,
                        "evidence_eval_run_id": evidence_eval_run_id,
                        "eval_set_version_id": eval_set_version_id,
                        "readiness_status": readiness["status"],
                    },
                    created_at=updated_at,
                )
            )

        return {
            "id": decision_id,
            "skill_id": variant["skill_id"],
            "variant_id": variant_id,
            "from_version_id": from_version_id,
            "to_version_id": version_id,
            "eval_set_version_id": eval_set_version_id,
            "evidence_eval_run_id": evidence_eval_run_id,
            "baseline_eval_run_id": baseline_run["id"] if baseline_run is not None else None,
            "readiness_status": readiness["status"],
            "summary": review["comparison_summary"],
            "decision_note": clean_note,
            "created_at": updated_at,
            "created_by": actor,
        }

    def create_variant(
        self,
        *,
        skill_id: str,
        name: str,
        label: str,
        summary: str,
        tags: list[str],
        content_ref: ContentRef,
        change_summary: str,
        actor: str,
        make_default: bool,
    ) -> CreateVariantResult:
        normalized_tags = normalize_tags(tags)
        normalized_hash = digest_text("\n".join(normalized_tags))
        created_at = utc_now()
        variant_id = new_id("variant")
        variant_version_id = new_id("varver")

        with self.engine.begin() as connection:
            self._skill_row(connection, skill_id)
            tag_set_id = self._get_or_create_tag_set(
                connection,
                tags=normalized_tags,
                normalized_hash=normalized_hash,
                created_at=created_at,
            )
            connection.execute(
                insert(tables.variants).values(
                    id=variant_id,
                    skill_id=skill_id,
                    name=name,
                    label=label,
                    summary=summary,
                    tag_set_id=tag_set_id,
                    current_version_id=None,
                    lifecycle_status="active",
                    created_at=created_at,
                    updated_at=created_at,
                )
            )
            connection.execute(
                insert(tables.variant_versions).values(
                    id=variant_version_id,
                    skill_id=skill_id,
                    variant_id=variant_id,
                    version_number=1,
                    content_ref=self._content_ref_payload(content_ref),
                    content_digest=content_ref.digest,
                    change_summary=change_summary,
                    created_at=created_at,
                    created_by=actor,
                )
            )
            connection.execute(
                update(tables.variants)
                .where(tables.variants.c.id == variant_id)
                .values(current_version_id=variant_version_id, updated_at=created_at)
            )
            if make_default:
                connection.execute(
                    update(tables.skills)
                    .where(tables.skills.c.id == skill_id)
                    .values(default_variant_id=variant_id, updated_at=created_at)
                )

        return CreateVariantResult(
            skill_id=skill_id,
            tag_set_id=tag_set_id,
            variant_id=variant_id,
            variant_version_id=variant_version_id,
        )

    def update_skill(self, *, skill_id: str, slug: str, owner_ref: str) -> dict[str, Any]:
        updated_at = utc_now()
        with self.engine.begin() as connection:
            self._skill_row(connection, skill_id)
            connection.execute(
                update(tables.skills)
                .where(tables.skills.c.id == skill_id)
                .values(slug=slug, owner_ref=owner_ref, updated_at=updated_at)
            )
            return self._row_dict(self._skill_row(connection, skill_id))

    def archive_skill(self, *, skill_id: str) -> None:
        updated_at = utc_now()
        with self.engine.begin() as connection:
            self._skill_row(connection, skill_id)
            connection.execute(
                update(tables.skills)
                .where(tables.skills.c.id == skill_id)
                .values(lifecycle_status="archived", updated_at=updated_at)
            )

    def create_text_artifact(self, *, kind: str, namespace: str, content: str, actor: str) -> dict[str, Any]:
        created_at = utc_now()
        with self.engine.begin() as connection:
            artifact_id = self._insert_text_artifact(
                connection,
                kind=kind,
                namespace=namespace,
                content=content,
                actor=actor,
                created_at=created_at,
            )
            artifact = connection.execute(select(tables.artifacts).where(tables.artifacts.c.id == artifact_id)).mappings().one()
            return self._row_dict(artifact)

    def update_eval_case_title(self, *, case_id: str, title: str) -> dict[str, Any]:
        updated_at = utc_now()
        with self.engine.begin() as connection:
            self._eval_case_row(connection, case_id)
            connection.execute(
                update(tables.eval_cases)
                .where(tables.eval_cases.c.id == case_id)
                .values(title=title, updated_at=updated_at)
            )
            return self._row_dict(self._eval_case_row(connection, case_id))

    def archive_eval_case(self, *, case_id: str, actor: str) -> CreateEvalCaseResult:
        updated_at = utc_now()
        with self.engine.begin() as connection:
            eval_case = self._eval_case_row(connection, case_id)
            skill_id = eval_case["skill_id"]
            eval_set = self._primary_eval_set_row(connection, skill_id)
            current_eval_set_version = self._eval_set_version_row(connection, eval_set["current_version_id"])
            connection.execute(
                update(tables.eval_cases)
                .where(tables.eval_cases.c.id == case_id)
                .values(lifecycle_status="archived", updated_at=updated_at)
            )
            next_case_version_ids = [
                case_version_id
                for case_version_id in self._eval_set_case_version_ids(connection, current_eval_set_version["id"])
                if self._eval_case_version_row(connection, case_version_id)["case_id"] != case_id
            ]
            eval_set_version_id = self._create_eval_set_version(
                connection,
                skill_id=skill_id,
                eval_set_id=eval_set["id"],
                case_version_ids=next_case_version_ids,
                created_at=updated_at,
                actor=actor,
            )

        return CreateEvalCaseResult(
            skill_id=skill_id,
            eval_set_id=eval_set["id"],
            eval_set_version_id=eval_set_version_id,
            eval_case_id=case_id,
            eval_case_version_id=eval_case["current_version_id"],
            input_artifact_id="",
            expected_output_artifact_id="",
        )

    def create_eval_case(
        self,
        *,
        skill_id: str,
        title: str,
        input_text: str,
        expected_output: str,
        actor: str,
        notes: str | None = None,
    ) -> CreateEvalCaseResult:
        created_at = utc_now()
        eval_case_id = new_id("case")
        eval_case_version_id = new_id("casever")

        with self.engine.begin() as connection:
            eval_set = self._primary_eval_set_row(connection, skill_id)
            current_eval_set_version = self._eval_set_version_row(connection, eval_set["current_version_id"])
            input_artifact_id = self._insert_text_artifact(
                connection,
                kind="eval_input",
                namespace=skill_id,
                content=input_text,
                actor=actor,
                created_at=created_at,
            )
            expected_output_artifact_id = self._insert_text_artifact(
                connection,
                kind="expected_output",
                namespace=skill_id,
                content=expected_output,
                actor=actor,
                created_at=created_at,
            )

            connection.execute(
                insert(tables.eval_cases).values(
                    id=eval_case_id,
                    skill_id=skill_id,
                    title=title,
                    current_version_id=None,
                    lifecycle_status="active",
                    created_at=created_at,
                    updated_at=created_at,
                )
            )
            connection.execute(
                insert(tables.eval_case_versions).values(
                    id=eval_case_version_id,
                    skill_id=skill_id,
                    case_id=eval_case_id,
                    version_number=1,
                    input_artifact_id=input_artifact_id,
                    expected_output_artifact_id=expected_output_artifact_id,
                    notes=notes,
                    created_at=created_at,
                    created_by=actor,
                )
            )
            connection.execute(
                update(tables.eval_cases)
                .where(tables.eval_cases.c.id == eval_case_id)
                .values(current_version_id=eval_case_version_id, updated_at=created_at)
            )

            eval_set_version_id = self._create_eval_set_version(
                connection,
                skill_id=skill_id,
                eval_set_id=eval_set["id"],
                case_version_ids=[
                    *self._eval_set_case_version_ids(connection, current_eval_set_version["id"]),
                    eval_case_version_id,
                ],
                created_at=created_at,
                actor=actor,
            )

        return CreateEvalCaseResult(
            skill_id=skill_id,
            eval_set_id=eval_set["id"],
            eval_set_version_id=eval_set_version_id,
            eval_case_id=eval_case_id,
            eval_case_version_id=eval_case_version_id,
            input_artifact_id=input_artifact_id,
            expected_output_artifact_id=expected_output_artifact_id,
        )

    def create_eval_case_version(
        self,
        *,
        case_id: str,
        input_text: str,
        expected_output: str,
        actor: str,
        notes: str | None = None,
        make_current: bool = True,
    ) -> CreateEvalCaseResult:
        created_at = utc_now()
        eval_case_version_id = new_id("casever")

        with self.engine.begin() as connection:
            eval_case = self._eval_case_row(connection, case_id)
            skill_id = eval_case["skill_id"]
            version_number = self._next_eval_case_version_number(connection, case_id)
            input_artifact_id = self._insert_text_artifact(
                connection,
                kind="eval_input",
                namespace=skill_id,
                content=input_text,
                actor=actor,
                created_at=created_at,
            )
            expected_output_artifact_id = self._insert_text_artifact(
                connection,
                kind="expected_output",
                namespace=skill_id,
                content=expected_output,
                actor=actor,
                created_at=created_at,
            )
            connection.execute(
                insert(tables.eval_case_versions).values(
                    id=eval_case_version_id,
                    skill_id=skill_id,
                    case_id=case_id,
                    version_number=version_number,
                    input_artifact_id=input_artifact_id,
                    expected_output_artifact_id=expected_output_artifact_id,
                    notes=notes,
                    created_at=created_at,
                    created_by=actor,
                )
            )

            eval_set = self._primary_eval_set_row(connection, skill_id)
            eval_set_version_id = eval_set["current_version_id"]
            if make_current:
                connection.execute(
                    update(tables.eval_cases)
                    .where(tables.eval_cases.c.id == case_id)
                    .values(current_version_id=eval_case_version_id, updated_at=created_at)
                )
                current_eval_set_version = self._eval_set_version_row(connection, eval_set["current_version_id"])
                eval_set_version_id = self._create_eval_set_version(
                    connection,
                    skill_id=skill_id,
                    eval_set_id=eval_set["id"],
                    case_version_ids=[
                        eval_case_version_id
                        if self._eval_case_version_row(connection, case_version_id)["case_id"] == case_id
                        else case_version_id
                        for case_version_id in self._eval_set_case_version_ids(connection, current_eval_set_version["id"])
                    ],
                    created_at=created_at,
                    actor=actor,
                )

        return CreateEvalCaseResult(
            skill_id=skill_id,
            eval_set_id=eval_set["id"],
            eval_set_version_id=eval_set_version_id,
            eval_case_id=case_id,
            eval_case_version_id=eval_case_version_id,
            input_artifact_id=input_artifact_id,
            expected_output_artifact_id=expected_output_artifact_id,
        )

    def record_eval_run(
        self,
        *,
        variant_version_id: str,
        eval_set_version_id: str,
        strategy: str,
        results: dict[str, bool],
        actor: str,
    ) -> RecordEvalRunResult:
        created_at = utc_now()
        eval_run_id = new_id("evalrun")

        with self.engine.begin() as connection:
            variant_version = self._variant_version_row(connection, variant_version_id)
            eval_set_version = self._eval_set_version_row(connection, eval_set_version_id)
            if variant_version["skill_id"] != eval_set_version["skill_id"]:
                raise InvariantError("EvalRun must bind a variant version and eval set version from the same skill.")
            skill_id = variant_version["skill_id"]
            case_version_ids = self._eval_set_case_version_ids(connection, eval_set_version_id)
            passed_count = sum(1 for case_version_id in case_version_ids if results.get(case_version_id, False))
            failed_count = len(case_version_ids) - passed_count
            summary = {
                "passed": passed_count,
                "failed": failed_count,
                "total": len(case_version_ids),
            }

            connection.execute(
                insert(tables.eval_runs).values(
                    id=eval_run_id,
                    skill_id=skill_id,
                    variant_version_id=variant_version_id,
                    eval_set_version_id=eval_set_version_id,
                    strategy=strategy,
                    status="finished",
                    summary=summary,
                    result_artifact_id=None,
                    created_at=created_at,
                    created_by=actor,
                )
            )
            connection.execute(
                insert(tables.case_results),
                [
                    {
                        "run_id": eval_run_id,
                        "skill_id": skill_id,
                        "case_version_id": case_version_id,
                        "passed": results.get(case_version_id, False),
                        "score": 1 if results.get(case_version_id, False) else 0,
                        "result_artifact_id": None,
                        "created_at": created_at,
                    }
                    for case_version_id in case_version_ids
                ],
            )

        return RecordEvalRunResult(
            eval_run_id=eval_run_id,
            skill_id=skill_id,
            variant_version_id=variant_version_id,
            eval_set_version_id=eval_set_version_id,
            passed=passed_count,
            failed=failed_count,
            total=len(case_version_ids),
        )

    def list_skills(self) -> list[dict[str, Any]]:
        with self.engine.connect() as connection:
            skill_rows = (
                connection.execute(
                    select(tables.skills)
                    .where(tables.skills.c.lifecycle_status == "active")
                    .order_by(tables.skills.c.slug)
                )
                .mappings()
                .all()
            )
            return [self._skill_summary(connection, skill) for skill in skill_rows]

    def skill_detail(self, skill_id: str) -> dict[str, Any]:
        with self.engine.connect() as connection:
            skill = self._skill_row(connection, skill_id)
            variant_rows = (
                connection.execute(
                    select(tables.variants)
                    .where(tables.variants.c.skill_id == skill_id)
                    .order_by(tables.variants.c.created_at, tables.variants.c.id)
                )
                .mappings()
                .all()
            )
            variants = [self._variant_detail(connection, variant) for variant in variant_rows]
            eval_set_rows = (
                connection.execute(
                    select(tables.eval_sets)
                    .where(tables.eval_sets.c.skill_id == skill_id)
                    .order_by(tables.eval_sets.c.name)
                )
                .mappings()
                .all()
            )
            eval_sets = [self._eval_set_summary(connection, eval_set) for eval_set in eval_set_rows]
            latest_runs = [
                self._row_dict(row)
                for row in connection.execute(
                    select(tables.eval_runs)
                    .where(tables.eval_runs.c.skill_id == skill_id)
                    .order_by(desc(tables.eval_runs.c.created_at))
                    .limit(10)
                )
                .mappings()
                .all()
            ]

            summary = self._skill_summary(connection, skill)

        return {
            "skill": self._row_dict(skill),
            "summary": summary,
            "variants": variants,
            "eval_sets": eval_sets,
            "latest_eval_runs": latest_runs,
        }

    def eval_set_version_detail(self, eval_set_version_id: str) -> EvalSetVersionDetail:
        with self.engine.connect() as connection:
            eval_set_version = self._eval_set_version_row(connection, eval_set_version_id)
            eval_set = (
                connection.execute(
                    select(tables.eval_sets).where(tables.eval_sets.c.id == eval_set_version["eval_set_id"])
                )
                .mappings()
                .one()
            )
            cases = self._eval_set_cases(connection, eval_set_version_id)

        return EvalSetVersionDetail(
            eval_set_version=self._row_dict(eval_set_version),
            eval_set=self._row_dict(eval_set),
            cases=cases,
        )

    def eval_run_detail(self, eval_run_id: str) -> EvalRunDetail:
        with self.engine.connect() as connection:
            eval_run = self._eval_run_row(connection, eval_run_id)
            skill = self._skill_row(connection, eval_run["skill_id"])
            variant_version = self._variant_version_row(connection, eval_run["variant_version_id"])
            eval_set_version = self._eval_set_version_row(connection, eval_run["eval_set_version_id"])
            result_rows = (
                connection.execute(
                    select(tables.case_results)
                    .where(tables.case_results.c.run_id == eval_run_id)
                    .order_by(tables.case_results.c.case_version_id)
                )
                .mappings()
                .all()
            )
            case_results = []
            for result in result_rows:
                case_version = self._eval_case_version_row(connection, result["case_version_id"])
                eval_case = self._eval_case_row(connection, case_version["case_id"])
                case_results.append(
                    {
                        "result": self._row_dict(result),
                        "case": self._row_dict(eval_case),
                        "case_version": self._case_version_detail(connection, case_version),
                    }
                )
            variant_version_detail = self._variant_version_detail(connection, variant_version)

        return EvalRunDetail(
            eval_run=self._row_dict(eval_run),
            skill=self._row_dict(skill),
            variant_version=variant_version_detail,
            eval_set_version=self._row_dict(eval_set_version),
            case_results=case_results,
        )

    def list_eval_runs_for_skill(
        self,
        *,
        skill_id: str,
        variant_version_id: str | None = None,
        eval_set_version_id: str | None = None,
        strategy: str | None = None,
        status: str | None = None,
        limit: int = 50,
    ) -> dict[str, Any]:
        safe_limit = max(1, min(limit, 200))
        with self.engine.connect() as connection:
            skill = self._skill_row(connection, skill_id)
            query = select(tables.eval_runs).where(tables.eval_runs.c.skill_id == skill_id)
            if variant_version_id:
                query = query.where(tables.eval_runs.c.variant_version_id == variant_version_id)
            if eval_set_version_id:
                query = query.where(tables.eval_runs.c.eval_set_version_id == eval_set_version_id)
            if strategy:
                query = query.where(tables.eval_runs.c.strategy == strategy)
            if status:
                query = query.where(tables.eval_runs.c.status == status)

            run_rows = (
                connection.execute(query.order_by(desc(tables.eval_runs.c.created_at), desc(tables.eval_runs.c.id)).limit(safe_limit))
                .mappings()
                .all()
            )
            runs = []
            for run in run_rows:
                variant_version = self._variant_version_row(connection, run["variant_version_id"])
                variant = self._variant_row(connection, variant_version["variant_id"])
                eval_set_version = self._eval_set_version_row(connection, run["eval_set_version_id"])
                eval_set = (
                    connection.execute(select(tables.eval_sets).where(tables.eval_sets.c.id == eval_set_version["eval_set_id"]))
                    .mappings()
                    .one()
                )
                runs.append(
                    {
                        "eval_run": self._row_dict(run),
                        "variant": {**self._row_dict(variant), "tags": self._tags_for_tag_set(connection, variant["tag_set_id"])},
                        "variant_version": self._row_dict(variant_version),
                        "eval_set": self._row_dict(eval_set),
                        "eval_set_version": self._row_dict(eval_set_version),
                        "accepted_verification": self._accepted_verification_for_eval_run(connection, run["id"]),
                    }
                )

        return {
            "skill": self._row_dict(skill),
            "runs": runs,
        }

    def compare_eval_runs(self, *, baseline_run_id: str, candidate_run_id: str) -> dict[str, Any]:
        with self.engine.connect() as connection:
            baseline_run = self._eval_run_row(connection, baseline_run_id)
            candidate_run = self._eval_run_row(connection, candidate_run_id)
            if baseline_run["skill_id"] != candidate_run["skill_id"]:
                raise InvariantError("Run comparison requires runs from the same skill.")
            if baseline_run["eval_set_version_id"] != candidate_run["eval_set_version_id"]:
                raise InvariantError("Run comparison requires the same EvalSetVersion.")
            if baseline_run["status"] != "finished" or candidate_run["status"] != "finished":
                raise InvariantError("Run comparison requires finished runs.")

            skill = self._skill_row(connection, baseline_run["skill_id"])
            eval_set_version = self._eval_set_version_row(connection, baseline_run["eval_set_version_id"])
            eval_set = (
                connection.execute(select(tables.eval_sets).where(tables.eval_sets.c.id == eval_set_version["eval_set_id"]))
                .mappings()
                .one()
            )
            baseline_version = self._variant_version_row(connection, baseline_run["variant_version_id"])
            candidate_version = self._variant_version_row(connection, candidate_run["variant_version_id"])
            baseline_variant = self._variant_row(connection, baseline_version["variant_id"])
            candidate_variant = self._variant_row(connection, candidate_version["variant_id"])
            baseline_results = self._case_results_by_case_version(connection, baseline_run["id"])
            candidate_results = self._case_results_by_case_version(connection, candidate_run["id"])
            case_comparisons, comparison_summary = build_run_case_comparisons(
                eval_set_cases=self._eval_set_cases(connection, eval_set_version["id"]),
                baseline_results=baseline_results,
                candidate_results=candidate_results,
            )

            return {
                "skill": self._row_dict(skill),
                "eval_set": self._row_dict(eval_set),
                "eval_set_version": self._row_dict(eval_set_version),
                "baseline": {
                    "eval_run": self._row_dict(baseline_run),
                    "variant": {**self._row_dict(baseline_variant), "tags": self._tags_for_tag_set(connection, baseline_variant["tag_set_id"])},
                    "variant_version": self._row_dict(baseline_version),
                },
                "candidate": {
                    "eval_run": self._row_dict(candidate_run),
                    "variant": {**self._row_dict(candidate_variant), "tags": self._tags_for_tag_set(connection, candidate_variant["tag_set_id"])},
                    "variant_version": self._row_dict(candidate_version),
                },
                "summary": build_run_comparison_summary(
                    baseline_summary=baseline_run["summary"],
                    candidate_summary=candidate_run["summary"],
                    comparison_summary=comparison_summary,
                ),
                "case_comparisons": case_comparisons,
                "candidate_accepted_verification": self._accepted_verification_for_eval_run(connection, candidate_run["id"]),
            }

    def accept_eval_run_verification(self, *, eval_run_id: str, note: str, actor: str) -> dict[str, Any]:
        accepted_at = utc_now()
        with self.engine.begin() as connection:
            eval_run = self._eval_run_row(connection, eval_run_id)
            if eval_run["status"] != "finished":
                raise InvariantError("Accepted verification requires a finished eval run.")
            variant_version = self._variant_version_row(connection, eval_run["variant_version_id"])
            variant = self._variant_row(connection, variant_version["variant_id"])
            eval_set_version = self._eval_set_version_row(connection, eval_run["eval_set_version_id"])
            if variant["skill_id"] != eval_run["skill_id"] or eval_set_version["skill_id"] != eval_run["skill_id"]:
                raise InvariantError("Accepted verification requires same-skill records.")

            clean_note = note.strip()
            existing = self._accepted_verification_for_variant_eval_set(
                connection,
                variant_id=variant["id"],
                eval_set_version_id=eval_set_version["id"],
            )
            values = {
                "skill_id": eval_run["skill_id"],
                "variant_id": variant["id"],
                "variant_version_id": variant_version["id"],
                "eval_set_version_id": eval_set_version["id"],
                "eval_run_id": eval_run["id"],
                "note": clean_note,
                "created_at": accepted_at,
                "created_by": actor,
            }
            if existing is None:
                accepted_id = new_id("accepted")
                connection.execute(insert(tables.accepted_verifications).values(id=accepted_id, **values))
            else:
                accepted_id = existing["id"]
                connection.execute(
                    update(tables.accepted_verifications)
                    .where(tables.accepted_verifications.c.id == accepted_id)
                    .values(**values)
                )

            connection.execute(
                insert(tables.audit_events).values(
                    id=new_id("audit"),
                    actor_ref=actor,
                    action="eval_run.accepted_verification_set",
                    resource_type="eval_run",
                    resource_id=eval_run["id"],
                    payload={
                        "accepted_verification_id": accepted_id,
                        "eval_run_id": eval_run["id"],
                        "variant_id": variant["id"],
                        "variant_version_id": variant_version["id"],
                        "eval_set_version_id": eval_set_version["id"],
                    },
                    created_at=accepted_at,
                )
            )
            accepted = self._accepted_verification_row(connection, accepted_id)

        return self._row_dict(accepted)

    def eval_case_history(self, case_id: str) -> dict[str, Any]:
        with self.engine.connect() as connection:
            eval_case = self._eval_case_row(connection, case_id)
            version_rows = (
                connection.execute(
                    select(tables.eval_case_versions)
                    .where(tables.eval_case_versions.c.case_id == case_id)
                    .order_by(desc(tables.eval_case_versions.c.version_number))
                )
                .mappings()
                .all()
            )
            versions = []
            for case_version in version_rows:
                membership_rows = (
                    connection.execute(
                        select(
                            tables.eval_set_case_versions.c.eval_set_version_id,
                            tables.eval_set_case_versions.c.position,
                            tables.eval_set_versions.c.eval_set_id,
                            tables.eval_set_versions.c.version_number,
                            tables.eval_set_versions.c.created_at,
                            tables.eval_set_versions.c.created_by,
                        )
                        .join(
                            tables.eval_set_versions,
                            tables.eval_set_case_versions.c.eval_set_version_id == tables.eval_set_versions.c.id,
                        )
                        .where(tables.eval_set_case_versions.c.case_version_id == case_version["id"])
                        .order_by(desc(tables.eval_set_versions.c.version_number))
                    )
                    .mappings()
                    .all()
                )
                versions.append(
                    {
                        "case_version": self._case_version_detail(connection, case_version),
                        "included_in_eval_set_versions": [
                            {
                                "id": membership["eval_set_version_id"],
                                "eval_set_id": membership["eval_set_id"],
                                "version_number": membership["version_number"],
                                "position": membership["position"],
                                "created_at": membership["created_at"],
                                "created_by": membership["created_by"],
                            }
                            for membership in membership_rows
                        ],
                    }
                )

        return {
            "case": self._row_dict(eval_case),
            "versions": versions,
        }

    def promotion_review(
        self,
        *,
        variant_id: str,
        candidate_version_id: str,
        eval_set_version_id: str | None = None,
    ) -> dict[str, Any]:
        with self.engine.connect() as connection:
            return self._promotion_review(
                connection,
                variant_id=variant_id,
                candidate_version_id=candidate_version_id,
                eval_set_version_id=eval_set_version_id,
            )

    def bundle_diff(self, *, left_variant_version_id: str, right_variant_version_id: str) -> dict[str, Any]:
        with self.engine.connect() as connection:
            left_version = self._variant_version_row(connection, left_variant_version_id)
            right_version = self._variant_version_row(connection, right_variant_version_id)
            if left_version["skill_id"] != right_version["skill_id"]:
                raise InvariantError("Bundle diff requires variant versions from the same skill.")

            return self._bundle_diff_from_versions(connection, left_version, right_version)

    def _bundle_diff_from_versions(self, connection, left_version, right_version) -> dict[str, Any]:
        _left_artifact, left_files = self._bundle_artifact_for_version(connection, left_version)
        _right_artifact, right_files = self._bundle_artifact_for_version(connection, right_version)
        left_by_path = {file["path"]: file for file in left_files}
        right_by_path = {file["path"]: file for file in right_files}
        summary = {"added": 0, "removed": 0, "changed": 0, "unchanged": 0, "binary": 0}
        files = []

        for path in sorted(set(left_by_path) | set(right_by_path)):
            left_file = left_by_path.get(path)
            right_file = right_by_path.get(path)
            if left_file is None:
                status = "added"
            elif right_file is None:
                status = "removed"
            elif left_file.get("sha256") == right_file.get("sha256"):
                status = "unchanged"
            else:
                status = "changed"
            summary[status] += 1
            if status == "unchanged":
                continue

            binary = bool((left_file or {}).get("binary") or (right_file or {}).get("binary"))
            if binary:
                summary["binary"] += 1
            diff_file = {
                "path": path,
                "status": status,
                "binary": binary,
                "left_digest": left_file.get("sha256") if left_file else None,
                "right_digest": right_file.get("sha256") if right_file else None,
                "left_size_bytes": left_file.get("size_bytes") if left_file else None,
                "right_size_bytes": right_file.get("size_bytes") if right_file else None,
            }
            left_text = left_file.get("content_text") if left_file else None
            right_text = right_file.get("content_text") if right_file else None
            left_text_readable = left_text is None or isinstance(left_text, str)
            right_text_readable = right_text is None or isinstance(right_text, str)
            if not binary and left_text_readable and right_text_readable:
                diff_file["hunks"] = self._line_diff_hunks(left_text, right_text)
            files.append(diff_file)

        return {
            "left": self._diff_version_summary(left_version),
            "right": self._diff_version_summary(right_version),
            "summary": summary,
            "files": files,
        }

    def _promotion_review(
        self,
        connection,
        *,
        variant_id: str,
        candidate_version_id: str,
        eval_set_version_id: str | None,
    ) -> dict[str, Any]:
        variant = self._variant_row(connection, variant_id)
        skill = self._skill_row(connection, variant["skill_id"])
        candidate_version = self._variant_version_row(connection, candidate_version_id)
        if candidate_version["variant_id"] != variant_id:
            raise InvariantError("Promotion candidate version must belong to the target variant.")

        if eval_set_version_id is None:
            eval_set = self._primary_eval_set_row(connection, variant["skill_id"])
            eval_set_version_id = eval_set["current_version_id"]
        eval_set_version = self._eval_set_version_row(connection, eval_set_version_id)
        if eval_set_version["skill_id"] != variant["skill_id"]:
            raise InvariantError("Promotion review requires an eval set version from the same skill.")
        eval_set = (
            connection.execute(select(tables.eval_sets).where(tables.eval_sets.c.id == eval_set_version["eval_set_id"]))
            .mappings()
            .one()
        )

        current_version = None
        if variant["current_version_id"] is not None:
            current_version = self._variant_version_row(connection, variant["current_version_id"])

        candidate_run = self._latest_finished_run(
            connection,
            variant_version_id=candidate_version_id,
            eval_set_version_id=eval_set_version_id,
        )
        current_run = (
            self._latest_finished_run(
                connection,
                variant_version_id=current_version["id"],
                eval_set_version_id=eval_set_version_id,
            )
            if current_version is not None
            else None
        )
        candidate_results = self._case_results_by_case_version(connection, candidate_run["id"]) if candidate_run else {}
        current_results = self._case_results_by_case_version(connection, current_run["id"]) if current_run else {}
        case_comparisons, comparison_summary = build_promotion_case_comparisons(
            eval_set_cases=self._eval_set_cases(connection, eval_set_version_id),
            current_results=current_results if current_run is not None else None,
            candidate_results=candidate_results if candidate_run is not None else None,
        )

        blocking_items = []
        bundle_diff = None
        if current_version is not None:
            try:
                bundle_diff = self._bundle_diff_from_versions(connection, current_version, candidate_version)
            except (InvariantError, NotFoundError):
                blocking_items.append("候选版本没有可审查的文件快照")

        readiness = build_promotion_readiness(
            candidate_run_present=candidate_run is not None,
            candidate_result_count=len(candidate_results),
            case_count=len(case_comparisons),
            comparison_summary=comparison_summary,
            case_comparisons=case_comparisons,
            blocking_items=blocking_items,
            eval_set_version_number=eval_set_version["version_number"],
        )

        return {
            "skill": self._row_dict(skill),
            "variant": {**self._row_dict(variant), "tags": self._tags_for_tag_set(connection, variant["tag_set_id"])},
            "current_version": self._variant_version_detail(connection, current_version) if current_version is not None else None,
            "candidate_version": self._variant_version_detail(connection, candidate_version),
            "eval_set": self._row_dict(eval_set),
            "eval_set_version": self._row_dict(eval_set_version),
            "candidate_run": self._row_dict(candidate_run) if candidate_run is not None else None,
            "current_run": self._row_dict(current_run) if current_run is not None else None,
            "readiness": readiness,
            "comparison_summary": comparison_summary,
            "case_comparisons": case_comparisons,
            "bundle_diff": bundle_diff,
        }

    def _latest_finished_run(self, connection, *, variant_version_id: str, eval_set_version_id: str):
        return (
            connection.execute(
                select(tables.eval_runs)
                .where(tables.eval_runs.c.variant_version_id == variant_version_id)
                .where(tables.eval_runs.c.eval_set_version_id == eval_set_version_id)
                .where(tables.eval_runs.c.status == "finished")
                .order_by(desc(tables.eval_runs.c.created_at), desc(tables.eval_runs.c.id))
                .limit(1)
            )
            .mappings()
            .one_or_none()
        )

    def _case_results_by_case_version(self, connection, run_id: str) -> dict[str, bool]:
        return {
            row["case_version_id"]: row["passed"]
            for row in connection.execute(
                select(tables.case_results.c.case_version_id, tables.case_results.c.passed).where(tables.case_results.c.run_id == run_id)
            )
            .mappings()
            .all()
        }

    def _get_or_create_tag_set(
        self,
        connection,
        *,
        tags: tuple[str, ...],
        normalized_hash: str,
        created_at: datetime,
    ) -> str:
        existing = connection.execute(
            select(tables.tag_sets.c.id).where(tables.tag_sets.c.normalized_hash == normalized_hash)
        ).scalar_one_or_none()
        if existing is not None:
            return existing
        tag_set_id = new_id("tagset")
        connection.execute(
            insert(tables.tag_sets).values(
                id=tag_set_id,
                tags=list(tags),
                normalized_hash=normalized_hash,
                created_at=created_at,
            )
        )
        return tag_set_id

    def _variant_row(self, connection, variant_id: str):
        row = (
            connection.execute(select(tables.variants).where(tables.variants.c.id == variant_id))
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise NotFoundError(f"Variant not found: {variant_id}")
        return row

    def _tags_for_tag_set(self, connection, tag_set_id: str) -> list[str]:
        row = (
            connection.execute(select(tables.tag_sets.c.tags).where(tables.tag_sets.c.id == tag_set_id))
            .mappings()
            .one()
        )
        return list(row["tags"])

    def _skill_row(self, connection, skill_id: str):
        row = (
            connection.execute(select(tables.skills).where(tables.skills.c.id == skill_id))
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise NotFoundError(f"Skill not found: {skill_id}")
        return row

    def _variant_version_row(self, connection, version_id: str):
        row = (
            connection.execute(select(tables.variant_versions).where(tables.variant_versions.c.id == version_id))
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise NotFoundError(f"VariantVersion not found: {version_id}")
        return row

    def _eval_case_row(self, connection, case_id: str):
        row = (
            connection.execute(select(tables.eval_cases).where(tables.eval_cases.c.id == case_id))
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise NotFoundError(f"EvalCase not found: {case_id}")
        return row

    def _eval_case_version_row(self, connection, case_version_id: str):
        row = (
            connection.execute(select(tables.eval_case_versions).where(tables.eval_case_versions.c.id == case_version_id))
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise NotFoundError(f"EvalCaseVersion not found: {case_version_id}")
        return row

    def _primary_eval_set_row(self, connection, skill_id: str):
        row = (
            connection.execute(
                select(tables.eval_sets)
                .where(tables.eval_sets.c.skill_id == skill_id)
                .where(tables.eval_sets.c.name == "Primary")
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise NotFoundError(f"Primary EvalSet not found for skill: {skill_id}")
        return row

    def _eval_set_version_row(self, connection, eval_set_version_id: str):
        row = (
            connection.execute(select(tables.eval_set_versions).where(tables.eval_set_versions.c.id == eval_set_version_id))
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise NotFoundError(f"EvalSetVersion not found: {eval_set_version_id}")
        return row

    def _eval_run_row(self, connection, eval_run_id: str):
        row = (
            connection.execute(select(tables.eval_runs).where(tables.eval_runs.c.id == eval_run_id))
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise NotFoundError(f"EvalRun not found: {eval_run_id}")
        return row

    def _accepted_verification_row(self, connection, accepted_verification_id: str):
        row = (
            connection.execute(
                select(tables.accepted_verifications).where(tables.accepted_verifications.c.id == accepted_verification_id)
            )
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise NotFoundError(f"AcceptedVerification not found: {accepted_verification_id}")
        return row

    def _accepted_verification_for_eval_run(self, connection, eval_run_id: str) -> dict[str, Any] | None:
        row = (
            connection.execute(select(tables.accepted_verifications).where(tables.accepted_verifications.c.eval_run_id == eval_run_id))
            .mappings()
            .one_or_none()
        )
        return self._row_dict(row) if row is not None else None

    def _accepted_verification_for_variant_eval_set(
        self,
        connection,
        *,
        variant_id: str,
        eval_set_version_id: str,
    ) -> dict[str, Any] | None:
        row = (
            connection.execute(
                select(tables.accepted_verifications)
                .where(tables.accepted_verifications.c.variant_id == variant_id)
                .where(tables.accepted_verifications.c.eval_set_version_id == eval_set_version_id)
            )
            .mappings()
            .one_or_none()
        )
        return self._row_dict(row) if row is not None else None

    def _next_variant_version_number(self, connection, variant_id: str) -> int:
        version_numbers = connection.execute(
            select(tables.variant_versions.c.version_number).where(tables.variant_versions.c.variant_id == variant_id)
        ).scalars()
        return 1 + max(version_numbers, default=0)

    def _next_eval_case_version_number(self, connection, case_id: str) -> int:
        version_numbers = connection.execute(
            select(tables.eval_case_versions.c.version_number).where(tables.eval_case_versions.c.case_id == case_id)
        ).scalars()
        return 1 + max(version_numbers, default=0)

    def _next_eval_set_version_number(self, connection, eval_set_id: str) -> int:
        version_numbers = connection.execute(
            select(tables.eval_set_versions.c.version_number).where(tables.eval_set_versions.c.eval_set_id == eval_set_id)
        ).scalars()
        return 1 + max(version_numbers, default=0)

    def _create_eval_set_version(
        self,
        connection,
        *,
        skill_id: str,
        eval_set_id: str,
        case_version_ids: list[str],
        created_at: datetime,
        actor: str,
    ) -> str:
        eval_set_version_id = new_id("evalsetver")
        connection.execute(
            insert(tables.eval_set_versions).values(
                id=eval_set_version_id,
                skill_id=skill_id,
                eval_set_id=eval_set_id,
                version_number=self._next_eval_set_version_number(connection, eval_set_id),
                created_at=created_at,
                created_by=actor,
            )
        )
        if case_version_ids:
            connection.execute(
                insert(tables.eval_set_case_versions),
                [
                    {
                        "eval_set_version_id": eval_set_version_id,
                        "skill_id": skill_id,
                        "case_version_id": case_version_id,
                        "position": position,
                    }
                    for position, case_version_id in enumerate(case_version_ids)
                ],
            )
        connection.execute(
            update(tables.eval_sets)
            .where(tables.eval_sets.c.id == eval_set_id)
            .values(current_version_id=eval_set_version_id, updated_at=created_at)
        )
        return eval_set_version_id

    def _eval_set_case_version_ids(self, connection, eval_set_version_id: str) -> list[str]:
        return list(
            connection.execute(
                select(tables.eval_set_case_versions.c.case_version_id)
                .where(tables.eval_set_case_versions.c.eval_set_version_id == eval_set_version_id)
                .order_by(tables.eval_set_case_versions.c.position)
            ).scalars()
        )

    def _insert_text_artifact(
        self,
        connection,
        *,
        kind: str,
        namespace: str,
        content: str,
        actor: str,
        created_at: datetime,
    ) -> str:
        artifact_id = new_id("artifact")
        content_digest = digest_text(content)
        existing = (
            connection.execute(
                select(tables.artifacts.c.id)
                .where(tables.artifacts.c.locator == f"inline:{content_digest}")
                .where(tables.artifacts.c.digest == content_digest)
            )
            .scalars()
            .one_or_none()
        )
        if existing is not None:
            return existing
        connection.execute(
            insert(tables.artifacts).values(
                id=artifact_id,
                kind=kind,
                namespace=namespace,
                locator=f"inline:{content_digest}",
                digest=content_digest,
                media_type="text/plain",
                size_bytes=len(content.encode("utf-8")),
                content_text=content,
                created_at=created_at,
                created_by=actor,
            )
        )
        return artifact_id

    def _content_ref_payload(self, content_ref: ContentRef) -> dict[str, str]:
        payload = {
            "kind": content_ref.kind,
            "locator": content_ref.locator,
            "digest": content_ref.digest,
        }
        if content_ref.path is not None:
            payload["path"] = content_ref.path
        return payload

    def _skill_summary(self, connection, skill) -> dict[str, Any]:
        default_variant = None
        current_version = None
        primary_eval_set = None
        current_eval_set_version = None
        latest_eval_run = None

        if skill["default_variant_id"]:
            default_variant = self._variant_detail(
                connection,
                self._variant_row(connection, skill["default_variant_id"]),
            )
            current_version = default_variant["current_version"]

        primary_row = (
            connection.execute(
                select(tables.eval_sets)
                .where(tables.eval_sets.c.skill_id == skill["id"])
                .where(tables.eval_sets.c.name == "Primary")
            )
            .mappings()
            .one_or_none()
        )
        if primary_row is not None:
            primary_eval_set = self._eval_set_summary(connection, primary_row)
            current_eval_set_version = primary_eval_set["current_version"]

        if current_version is not None and current_eval_set_version is not None:
            accepted = self._accepted_verification_for_variant_eval_set(
                connection,
                variant_id=default_variant["id"],
                eval_set_version_id=current_eval_set_version["id"],
            )
            latest_row = None
            if accepted is not None:
                accepted_run = self._eval_run_row(connection, accepted["eval_run_id"])
                if accepted_run["variant_version_id"] == current_version["id"] and accepted_run["status"] == "finished":
                    latest_row = accepted_run
            if latest_row is None:
                latest_row = (
                    connection.execute(
                        select(tables.eval_runs)
                        .where(tables.eval_runs.c.variant_version_id == current_version["id"])
                        .where(tables.eval_runs.c.eval_set_version_id == current_eval_set_version["id"])
                        .where(tables.eval_runs.c.status == "finished")
                        .order_by(desc(tables.eval_runs.c.created_at))
                        .limit(1)
                    )
                    .mappings()
                    .one_or_none()
                )
            latest_eval_run = self._row_dict(latest_row) if latest_row is not None else None

        return {
            "skill": self._row_dict(skill),
            "default_variant": default_variant,
            "primary_eval_set": primary_eval_set,
            "latest_accepted_eval_run": latest_eval_run,
        }

    def _variant_detail(self, connection, variant) -> dict[str, Any]:
        versions = [
            self._variant_version_detail(connection, row)
            for row in connection.execute(
                select(tables.variant_versions)
                .where(tables.variant_versions.c.variant_id == variant["id"])
                .order_by(desc(tables.variant_versions.c.version_number))
            )
            .mappings()
            .all()
        ]
        tag_set = (
            connection.execute(
                select(tables.tag_sets).where(tables.tag_sets.c.id == variant["tag_set_id"])
            )
            .mappings()
            .one()
        )
        current_version = next(
            (version for version in versions if version["id"] == variant["current_version_id"]),
            None,
        )
        return {
            **self._row_dict(variant),
            "tags": list(tag_set["tags"]),
            "current_version": current_version,
            "versions": versions,
        }

    def _variant_version_detail(self, connection, version) -> dict[str, Any]:
        detail = self._row_dict(version)
        content_ref = detail.get("content_ref") or {}
        locator = content_ref.get("locator") if isinstance(content_ref, dict) else None
        if content_ref.get("kind") == "artifact" and isinstance(locator, str) and locator.startswith("artifact:"):
            artifact_id = locator.split(":", 1)[1]
            artifact = (
                connection.execute(select(tables.artifacts).where(tables.artifacts.c.id == artifact_id))
                .mappings()
                .one_or_none()
            )
            if artifact is not None:
                artifact_detail = self._row_dict(artifact)
                detail["bundle_artifact"] = artifact_detail
                detail["bundle_files"] = self._bundle_files_from_artifact(artifact_detail)
        return detail

    def _bundle_artifact_for_version(self, connection, version) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        content_ref = version["content_ref"] or {}
        locator = content_ref.get("locator") if isinstance(content_ref, dict) else None
        if content_ref.get("kind") != "artifact" or not isinstance(locator, str) or not locator.startswith("artifact:"):
            raise InvariantError(f"VariantVersion has no skill_bundle artifact to diff: {version['id']}")
        artifact_id = locator.split(":", 1)[1]
        artifact = (
            connection.execute(select(tables.artifacts).where(tables.artifacts.c.id == artifact_id))
            .mappings()
            .one_or_none()
        )
        if artifact is None:
            raise NotFoundError(f"Artifact not found: {artifact_id}")
        artifact_detail = self._row_dict(artifact)
        if artifact_detail["kind"] != "skill_bundle":
            raise InvariantError(f"VariantVersion artifact is not a skill_bundle: {version['id']}")
        files = self._bundle_files_from_artifact(artifact_detail)
        if not files:
            raise InvariantError(f"VariantVersion skill_bundle has no readable files: {version['id']}")
        return artifact_detail, files

    def _bundle_files_from_artifact(self, artifact: dict[str, Any]) -> list[dict[str, Any]]:
        content_text = artifact.get("content_text")
        if not isinstance(content_text, str):
            return []
        try:
            manifest = json.loads(content_text)
        except json.JSONDecodeError:
            return []
        files = manifest.get("files") if isinstance(manifest, dict) else None
        if not isinstance(files, list):
            return []
        normalized_files = [file for file in files if isinstance(file, dict) and isinstance(file.get("path"), str)]
        return sorted(normalized_files, key=lambda file: file["path"])

    def _diff_version_summary(self, version) -> dict[str, Any]:
        return {
            "variant_version_id": version["id"],
            "version_number": version["version_number"],
            "content_digest": version["content_digest"],
        }

    def _line_diff_hunks(self, left_text: str | None, right_text: str | None) -> list[dict[str, Any]]:
        left_lines = [] if left_text is None else left_text.splitlines()
        right_lines = [] if right_text is None else right_text.splitlines()
        lines = []
        matcher = SequenceMatcher(a=left_lines, b=right_lines)
        for tag, left_start, left_end, right_start, right_end in matcher.get_opcodes():
            if tag == "equal":
                for offset, text in enumerate(left_lines[left_start:left_end]):
                    lines.append(
                        {
                            "kind": "context",
                            "old_line": left_start + offset + 1,
                            "new_line": right_start + offset + 1,
                            "text": text,
                        }
                    )
            if tag in {"delete", "replace"}:
                for offset, text in enumerate(left_lines[left_start:left_end]):
                    lines.append(
                        {
                            "kind": "removed",
                            "old_line": left_start + offset + 1,
                            "new_line": None,
                            "text": text,
                        }
                    )
            if tag in {"insert", "replace"}:
                for offset, text in enumerate(right_lines[right_start:right_end]):
                    lines.append(
                        {
                            "kind": "added",
                            "old_line": None,
                            "new_line": right_start + offset + 1,
                            "text": text,
                        }
                    )
        if not lines:
            return []
        return [
            {
                "old_start": 1 if left_lines else 0,
                "old_lines": len(left_lines),
                "new_start": 1 if right_lines else 0,
                "new_lines": len(right_lines),
                "lines": lines,
            }
        ]

    def _eval_set_summary(self, connection, eval_set) -> dict[str, Any]:
        versions = [
            self._row_dict(row)
            for row in connection.execute(
                select(tables.eval_set_versions)
                .where(tables.eval_set_versions.c.eval_set_id == eval_set["id"])
                .order_by(desc(tables.eval_set_versions.c.version_number))
            )
            .mappings()
            .all()
        ]
        current_version = next(
            (version for version in versions if version["id"] == eval_set["current_version_id"]),
            None,
        )
        return {
            **self._row_dict(eval_set),
            "current_version": current_version,
            "versions": versions,
        }

    def _eval_set_cases(self, connection, eval_set_version_id: str) -> list[dict[str, Any]]:
        memberships = (
            connection.execute(
                select(tables.eval_set_case_versions)
                .where(tables.eval_set_case_versions.c.eval_set_version_id == eval_set_version_id)
                .order_by(tables.eval_set_case_versions.c.position)
            )
            .mappings()
            .all()
        )
        cases = []
        for membership in memberships:
            case_version = self._eval_case_version_row(connection, membership["case_version_id"])
            eval_case = self._eval_case_row(connection, case_version["case_id"])
            cases.append(
                {
                    "position": membership["position"],
                    "case": self._row_dict(eval_case),
                    "case_version": self._case_version_detail(connection, case_version),
                }
            )
        return cases

    def _case_version_detail(self, connection, case_version) -> dict[str, Any]:
        input_artifact = (
            connection.execute(select(tables.artifacts).where(tables.artifacts.c.id == case_version["input_artifact_id"]))
            .mappings()
            .one()
        )
        expected_output_artifact = (
            connection.execute(
                select(tables.artifacts).where(tables.artifacts.c.id == case_version["expected_output_artifact_id"])
            )
            .mappings()
            .one()
        )
        return {
            **self._row_dict(case_version),
            "input_artifact": self._row_dict(input_artifact),
            "expected_output_artifact": self._row_dict(expected_output_artifact),
        }

    def _row_dict(self, row) -> dict[str, Any]:
        return dict(row)
