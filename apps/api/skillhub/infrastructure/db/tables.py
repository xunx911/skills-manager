from __future__ import annotations

from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    JSON,
    MetaData,
    PrimaryKeyConstraint,
    Table,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB


metadata = MetaData()

# This metadata backs application queries and fast SQLite repository tests.
# PostgreSQL migrations still execute schema.sql as the authoritative DDL.


def timestamp_column(name: str = "created_at") -> Column[DateTime]:
    return Column(name, DateTime(timezone=True), nullable=False, server_default=text("now()"))


artifacts = Table(
    "artifacts",
    metadata,
    Column("id", Text, primary_key=True),
    Column("kind", Text, nullable=False),
    Column("namespace", Text, nullable=False),
    Column("locator", Text, nullable=False),
    Column("digest", Text, nullable=False),
    Column("media_type", Text, nullable=False),
    Column("size_bytes", BigInteger, nullable=False, server_default=text("0")),
    timestamp_column(),
    Column("created_by", Text, nullable=False),
    CheckConstraint("size_bytes >= 0", name="artifacts_size_bytes_non_negative"),
    UniqueConstraint("locator", "digest", name="artifacts_locator_digest_unique"),
)

tag_sets = Table(
    "tag_sets",
    metadata,
    Column("id", Text, primary_key=True),
    Column("tags", ARRAY(Text).with_variant(JSON(), "sqlite"), nullable=False),
    Column("normalized_hash", Text, nullable=False, unique=True),
    timestamp_column(),
)

skills = Table(
    "skills",
    metadata,
    Column("id", Text, primary_key=True),
    Column("slug", Text, nullable=False, unique=True),
    Column("owner_ref", Text, nullable=False),
    Column("default_variant_id", Text),
    Column("lifecycle_status", Text, nullable=False, server_default=text("'active'")),
    timestamp_column(),
    timestamp_column("updated_at"),
    CheckConstraint("lifecycle_status in ('active', 'archived')", name="skills_lifecycle_status_check"),
)

variants = Table(
    "variants",
    metadata,
    Column("id", Text, primary_key=True),
    Column("skill_id", Text, ForeignKey("skills.id"), nullable=False),
    Column("name", Text, nullable=False),
    Column("label", Text, nullable=False),
    Column("summary", Text, nullable=False),
    Column("tag_set_id", Text, ForeignKey("tag_sets.id"), nullable=False),
    Column("current_version_id", Text),
    Column("lifecycle_status", Text, nullable=False, server_default=text("'active'")),
    timestamp_column(),
    timestamp_column("updated_at"),
    CheckConstraint("lifecycle_status in ('active', 'archived')", name="variants_lifecycle_status_check"),
    UniqueConstraint("id", "skill_id", name="variants_id_skill_unique"),
    UniqueConstraint("skill_id", "tag_set_id", name="variants_skill_tag_set_unique"),
)

variant_versions = Table(
    "variant_versions",
    metadata,
    Column("id", Text, primary_key=True),
    Column("skill_id", Text, nullable=False),
    Column("variant_id", Text, nullable=False),
    Column("version_number", Integer, nullable=False),
    Column("content_ref", JSONB().with_variant(JSON(), "sqlite"), nullable=False),
    Column("content_digest", Text, nullable=False),
    Column("change_summary", Text, nullable=False),
    timestamp_column(),
    Column("created_by", Text, nullable=False),
    CheckConstraint("version_number > 0", name="variant_versions_version_number_positive"),
    UniqueConstraint("variant_id", "version_number", name="variant_versions_variant_version_unique"),
    UniqueConstraint("id", "skill_id", name="variant_versions_id_skill_unique"),
    ForeignKeyConstraint(["variant_id", "skill_id"], ["variants.id", "variants.skill_id"], name="variant_versions_variant_skill_fkey"),
)

skills.append_constraint(
    ForeignKeyConstraint(["default_variant_id", "id"], ["variants.id", "variants.skill_id"], name="skills_default_variant_fkey")
)
variants.append_constraint(
    ForeignKeyConstraint(["current_version_id", "skill_id"], ["variant_versions.id", "variant_versions.skill_id"], name="variants_current_version_fkey")
)

eval_sets = Table(
    "eval_sets",
    metadata,
    Column("id", Text, primary_key=True),
    Column("skill_id", Text, ForeignKey("skills.id"), nullable=False),
    Column("name", Text, nullable=False),
    Column("description", Text, nullable=False, server_default=text("''")),
    Column("current_version_id", Text),
    Column("lifecycle_status", Text, nullable=False, server_default=text("'active'")),
    timestamp_column(),
    timestamp_column("updated_at"),
    CheckConstraint("lifecycle_status in ('active', 'archived')", name="eval_sets_lifecycle_status_check"),
    UniqueConstraint("id", "skill_id", name="eval_sets_id_skill_unique"),
    UniqueConstraint("skill_id", "name", name="eval_sets_skill_name_unique"),
)

eval_cases = Table(
    "eval_cases",
    metadata,
    Column("id", Text, primary_key=True),
    Column("skill_id", Text, ForeignKey("skills.id"), nullable=False),
    Column("title", Text, nullable=False),
    Column("current_version_id", Text),
    Column("lifecycle_status", Text, nullable=False, server_default=text("'active'")),
    timestamp_column(),
    timestamp_column("updated_at"),
    CheckConstraint("lifecycle_status in ('active', 'archived')", name="eval_cases_lifecycle_status_check"),
    UniqueConstraint("id", "skill_id", name="eval_cases_id_skill_unique"),
)

eval_case_versions = Table(
    "eval_case_versions",
    metadata,
    Column("id", Text, primary_key=True),
    Column("skill_id", Text, nullable=False),
    Column("case_id", Text, nullable=False),
    Column("version_number", Integer, nullable=False),
    Column("input_artifact_id", Text, ForeignKey("artifacts.id"), nullable=False),
    Column("expected_output_artifact_id", Text, ForeignKey("artifacts.id"), nullable=False),
    Column("notes", Text),
    timestamp_column(),
    Column("created_by", Text, nullable=False),
    CheckConstraint("version_number > 0", name="eval_case_versions_version_number_positive"),
    UniqueConstraint("case_id", "version_number", name="eval_case_versions_case_version_unique"),
    UniqueConstraint("id", "skill_id", name="eval_case_versions_id_skill_unique"),
    ForeignKeyConstraint(["case_id", "skill_id"], ["eval_cases.id", "eval_cases.skill_id"], name="eval_case_versions_case_skill_fkey"),
)

eval_cases.append_constraint(
    ForeignKeyConstraint(["current_version_id", "skill_id"], ["eval_case_versions.id", "eval_case_versions.skill_id"], name="eval_cases_current_version_fkey")
)

eval_set_versions = Table(
    "eval_set_versions",
    metadata,
    Column("id", Text, primary_key=True),
    Column("skill_id", Text, nullable=False),
    Column("eval_set_id", Text, nullable=False),
    Column("version_number", Integer, nullable=False),
    timestamp_column(),
    Column("created_by", Text, nullable=False),
    CheckConstraint("version_number > 0", name="eval_set_versions_version_number_positive"),
    UniqueConstraint("eval_set_id", "version_number", name="eval_set_versions_eval_set_version_unique"),
    UniqueConstraint("id", "skill_id", name="eval_set_versions_id_skill_unique"),
    ForeignKeyConstraint(["eval_set_id", "skill_id"], ["eval_sets.id", "eval_sets.skill_id"], name="eval_set_versions_eval_set_skill_fkey"),
)

eval_sets.append_constraint(
    ForeignKeyConstraint(["current_version_id", "skill_id"], ["eval_set_versions.id", "eval_set_versions.skill_id"], name="eval_sets_current_version_fkey")
)

eval_set_case_versions = Table(
    "eval_set_case_versions",
    metadata,
    Column("eval_set_version_id", Text, nullable=False),
    Column("skill_id", Text, nullable=False),
    Column("case_version_id", Text, nullable=False),
    Column("position", Integer, nullable=False),
    PrimaryKeyConstraint("eval_set_version_id", "position"),
    CheckConstraint("position >= 0", name="eval_set_case_versions_position_non_negative"),
    UniqueConstraint("eval_set_version_id", "case_version_id", name="eval_set_case_versions_case_unique"),
    ForeignKeyConstraint(["eval_set_version_id", "skill_id"], ["eval_set_versions.id", "eval_set_versions.skill_id"], name="eval_set_case_versions_set_skill_fkey"),
    ForeignKeyConstraint(["case_version_id", "skill_id"], ["eval_case_versions.id", "eval_case_versions.skill_id"], name="eval_set_case_versions_case_skill_fkey"),
)

eval_runs = Table(
    "eval_runs",
    metadata,
    Column("id", Text, primary_key=True),
    Column("skill_id", Text, nullable=False),
    Column("variant_version_id", Text, nullable=False),
    Column("eval_set_version_id", Text, nullable=False),
    Column("strategy", Text, nullable=False),
    Column("status", Text, nullable=False),
    Column("summary", JSONB().with_variant(JSON(), "sqlite"), nullable=False, server_default=text("'{}'")),
    Column("result_artifact_id", Text, ForeignKey("artifacts.id")),
    timestamp_column(),
    Column("created_by", Text, nullable=False),
    CheckConstraint("status in ('queued', 'running', 'finished', 'failed')", name="eval_runs_status_check"),
    UniqueConstraint("id", "skill_id", name="eval_runs_id_skill_unique"),
    ForeignKeyConstraint(["variant_version_id", "skill_id"], ["variant_versions.id", "variant_versions.skill_id"], name="eval_runs_variant_version_skill_fkey"),
    ForeignKeyConstraint(["eval_set_version_id", "skill_id"], ["eval_set_versions.id", "eval_set_versions.skill_id"], name="eval_runs_eval_set_version_skill_fkey"),
)

case_results = Table(
    "case_results",
    metadata,
    Column("run_id", Text, nullable=False),
    Column("skill_id", Text, nullable=False),
    Column("case_version_id", Text, nullable=False),
    Column("passed", Boolean, nullable=False),
    Column("score", Integer, nullable=False),
    Column("result_artifact_id", Text, ForeignKey("artifacts.id")),
    timestamp_column(),
    PrimaryKeyConstraint("run_id", "case_version_id"),
    CheckConstraint("score in (0, 1)", name="case_results_score_pass_fail"),
    ForeignKeyConstraint(["run_id", "skill_id"], ["eval_runs.id", "eval_runs.skill_id"], name="case_results_run_skill_fkey"),
    ForeignKeyConstraint(["case_version_id", "skill_id"], ["eval_case_versions.id", "eval_case_versions.skill_id"], name="case_results_case_skill_fkey"),
)

jobs = Table(
    "jobs",
    metadata,
    Column("id", Text, primary_key=True),
    Column("type", Text, nullable=False),
    Column("status", Text, nullable=False, server_default=text("'queued'")),
    Column("payload", JSONB().with_variant(JSON(), "sqlite"), nullable=False),
    Column("result_ref", Text),
    timestamp_column(),
    Column("started_at", DateTime(timezone=True)),
    Column("finished_at", DateTime(timezone=True)),
    Column("created_by", Text, nullable=False),
    Column("error", Text),
    CheckConstraint("status in ('queued', 'running', 'succeeded', 'failed', 'canceled')", name="jobs_status_check"),
)

role_assignments = Table(
    "role_assignments",
    metadata,
    Column("id", Text, primary_key=True),
    Column("subject_type", Text, nullable=False),
    Column("subject_id", Text, nullable=False),
    Column("resource_type", Text, nullable=False),
    Column("resource_id", Text, nullable=False),
    Column("role", Text, nullable=False),
    timestamp_column(),
    Column("created_by", Text, nullable=False),
    CheckConstraint("role in ('owner', 'maintainer', 'evaluator', 'viewer')", name="role_assignments_role_check"),
    UniqueConstraint("subject_type", "subject_id", "resource_type", "resource_id", "role", name="role_assignments_scope_unique"),
)

audit_events = Table(
    "audit_events",
    metadata,
    Column("id", Text, primary_key=True),
    Column("actor_ref", Text, nullable=False),
    Column("action", Text, nullable=False),
    Column("resource_type", Text, nullable=False),
    Column("resource_id", Text, nullable=False),
    Column("payload", JSONB().with_variant(JSON(), "sqlite"), nullable=False, server_default=text("'{}'")),
    timestamp_column(),
)

Index("artifacts_namespace_idx", artifacts.c.namespace)
Index("variants_skill_id_idx", variants.c.skill_id)
Index("variants_tag_set_id_idx", variants.c.tag_set_id)
Index("variant_versions_skill_id_idx", variant_versions.c.skill_id)
Index("variant_versions_variant_id_idx", variant_versions.c.variant_id)
Index("eval_sets_skill_id_idx", eval_sets.c.skill_id)
Index("eval_cases_skill_id_idx", eval_cases.c.skill_id)
Index("eval_case_versions_skill_id_idx", eval_case_versions.c.skill_id)
Index("eval_case_versions_case_id_idx", eval_case_versions.c.case_id)
Index("eval_set_versions_skill_id_idx", eval_set_versions.c.skill_id)
Index("eval_set_versions_eval_set_id_idx", eval_set_versions.c.eval_set_id)
Index("eval_set_case_versions_skill_id_idx", eval_set_case_versions.c.skill_id)
Index("eval_set_case_versions_case_version_id_idx", eval_set_case_versions.c.case_version_id)
Index("eval_runs_skill_id_created_at_idx", eval_runs.c.skill_id, eval_runs.c.created_at.desc())
Index("eval_runs_variant_version_id_idx", eval_runs.c.variant_version_id)
Index("eval_runs_eval_set_version_id_idx", eval_runs.c.eval_set_version_id)
Index("case_results_skill_id_idx", case_results.c.skill_id)
Index("case_results_case_version_id_idx", case_results.c.case_version_id)
Index("jobs_status_created_at_idx", jobs.c.status, jobs.c.created_at)
Index("role_assignments_resource_idx", role_assignments.c.resource_type, role_assignments.c.resource_id)
Index("audit_events_resource_idx", audit_events.c.resource_type, audit_events.c.resource_id, audit_events.c.created_at.desc())
