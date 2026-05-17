import unittest
import json

from sqlalchemy import create_engine, event, select

from skillhub.domain.errors import FieldInvariantError, InvariantError, NotFoundError
from skillhub.domain.models import ContentRef, digest_text
from skillhub.infrastructure.db.repositories import SqlSkillRepository
from skillhub.infrastructure.db.tables import (
    accepted_verifications,
    artifacts,
    audit_events,
    case_results,
    eval_case_versions,
    eval_cases,
    eval_runs,
    eval_set_case_versions,
    eval_set_versions,
    eval_sets,
    metadata,
    promotion_decisions,
    skills,
    tag_sets,
    variant_versions,
    variants,
)


class SqlSkillRepositoryTest(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        event.listen(self.engine, "connect", self.enable_sqlite_foreign_keys)
        metadata.create_all(self.engine)
        self.repository = SqlSkillRepository(self.engine)

    def enable_sqlite_foreign_keys(self, dbapi_connection, _connection_record) -> None:
        dbapi_connection.execute("pragma foreign_keys=on")

    def test_create_skill_writes_default_variant_current_version_and_primary_eval_set(self):
        result = self.repository.create_skill(
            slug="code-reviewer",
            owner_ref="skillhub-lab",
            variant_name="Variant A",
            variant_label="Baseline",
            variant_summary="Baseline maintained answer.",
            tags=["gpt5.4", "codex"],
            content_ref=ContentRef(kind="skill_bundle", locator="memory:bundle", digest="digest-bundle"),
            change_summary="Initial version.",
            actor="tester",
        )

        with self.engine.connect() as connection:
            skill = connection.execute(select(skills).where(skills.c.id == result.skill_id)).mappings().one()
            variant = connection.execute(select(variants).where(variants.c.id == result.variant_id)).mappings().one()
            version = connection.execute(select(variant_versions).where(variant_versions.c.id == result.variant_version_id)).mappings().one()
            eval_set = connection.execute(select(eval_sets).where(eval_sets.c.id == result.eval_set_id)).mappings().one()
            eval_set_version = connection.execute(select(eval_set_versions).where(eval_set_versions.c.id == result.eval_set_version_id)).mappings().one()

        self.assertEqual(skill["default_variant_id"], result.variant_id)
        self.assertEqual(variant["skill_id"], result.skill_id)
        self.assertEqual(variant["current_version_id"], result.variant_version_id)
        self.assertEqual(version["version_number"], 1)
        self.assertEqual(version["content_ref"]["kind"], "skill_bundle")
        self.assertEqual(eval_set["current_version_id"], result.eval_set_version_id)
        self.assertEqual(eval_set_version["version_number"], 1)

    def test_create_skill_reuses_normalized_tag_set(self):
        first = self.repository.create_skill(
            slug="code-reviewer",
            owner_ref="skillhub-lab",
            variant_name="Variant A",
            variant_label="Baseline",
            variant_summary="Baseline maintained answer.",
            tags=["codex", "gpt5.4"],
            content_ref=ContentRef(kind="skill_bundle", locator="memory:code", digest="digest-code"),
            change_summary="Initial code version.",
            actor="tester",
        )
        second = self.repository.create_skill(
            slug="security-reviewer",
            owner_ref="skillhub-lab",
            variant_name="Variant A",
            variant_label="Security",
            variant_summary="Security maintained answer.",
            tags=["gpt5.4", "codex", "codex"],
            content_ref=ContentRef(kind="skill_bundle", locator="memory:security", digest="digest-security"),
            change_summary="Initial security version.",
            actor="tester",
        )

        with self.engine.connect() as connection:
            tag_set_count = connection.execute(select(tag_sets.c.id)).all()

        self.assertEqual(first.tag_set_id, second.tag_set_id)
        self.assertEqual(len(tag_set_count), 1)

    def test_candidate_variant_version_does_not_move_current_pointer(self):
        skill = self.create_skill()

        candidate = self.repository.create_variant_version(
            variant_id=skill.variant_id,
            content_ref=ContentRef(kind="skill_bundle", locator="memory:candidate", digest="digest-candidate"),
            change_summary="Candidate version.",
            actor="tester",
            make_current=False,
        )

        with self.engine.connect() as connection:
            variant = connection.execute(select(variants).where(variants.c.id == skill.variant_id)).mappings().one()
            version = connection.execute(select(variant_versions).where(variant_versions.c.id == candidate.variant_version_id)).mappings().one()

        self.assertEqual(candidate.version_number, 2)
        self.assertEqual(variant["current_version_id"], skill.variant_version_id)
        self.assertEqual(version["change_summary"], "Candidate version.")

    def test_make_current_variant_version_moves_current_pointer(self):
        skill = self.create_skill()

        created = self.repository.create_variant_version(
            variant_id=skill.variant_id,
            content_ref=ContentRef(kind="skill_bundle", locator="memory:v2", digest="digest-v2"),
            change_summary="Make current.",
            actor="tester",
            make_current=True,
        )

        with self.engine.connect() as connection:
            variant = connection.execute(select(variants).where(variants.c.id == skill.variant_id)).mappings().one()

        self.assertEqual(variant["current_version_id"], created.variant_version_id)

    def test_promote_variant_version_moves_current_pointer_to_existing_version(self):
        skill = self.create_skill_with_bundle(slug="promote-existing", guidance="Flag auth regressions first.")
        candidate = self.repository.create_variant_version(
            variant_id=skill.variant_id,
            content_ref=self.bundle_content_ref("promote-existing-v2", "Flag auth regressions and tenant leaks first."),
            change_summary="Candidate version.",
            actor="tester",
            make_current=False,
        )
        case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: missing tenant filter",
            input_text="Project.all()",
            expected_output="Flag missing tenant scope.",
            actor="tester",
        )
        self.repository.record_eval_run(
            variant_version_id=skill.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={case.eval_case_version_id: False},
            actor="tester",
        )
        candidate_run = self.repository.record_eval_run(
            variant_version_id=candidate.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={case.eval_case_version_id: True},
            actor="tester",
        )

        self.repository.promote_variant_version(
            variant_id=skill.variant_id,
            version_id=candidate.variant_version_id,
            evidence_eval_run_id=candidate_run.eval_run_id,
            eval_set_version_id=case.eval_set_version_id,
            decision_note="Candidate fixes tenant leak detection.",
            accept_risk=False,
            actor="tester",
        )

        with self.engine.connect() as connection:
            variant = connection.execute(select(variants).where(variants.c.id == skill.variant_id)).mappings().one()

        self.assertEqual(variant["current_version_id"], candidate.variant_version_id)

    def test_promote_rejects_version_from_another_variant(self):
        first = self.create_skill(slug="code-reviewer", digest="digest-code")
        second = self.create_skill(slug="security-reviewer", digest="digest-security")

        with self.assertRaisesRegex(InvariantError, "own version"):
            self.repository.promote_variant_version(
                variant_id=first.variant_id,
                version_id=second.variant_version_id,
            )

    def test_promotion_review_ready_compares_case_results_and_bundle_diff(self):
        skill = self.create_skill_with_bundle(slug="promotion-ready", guidance="Flag auth regressions first.")
        candidate = self.repository.create_variant_version(
            variant_id=skill.variant_id,
            content_ref=self.bundle_content_ref("promotion-ready-v2", "Flag auth regressions and tenant leaks first."),
            change_summary="Add tenant guidance.",
            actor="tester",
            make_current=False,
        )
        first_case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: missing tenant filter",
            input_text="Project.all()",
            expected_output="Flag missing tenant scope.",
            actor="tester",
        )
        second_case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: token logging",
            input_text="console.log(token)",
            expected_output="Flag token logging.",
            actor="tester",
        )
        current_run = self.repository.record_eval_run(
            variant_version_id=skill.variant_version_id,
            eval_set_version_id=second_case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={first_case.eval_case_version_id: False, second_case.eval_case_version_id: True},
            actor="tester",
        )
        candidate_run = self.repository.record_eval_run(
            variant_version_id=candidate.variant_version_id,
            eval_set_version_id=second_case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={first_case.eval_case_version_id: True, second_case.eval_case_version_id: True},
            actor="tester",
        )

        review = self.repository.promotion_review(
            variant_id=skill.variant_id,
            candidate_version_id=candidate.variant_version_id,
            eval_set_version_id=second_case.eval_set_version_id,
        )

        self.assertEqual(review["readiness"]["status"], "ready")
        self.assertEqual(review["readiness"]["label"], "可设为当前版本")
        self.assertFalse(review["readiness"]["requires_note"])
        self.assertEqual(review["candidate_run"]["id"], candidate_run.eval_run_id)
        self.assertEqual(review["current_run"]["id"], current_run.eval_run_id)
        self.assertEqual(
            review["comparison_summary"],
            {
                "fixed": 1,
                "regressed": 0,
                "stable_pass": 1,
                "stable_fail": 0,
                "missing_baseline": 0,
                "missing_candidate": 0,
            },
        )
        self.assertEqual([case["change"] for case in review["case_comparisons"]], ["fixed", "stable_pass"])
        self.assertEqual(review["case_comparisons"][0]["change_label"], "修复")
        self.assertEqual(review["case_comparisons"][0]["input_text"], "Project.all()")
        self.assertEqual(review["bundle_diff"]["summary"]["changed"], 1)

    def test_promotion_review_marks_regression_as_risky(self):
        skill = self.create_skill_with_bundle(slug="promotion-risky", guidance="Flag auth regressions first.")
        candidate = self.repository.create_variant_version(
            variant_id=skill.variant_id,
            content_ref=self.bundle_content_ref("promotion-risky-v2", "Flag auth regressions with stricter wording."),
            change_summary="Change wording.",
            actor="tester",
            make_current=False,
        )
        case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: harmless rename",
            input_text="rename local variable only",
            expected_output="Do not report a finding.",
            actor="tester",
        )
        self.repository.record_eval_run(
            variant_version_id=skill.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={case.eval_case_version_id: True},
            actor="tester",
        )
        self.repository.record_eval_run(
            variant_version_id=candidate.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={case.eval_case_version_id: False},
            actor="tester",
        )

        review = self.repository.promotion_review(
            variant_id=skill.variant_id,
            candidate_version_id=candidate.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
        )

        self.assertEqual(review["readiness"]["status"], "risky")
        self.assertEqual(review["readiness"]["reason"], "发现 1 个回退")
        self.assertTrue(review["readiness"]["requires_note"])
        self.assertEqual(review["comparison_summary"]["regressed"], 1)
        self.assertEqual(review["case_comparisons"][0]["change"], "regressed")
        self.assertEqual(review["case_comparisons"][0]["change_label"], "回退")

    def test_promotion_review_without_candidate_run_is_unverified(self):
        skill = self.create_skill_with_bundle(slug="promotion-unverified", guidance="Flag auth regressions first.")
        candidate = self.repository.create_variant_version(
            variant_id=skill.variant_id,
            content_ref=self.bundle_content_ref("promotion-unverified-v2", "Flag auth regressions and data leaks."),
            change_summary="Add data leak guidance.",
            actor="tester",
            make_current=False,
        )
        case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: token leak",
            input_text="console.log(token)",
            expected_output="Flag token logging.",
            actor="tester",
        )

        review = self.repository.promotion_review(
            variant_id=skill.variant_id,
            candidate_version_id=candidate.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
        )

        self.assertEqual(review["readiness"]["status"], "unverified")
        self.assertEqual(review["readiness"]["label"], "未验证")
        self.assertIsNone(review["candidate_run"])
        self.assertEqual(review["comparison_summary"]["missing_candidate"], 1)

    def test_promote_rejects_evidence_run_from_another_candidate_version(self):
        skill = self.create_skill_with_bundle(slug="promotion-evidence", guidance="Flag auth regressions first.")
        first_candidate = self.repository.create_variant_version(
            variant_id=skill.variant_id,
            content_ref=self.bundle_content_ref("promotion-evidence-v2", "First candidate."),
            change_summary="First candidate.",
            actor="tester",
            make_current=False,
        )
        second_candidate = self.repository.create_variant_version(
            variant_id=skill.variant_id,
            content_ref=self.bundle_content_ref("promotion-evidence-v3", "Second candidate."),
            change_summary="Second candidate.",
            actor="tester",
            make_current=False,
        )
        case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: owner scope",
            input_text="Project.find_many()",
            expected_output="Flag missing owner scope.",
            actor="tester",
        )
        wrong_run = self.repository.record_eval_run(
            variant_version_id=first_candidate.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={case.eval_case_version_id: True},
            actor="tester",
        )

        with self.assertRaisesRegex(InvariantError, "evidence eval run"):
            self.repository.promote_variant_version(
                variant_id=skill.variant_id,
                version_id=second_candidate.variant_version_id,
                evidence_eval_run_id=wrong_run.eval_run_id,
                eval_set_version_id=case.eval_set_version_id,
                decision_note="",
                accept_risk=False,
                actor="tester",
            )

    def test_promote_risky_candidate_requires_decision_note(self):
        skill = self.create_skill_with_bundle(slug="promotion-note", guidance="Flag auth regressions first.")
        candidate = self.repository.create_variant_version(
            variant_id=skill.variant_id,
            content_ref=self.bundle_content_ref("promotion-note-v2", "Flag auth regressions with stricter wording."),
            change_summary="Change wording.",
            actor="tester",
            make_current=False,
        )
        case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: harmless rename",
            input_text="rename local variable only",
            expected_output="Do not report a finding.",
            actor="tester",
        )
        self.repository.record_eval_run(
            variant_version_id=skill.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={case.eval_case_version_id: True},
            actor="tester",
        )
        candidate_run = self.repository.record_eval_run(
            variant_version_id=candidate.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={case.eval_case_version_id: False},
            actor="tester",
        )

        with self.assertRaisesRegex(InvariantError, "decision note"):
            self.repository.promote_variant_version(
                variant_id=skill.variant_id,
                version_id=candidate.variant_version_id,
                evidence_eval_run_id=candidate_run.eval_run_id,
                eval_set_version_id=case.eval_set_version_id,
                decision_note="",
                accept_risk=True,
                actor="tester",
            )

    def test_promote_with_evidence_records_decision_and_audit_event(self):
        skill = self.create_skill_with_bundle(slug="promotion-success", guidance="Flag auth regressions first.")
        candidate = self.repository.create_variant_version(
            variant_id=skill.variant_id,
            content_ref=self.bundle_content_ref("promotion-success-v2", "Flag auth regressions and tenant leaks first."),
            change_summary="Add tenant guidance.",
            actor="tester",
            make_current=False,
        )
        case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: missing tenant filter",
            input_text="Project.all()",
            expected_output="Flag missing tenant scope.",
            actor="tester",
        )
        self.repository.record_eval_run(
            variant_version_id=skill.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={case.eval_case_version_id: False},
            actor="tester",
        )
        candidate_run = self.repository.record_eval_run(
            variant_version_id=candidate.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={case.eval_case_version_id: True},
            actor="tester",
        )

        decision = self.repository.promote_variant_version(
            variant_id=skill.variant_id,
            version_id=candidate.variant_version_id,
            evidence_eval_run_id=candidate_run.eval_run_id,
            eval_set_version_id=case.eval_set_version_id,
            decision_note="Candidate fixes the tenant leak case.",
            accept_risk=False,
            actor="tester",
        )

        with self.engine.connect() as connection:
            variant = connection.execute(select(variants).where(variants.c.id == skill.variant_id)).mappings().one()
            decision_row = connection.execute(select(promotion_decisions)).mappings().one()
            audit_row = (
                connection.execute(select(audit_events).where(audit_events.c.action == "variant.promoted"))
                .mappings()
                .one()
            )

        self.assertEqual(variant["current_version_id"], candidate.variant_version_id)
        self.assertEqual(decision["id"], decision_row["id"])
        self.assertEqual(decision_row["from_version_id"], skill.variant_version_id)
        self.assertEqual(decision_row["to_version_id"], candidate.variant_version_id)
        self.assertEqual(decision_row["evidence_eval_run_id"], candidate_run.eval_run_id)
        self.assertEqual(decision_row["readiness_status"], "ready")
        self.assertEqual(decision_row["summary"]["fixed"], 1)
        self.assertEqual(audit_row["action"], "variant.promoted")
        self.assertEqual(audit_row["payload"]["promotion_decision_id"], decision_row["id"])

    def test_create_variant_version_requires_existing_variant(self):
        with self.assertRaisesRegex(NotFoundError, "Variant not found"):
            self.repository.create_variant_version(
                variant_id="missing",
                content_ref=ContentRef(kind="skill_bundle", locator="memory:v2", digest="digest-v2"),
                change_summary="Missing variant.",
                actor="tester",
                make_current=False,
            )

    def test_create_eval_case_creates_case_version_and_new_eval_set_snapshot(self):
        skill = self.create_skill()

        created = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: missing owner check",
            input_text="diff --git a/api.ts b/api.ts",
            expected_output="Should flag missing ownerId filter.",
            actor="tester",
        )

        with self.engine.connect() as connection:
            eval_case = connection.execute(select(eval_cases).where(eval_cases.c.id == created.eval_case_id)).mappings().one()
            case_version = connection.execute(select(eval_case_versions).where(eval_case_versions.c.id == created.eval_case_version_id)).mappings().one()
            eval_set = connection.execute(select(eval_sets).where(eval_sets.c.id == skill.eval_set_id)).mappings().one()
            membership = connection.execute(
                select(eval_set_case_versions)
                .where(eval_set_case_versions.c.eval_set_version_id == created.eval_set_version_id)
                .order_by(eval_set_case_versions.c.position)
            ).mappings().all()
            artifact_count = connection.execute(select(artifacts.c.id)).all()

        self.assertEqual(eval_case["current_version_id"], created.eval_case_version_id)
        self.assertEqual(case_version["case_id"], created.eval_case_id)
        self.assertEqual(case_version["version_number"], 1)
        self.assertEqual(eval_set["current_version_id"], created.eval_set_version_id)
        self.assertEqual([item["case_version_id"] for item in membership], [created.eval_case_version_id])
        self.assertEqual(len(artifact_count), 2)

    def test_create_eval_cases_batch_creates_one_eval_set_snapshot(self):
        skill = self.create_skill()

        created = self.repository.create_eval_cases_batch(
            skill_id=skill.skill_id,
            cases=[
                {
                    "title": "PR: missing tenant scope",
                    "input_text": "Project.all()",
                    "expected_output": "Flag missing tenant scope.",
                    "notes": "Imported from review backlog.",
                },
                {
                    "title": "PR: token logging",
                    "input_text": "console.log(token)",
                    "expected_output": "Flag token logging.",
                    "notes": "Imported from review backlog.",
                },
            ],
            actor="tester",
        )

        with self.engine.connect() as connection:
            eval_set = connection.execute(select(eval_sets).where(eval_sets.c.id == skill.eval_set_id)).mappings().one()
            eval_set_versions_rows = connection.execute(
                select(eval_set_versions).where(eval_set_versions.c.eval_set_id == skill.eval_set_id)
            ).mappings().all()
            membership = connection.execute(
                select(eval_set_case_versions)
                .where(eval_set_case_versions.c.eval_set_version_id == created.eval_set_version_id)
                .order_by(eval_set_case_versions.c.position)
            ).mappings().all()
            artifact_count = connection.execute(select(artifacts.c.id)).all()

        self.assertEqual(eval_set["current_version_id"], created.eval_set_version_id)
        self.assertEqual(len(eval_set_versions_rows), 2)
        self.assertEqual(len(created.created), 2)
        self.assertEqual(
            [item["case_version_id"] for item in membership],
            [item.eval_case_version_id for item in created.created],
        )
        self.assertEqual(len(artifact_count), 4)

    def test_eval_case_version_replaces_current_case_in_new_eval_set_without_mutating_old_snapshot(self):
        skill = self.create_skill()
        first = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: null nickname",
            input_text="old input",
            expected_output="old expectation",
            actor="tester",
        )
        second = self.repository.create_eval_case_version(
            case_id=first.eval_case_id,
            input_text="new input",
            expected_output="new expectation",
            actor="tester",
        )

        with self.engine.connect() as connection:
            old_membership = connection.execute(
                select(eval_set_case_versions.c.case_version_id).where(
                    eval_set_case_versions.c.eval_set_version_id == first.eval_set_version_id
                )
            ).scalars().all()
            new_membership = connection.execute(
                select(eval_set_case_versions.c.case_version_id).where(
                    eval_set_case_versions.c.eval_set_version_id == second.eval_set_version_id
                )
            ).scalars().all()
            eval_case = connection.execute(select(eval_cases).where(eval_cases.c.id == first.eval_case_id)).mappings().one()
            latest_eval_set_version = connection.execute(
                select(eval_set_versions).where(eval_set_versions.c.id == second.eval_set_version_id)
            ).mappings().one()

        self.assertEqual(old_membership, [first.eval_case_version_id])
        self.assertEqual(new_membership, [second.eval_case_version_id])
        self.assertEqual(eval_case["current_version_id"], second.eval_case_version_id)
        self.assertEqual(latest_eval_set_version["version_number"], 3)

    def test_eval_case_version_can_be_created_without_moving_case_or_eval_set_current_pointer(self):
        skill = self.create_skill()
        first = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: token leak",
            input_text="old input",
            expected_output="old expectation",
            actor="tester",
        )
        candidate = self.repository.create_eval_case_version(
            case_id=first.eval_case_id,
            input_text="candidate input",
            expected_output="candidate expectation",
            actor="tester",
            make_current=False,
        )

        with self.engine.connect() as connection:
            eval_case = connection.execute(select(eval_cases).where(eval_cases.c.id == first.eval_case_id)).mappings().one()
            eval_set = connection.execute(select(eval_sets).where(eval_sets.c.id == skill.eval_set_id)).mappings().one()

        self.assertEqual(eval_case["current_version_id"], first.eval_case_version_id)
        self.assertEqual(eval_set["current_version_id"], first.eval_set_version_id)
        self.assertEqual(candidate.eval_set_version_id, first.eval_set_version_id)

    def test_restore_eval_case_version_creates_new_current_version(self):
        skill = self.create_skill()
        first = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: old expected output",
            input_text="old input",
            expected_output="old expectation",
            actor="tester",
            notes="original",
        )
        second = self.repository.create_eval_case_version(
            case_id=first.eval_case_id,
            input_text="new input",
            expected_output="new expectation",
            actor="tester",
            notes="bad edit",
        )

        restored = self.repository.restore_eval_case_version(
            case_id=first.eval_case_id,
            source_case_version_id=first.eval_case_version_id,
            actor="tester",
            notes="Restored original expectation.",
        )

        with self.engine.connect() as connection:
            eval_case = connection.execute(select(eval_cases).where(eval_cases.c.id == first.eval_case_id)).mappings().one()
            restored_version = connection.execute(
                select(eval_case_versions).where(eval_case_versions.c.id == restored.eval_case_version_id)
            ).mappings().one()
            restored_detail = self.repository._case_version_detail(connection, restored_version)
            old_membership = connection.execute(
                select(eval_set_case_versions.c.case_version_id).where(
                    eval_set_case_versions.c.eval_set_version_id == first.eval_set_version_id
                )
            ).scalars().all()
            latest_membership = connection.execute(
                select(eval_set_case_versions.c.case_version_id).where(
                    eval_set_case_versions.c.eval_set_version_id == restored.eval_set_version_id
                )
            ).scalars().all()

        self.assertNotEqual(restored.eval_case_version_id, first.eval_case_version_id)
        self.assertNotEqual(restored.eval_case_version_id, second.eval_case_version_id)
        self.assertEqual(restored_version["version_number"], 3)
        self.assertEqual(eval_case["current_version_id"], restored.eval_case_version_id)
        self.assertEqual(restored_detail["input_artifact"]["content_text"], "old input")
        self.assertEqual(restored_detail["expected_output_artifact"]["content_text"], "old expectation")
        self.assertEqual(restored_detail["notes"], "Restored original expectation.")
        self.assertEqual(old_membership, [first.eval_case_version_id])
        self.assertEqual(latest_membership, [restored.eval_case_version_id])

    def test_create_eval_case_requires_existing_skill_eval_set(self):
        with self.assertRaisesRegex(NotFoundError, "Primary EvalSet not found"):
            self.repository.create_eval_case(
                skill_id="missing",
                title="Missing skill",
                input_text="input",
                expected_output="expected",
                actor="tester",
            )

    def test_record_eval_run_writes_pass_fail_results_for_exact_versions(self):
        skill = self.create_skill()
        first_case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: missing owner check",
            input_text="input 1",
            expected_output="expected 1",
            actor="tester",
        )
        second_case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: token leak",
            input_text="input 2",
            expected_output="expected 2",
            actor="tester",
        )

        run = self.repository.record_eval_run(
            variant_version_id=skill.variant_version_id,
            eval_set_version_id=second_case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={first_case.eval_case_version_id: True, second_case.eval_case_version_id: False},
            actor="tester",
        )

        with self.engine.connect() as connection:
            eval_run = connection.execute(select(eval_runs).where(eval_runs.c.id == run.eval_run_id)).mappings().one()
            results = connection.execute(
                select(case_results).where(case_results.c.run_id == run.eval_run_id).order_by(case_results.c.case_version_id)
            ).mappings().all()

        self.assertEqual(run.passed, 1)
        self.assertEqual(run.failed, 1)
        self.assertEqual(run.total, 2)
        self.assertEqual(eval_run["variant_version_id"], skill.variant_version_id)
        self.assertEqual(eval_run["eval_set_version_id"], second_case.eval_set_version_id)
        self.assertEqual(eval_run["summary"], {"passed": 1, "failed": 1, "total": 2})
        self.assertEqual({item["case_version_id"]: item["passed"] for item in results}, {
            first_case.eval_case_version_id: True,
            second_case.eval_case_version_id: False,
        })

    def test_record_eval_run_requires_exact_result_keys(self):
        skill = self.create_skill()
        first_case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: missing owner check",
            input_text="input 1",
            expected_output="expected 1",
            actor="tester",
        )
        second_case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: token leak",
            input_text="input 2",
            expected_output="expected 2",
            actor="tester",
        )

        with self.assertRaises(FieldInvariantError) as missing:
            self.repository.record_eval_run(
                variant_version_id=skill.variant_version_id,
                eval_set_version_id=second_case.eval_set_version_id,
                strategy="manual_pass_fail",
                results={first_case.eval_case_version_id: True},
                actor="tester",
            )

        self.assertEqual(missing.exception.field_errors[0].field, f"results.{second_case.eval_case_version_id}")
        self.assertEqual(missing.exception.field_errors[0].message, "确认该测试用例通过或不通过。")
        self.assertEqual(missing.exception.field_errors[0].code, "eval_run.result_required")

        with self.assertRaises(FieldInvariantError) as unexpected:
            self.repository.record_eval_run(
                variant_version_id=skill.variant_version_id,
                eval_set_version_id=second_case.eval_set_version_id,
                strategy="manual_pass_fail",
                results={
                    first_case.eval_case_version_id: True,
                    second_case.eval_case_version_id: False,
                    "casever-not-in-set": True,
                },
                actor="tester",
            )

        self.assertEqual(unexpected.exception.field_errors[0].field, "results.casever-not-in-set")
        self.assertEqual(unexpected.exception.field_errors[0].message, "测试结果不属于当前 EvalSetVersion。")
        self.assertEqual(unexpected.exception.field_errors[0].code, "eval_run.result_unexpected")

    def test_record_eval_run_rejects_cross_skill_variant_and_eval_set_versions(self):
        first = self.create_skill(slug="code-reviewer", digest="digest-code")
        second = self.create_skill(slug="security-reviewer", digest="digest-security")
        second_case = self.repository.create_eval_case(
            skill_id=second.skill_id,
            title="PR: token leak",
            input_text="input",
            expected_output="expected",
            actor="tester",
        )

        with self.assertRaisesRegex(InvariantError, "same skill"):
            self.repository.record_eval_run(
                variant_version_id=first.variant_version_id,
                eval_set_version_id=second_case.eval_set_version_id,
                strategy="manual_pass_fail",
                results={},
                actor="tester",
            )

    def test_record_eval_run_requires_existing_versions(self):
        skill = self.create_skill()

        with self.assertRaisesRegex(NotFoundError, "VariantVersion not found"):
            self.repository.record_eval_run(
                variant_version_id="missing",
                eval_set_version_id=skill.eval_set_version_id,
                strategy="manual_pass_fail",
                results={},
                actor="tester",
            )

    def test_list_skills_returns_default_variant_and_latest_verified_run(self):
        skill = self.create_skill()
        case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: missing owner check",
            input_text="input",
            expected_output="expected",
            actor="tester",
        )
        run = self.repository.record_eval_run(
            variant_version_id=skill.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={case.eval_case_version_id: True},
            actor="tester",
        )

        summaries = self.repository.list_skills()

        self.assertEqual(len(summaries), 1)
        self.assertEqual(summaries[0]["skill"]["slug"], "code-reviewer")
        self.assertEqual(summaries[0]["default_variant"]["id"], skill.variant_id)
        self.assertEqual(summaries[0]["default_variant"]["tags"], ["codex"])
        self.assertEqual(summaries[0]["primary_eval_set"]["current_version"]["id"], case.eval_set_version_id)
        self.assertEqual(summaries[0]["latest_accepted_eval_run"]["id"], run.eval_run_id)

    def test_skill_detail_returns_variants_history_eval_sets_and_latest_runs(self):
        skill = self.create_skill()
        candidate = self.repository.create_variant_version(
            variant_id=skill.variant_id,
            content_ref=ContentRef(kind="skill_bundle", locator="memory:v2", digest="digest-v2"),
            change_summary="Candidate.",
            actor="tester",
            make_current=False,
        )
        case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: token leak",
            input_text="input",
            expected_output="expected",
            actor="tester",
        )
        run = self.repository.record_eval_run(
            variant_version_id=candidate.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={case.eval_case_version_id: False},
            actor="tester",
        )

        detail = self.repository.skill_detail(skill.skill_id)

        self.assertEqual(detail["skill"]["id"], skill.skill_id)
        self.assertEqual(detail["variants"][0]["current_version"]["id"], skill.variant_version_id)
        self.assertEqual([version["version_number"] for version in detail["variants"][0]["versions"]], [2, 1])
        self.assertEqual(detail["eval_sets"][0]["current_version"]["id"], case.eval_set_version_id)
        self.assertEqual(detail["latest_eval_runs"][0]["id"], run.eval_run_id)

    def test_eval_set_version_detail_returns_exact_case_versions_and_artifact_refs(self):
        skill = self.create_skill()
        case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: missing owner check",
            input_text="input",
            expected_output="expected",
            actor="tester",
        )

        detail = self.repository.eval_set_version_detail(case.eval_set_version_id)

        self.assertEqual(detail.eval_set_version["id"], case.eval_set_version_id)
        self.assertEqual(detail.cases[0]["case"]["title"], "PR: missing owner check")
        self.assertEqual(detail.cases[0]["case_version"]["id"], case.eval_case_version_id)
        self.assertEqual(detail.cases[0]["case_version"]["input_artifact"]["id"], case.input_artifact_id)
        self.assertEqual(detail.cases[0]["case_version"]["expected_output_artifact"]["id"], case.expected_output_artifact_id)

    def test_eval_run_detail_returns_case_level_pass_fail_results(self):
        skill = self.create_skill()
        case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: missing owner check",
            input_text="input",
            expected_output="expected",
            actor="tester",
        )
        run = self.repository.record_eval_run(
            variant_version_id=skill.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={case.eval_case_version_id: True},
            actor="tester",
        )

        detail = self.repository.eval_run_detail(run.eval_run_id)

        self.assertEqual(detail.eval_run["id"], run.eval_run_id)
        self.assertEqual(detail.variant_version["id"], skill.variant_version_id)
        self.assertEqual(detail.case_results[0]["case"]["title"], "PR: missing owner check")
        self.assertTrue(detail.case_results[0]["result"]["passed"])

    def test_eval_run_matrix_returns_case_rows_and_run_columns(self):
        skill = self.create_skill()
        first_case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: missing tenant scope",
            input_text="Project.all()",
            expected_output="Flag missing tenant scope.",
            actor="tester",
        )
        second_case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: token logging",
            input_text="console.log(token)",
            expected_output="Flag token logging.",
            actor="tester",
        )
        candidate = self.repository.create_variant_version(
            variant_id=skill.variant_id,
            content_ref=ContentRef(kind="skill_bundle", locator="memory:v2", digest="digest-v2"),
            change_summary="Candidate.",
            actor="tester",
            make_current=False,
        )
        baseline_run = self.repository.record_eval_run(
            variant_version_id=skill.variant_version_id,
            eval_set_version_id=second_case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={first_case.eval_case_version_id: False, second_case.eval_case_version_id: True},
            actor="tester",
        )
        candidate_run = self.repository.record_eval_run(
            variant_version_id=candidate.variant_version_id,
            eval_set_version_id=second_case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={first_case.eval_case_version_id: True, second_case.eval_case_version_id: True},
            actor="tester",
        )

        matrix = self.repository.eval_run_matrix_for_skill(skill_id=skill.skill_id)

        self.assertEqual([row["case"]["title"] for row in matrix["cases"]], ["PR: missing tenant scope", "PR: token logging"])
        self.assertEqual({row["eval_run"]["id"] for row in matrix["runs"]}, {baseline_run.eval_run_id, candidate_run.eval_run_id})
        self.assertEqual(len(matrix["cells"]), 4)
        cells = {(cell["run_id"], cell["case_id"]): cell["passed"] for cell in matrix["cells"]}
        self.assertFalse(cells[(baseline_run.eval_run_id, first_case.eval_case_id)])
        self.assertTrue(cells[(baseline_run.eval_run_id, second_case.eval_case_id)])
        self.assertTrue(cells[(candidate_run.eval_run_id, first_case.eval_case_id)])
        self.assertTrue(cells[(candidate_run.eval_run_id, second_case.eval_case_id)])

    def test_saved_run_view_round_trip_normalizes_filters(self):
        skill = self.create_skill()

        view = self.repository.create_saved_view(
            skill_id=skill.skill_id,
            name="Candidate runs",
            view_type="run_history",
            config={
                "variant_version_id": skill.variant_version_id,
                "eval_set_version_id": "all",
                "strategy": "manual_pass_fail",
                "matrix_show_summary": "false",
                "compare_baseline_run_id": "run-baseline",
                "compare_candidate_run_id": "run-candidate",
                "status": "",
                "ignored": "value",
            },
            actor="tester",
        )
        views = self.repository.list_saved_views(skill_id=skill.skill_id, view_type="run_history")

        self.assertEqual(view["name"], "Candidate runs")
        self.assertEqual(views, [view])
        self.assertEqual(
            view["config"],
            {
                "variant_version_id": skill.variant_version_id,
                "strategy": "manual_pass_fail",
                "matrix_show_summary": "false",
                "compare_baseline_run_id": "run-baseline",
                "compare_candidate_run_id": "run-candidate",
            },
        )

        self.repository.delete_saved_view(view["id"])

        self.assertEqual(self.repository.list_saved_views(skill_id=skill.skill_id, view_type="run_history"), [])

    def test_saved_run_view_rejects_duplicate_name_for_same_skill(self):
        skill = self.create_skill()
        self.repository.create_saved_view(
            skill_id=skill.skill_id,
            name="Candidate runs",
            view_type="run_history",
            config={},
            actor="tester",
        )

        with self.assertRaises(InvariantError):
            self.repository.create_saved_view(
                skill_id=skill.skill_id,
                name="Candidate runs",
                view_type="run_history",
                config={},
                actor="tester",
            )

    def test_compare_eval_runs_returns_fixed_and_regressed_summary(self):
        skill = self.create_skill()
        first_case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: missing tenant scope",
            input_text="Project.all()",
            expected_output="Flag missing tenant scope.",
            actor="tester",
        )
        second_case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: harmless rename",
            input_text="rename local variable",
            expected_output="No finding.",
            actor="tester",
        )
        candidate = self.repository.create_variant_version(
            variant_id=skill.variant_id,
            content_ref=ContentRef(kind="skill_bundle", locator="memory:v2", digest="digest-v2"),
            change_summary="Candidate.",
            actor="tester",
            make_current=False,
        )
        baseline_run = self.repository.record_eval_run(
            variant_version_id=skill.variant_version_id,
            eval_set_version_id=second_case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={first_case.eval_case_version_id: False, second_case.eval_case_version_id: True},
            actor="tester",
        )
        candidate_run = self.repository.record_eval_run(
            variant_version_id=candidate.variant_version_id,
            eval_set_version_id=second_case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={first_case.eval_case_version_id: True, second_case.eval_case_version_id: False},
            actor="tester",
        )

        comparison = self.repository.compare_eval_runs(
            baseline_run_id=baseline_run.eval_run_id,
            candidate_run_id=candidate_run.eval_run_id,
        )

        self.assertEqual(comparison["summary"]["baseline_pass_rate"], 50)
        self.assertEqual(comparison["summary"]["candidate_pass_rate"], 50)
        self.assertEqual(comparison["summary"]["delta"], 0)
        self.assertEqual(comparison["summary"]["fixed"], 1)
        self.assertEqual(comparison["summary"]["regressed"], 1)
        self.assertEqual([case["change"] for case in comparison["case_comparisons"]], ["fixed", "regressed"])
        self.assertEqual(comparison["case_comparisons"][0]["change_label"], "修复")
        self.assertEqual(comparison["baseline"]["variant_version"]["id"], skill.variant_version_id)
        self.assertEqual(comparison["candidate"]["variant_version"]["id"], candidate.variant_version_id)

    def test_compare_eval_runs_rejects_different_eval_set_versions(self):
        skill = self.create_skill()
        first_case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: owner scope",
            input_text="Project.all()",
            expected_output="Flag owner scope.",
            actor="tester",
        )
        second_case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: token leak",
            input_text="console.log(token)",
            expected_output="Flag token logging.",
            actor="tester",
        )
        first_run = self.repository.record_eval_run(
            variant_version_id=skill.variant_version_id,
            eval_set_version_id=first_case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={first_case.eval_case_version_id: True},
            actor="tester",
        )
        second_run = self.repository.record_eval_run(
            variant_version_id=skill.variant_version_id,
            eval_set_version_id=second_case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={first_case.eval_case_version_id: True, second_case.eval_case_version_id: True},
            actor="tester",
        )

        with self.assertRaisesRegex(InvariantError, "same EvalSetVersion"):
            self.repository.compare_eval_runs(
                baseline_run_id=first_run.eval_run_id,
                candidate_run_id=second_run.eval_run_id,
            )

    def test_accept_eval_run_verification_records_pointer_and_audit(self):
        skill = self.create_skill()
        case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: owner scope",
            input_text="Project.all()",
            expected_output="Flag owner scope.",
            actor="tester",
        )
        run = self.repository.record_eval_run(
            variant_version_id=skill.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={case.eval_case_version_id: True},
            actor="tester",
        )

        accepted = self.repository.accept_eval_run_verification(
            eval_run_id=run.eval_run_id,
            note="Primary v2 verification accepted.",
            actor="tester",
        )

        with self.engine.connect() as connection:
            accepted_row = connection.execute(select(accepted_verifications)).mappings().one()
            audit_row = (
                connection.execute(
                    select(audit_events).where(audit_events.c.action == "eval_run.accepted_verification_set")
                )
                .mappings()
                .one()
            )

        self.assertEqual(accepted["eval_run_id"], run.eval_run_id)
        self.assertEqual(accepted_row["variant_id"], skill.variant_id)
        self.assertEqual(accepted_row["variant_version_id"], skill.variant_version_id)
        self.assertEqual(accepted_row["eval_set_version_id"], case.eval_set_version_id)
        self.assertEqual(accepted_row["note"], "Primary v2 verification accepted.")
        self.assertEqual(audit_row["action"], "eval_run.accepted_verification_set")
        self.assertEqual(audit_row["payload"]["eval_run_id"], run.eval_run_id)

    def test_accept_eval_run_verification_rejects_failed_run(self):
        skill = self.create_skill()
        case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: owner scope",
            input_text="Project.all()",
            expected_output="Flag owner scope.",
            actor="tester",
        )
        run = self.repository.record_eval_run(
            variant_version_id=skill.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={case.eval_case_version_id: True},
            actor="tester",
        )
        with self.engine.begin() as connection:
            connection.execute(eval_runs.update().where(eval_runs.c.id == run.eval_run_id).values(status="failed"))

        with self.assertRaisesRegex(InvariantError, "finished"):
            self.repository.accept_eval_run_verification(
                eval_run_id=run.eval_run_id,
                note="Should fail.",
                actor="tester",
            )

    def test_skill_summary_prefers_accepted_verification_over_latest_finished_run(self):
        skill = self.create_skill()
        case = self.repository.create_eval_case(
            skill_id=skill.skill_id,
            title="PR: owner scope",
            input_text="Project.all()",
            expected_output="Flag owner scope.",
            actor="tester",
        )
        accepted_run = self.repository.record_eval_run(
            variant_version_id=skill.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={case.eval_case_version_id: True},
            actor="tester",
        )
        latest_run = self.repository.record_eval_run(
            variant_version_id=skill.variant_version_id,
            eval_set_version_id=case.eval_set_version_id,
            strategy="manual_pass_fail",
            results={case.eval_case_version_id: False},
            actor="tester",
        )
        self.repository.accept_eval_run_verification(
            eval_run_id=accepted_run.eval_run_id,
            note="Accepted baseline.",
            actor="tester",
        )

        summaries = self.repository.list_skills()
        history = self.repository.list_eval_runs_for_skill(skill_id=skill.skill_id)

        self.assertNotEqual(accepted_run.eval_run_id, latest_run.eval_run_id)
        self.assertEqual(summaries[0]["latest_accepted_eval_run"]["id"], accepted_run.eval_run_id)
        accepted_rows = [row for row in history["runs"] if row["accepted_verification"] is not None]
        self.assertEqual(len(accepted_rows), 1)
        self.assertEqual(accepted_rows[0]["eval_run"]["id"], accepted_run.eval_run_id)

    def create_skill(self, *, slug: str = "code-reviewer", digest: str = "digest-bundle"):
        return self.repository.create_skill(
            slug=slug,
            owner_ref="skillhub-lab",
            variant_name="Variant A",
            variant_label="Baseline",
            variant_summary="Baseline maintained answer.",
            tags=["codex"],
            content_ref=ContentRef(kind="skill_bundle", locator=f"memory:{slug}", digest=digest),
            change_summary="Initial version.",
            actor="tester",
        )

    def create_skill_with_bundle(self, *, slug: str, guidance: str):
        return self.repository.create_skill(
            slug=slug,
            owner_ref="skillhub-lab",
            variant_name="Variant A",
            variant_label="Baseline",
            variant_summary="Baseline maintained answer.",
            tags=["codex"],
            content_ref=self.bundle_content_ref(slug, guidance),
            change_summary="Initial version.",
            actor="tester",
        )

    def bundle_content_ref(self, namespace: str, guidance: str) -> ContentRef:
        skill_md = (
            "---\n"
            f"name: {namespace}\n"
            "description: Review pull requests for auth and data access regressions.\n"
            "---\n"
            "# Security Reviewing\n"
            f"{guidance}\n"
        )
        manifest = {
            "files": [
                {
                    "path": "SKILL.md",
                    "content_text": skill_md,
                    "sha256": digest_text(skill_md),
                    "size_bytes": len(skill_md.encode("utf-8")),
                }
            ]
        }
        artifact = self.repository.create_text_artifact(
            kind="skill_bundle",
            namespace=namespace,
            content=json.dumps(manifest, sort_keys=True),
            actor="tester",
        )
        return ContentRef(kind="artifact", locator=f"artifact:{artifact['id']}", digest=artifact["digest"], path="SKILL.md")


if __name__ == "__main__":
    unittest.main()
