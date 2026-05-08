from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import json
from typing import Any

from sqlalchemy import Engine, desc, insert, select, update
from sqlalchemy.exc import IntegrityError

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

    def promote_variant_version(self, *, variant_id: str, version_id: str) -> None:
        updated_at = utc_now()
        with self.engine.begin() as connection:
            variant = self._variant_row(connection, variant_id)
            version = self._variant_version_row(connection, version_id)
            if version["variant_id"] != variant_id:
                raise InvariantError("Variant current_version_id must point to its own version.")
            connection.execute(
                update(tables.variants)
                .where(tables.variants.c.id == variant_id)
                .values(current_version_id=version_id, updated_at=updated_at)
            )

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

        return EvalRunDetail(
            eval_run=self._row_dict(eval_run),
            skill=self._row_dict(skill),
            variant_version=self._variant_version_detail(connection, variant_version),
            eval_set_version=self._row_dict(eval_set_version),
            case_results=case_results,
        )

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
