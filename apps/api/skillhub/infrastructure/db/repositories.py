from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import Engine, insert, select, update

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

    def _content_ref_payload(self, content_ref: ContentRef) -> dict[str, str]:
        payload = {
            "kind": content_ref.kind,
            "locator": content_ref.locator,
            "digest": content_ref.digest,
        }
        if content_ref.path is not None:
            payload["path"] = content_ref.path
        return payload
