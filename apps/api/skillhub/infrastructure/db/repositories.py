from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import Engine, insert, select, update

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

    def _variant_version_row(self, connection, version_id: str):
        row = (
            connection.execute(select(tables.variant_versions).where(tables.variant_versions.c.id == version_id))
            .mappings()
            .one_or_none()
        )
        if row is None:
            raise NotFoundError(f"VariantVersion not found: {version_id}")
        return row

    def _next_variant_version_number(self, connection, variant_id: str) -> int:
        version_numbers = connection.execute(
            select(tables.variant_versions.c.version_number).where(tables.variant_versions.c.variant_id == variant_id)
        ).scalars()
        return 1 + max(version_numbers, default=0)

    def _content_ref_payload(self, content_ref: ContentRef) -> dict[str, str]:
        payload = {
            "kind": content_ref.kind,
            "locator": content_ref.locator,
            "digest": content_ref.digest,
        }
        if content_ref.path is not None:
            payload["path"] = content_ref.path
        return payload
