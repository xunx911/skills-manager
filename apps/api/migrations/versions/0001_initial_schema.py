"""Initial SkillHub schema.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-05
"""

from pathlib import Path

from alembic import op


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    schema_path = Path(__file__).parents[2] / "skillhub" / "infrastructure" / "db" / "schema.sql"
    op.execute(schema_path.read_text(encoding="utf-8"))


def downgrade() -> None:
    op.execute(
        """
        drop table if exists audit_events cascade;
        drop table if exists role_assignments cascade;
        drop table if exists jobs cascade;
        drop table if exists accepted_verifications cascade;
        drop table if exists promotion_decisions cascade;
        drop table if exists case_results cascade;
        drop table if exists eval_runs cascade;
        drop table if exists eval_set_case_versions cascade;
        drop table if exists eval_set_versions cascade;
        drop table if exists eval_case_versions cascade;
        drop table if exists eval_cases cascade;
        drop table if exists eval_sets cascade;
        drop table if exists variant_versions cascade;
        drop table if exists variants cascade;
        drop table if exists skills cascade;
        drop table if exists tag_sets cascade;
        drop table if exists artifacts cascade;
        """
    )
