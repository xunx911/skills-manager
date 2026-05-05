import copy
import sqlite3
import unittest

from skillhub_demo.models import CaseResult, EvalRun
from skillhub_demo.seed import create_seed_data
from skillhub_demo.sqlite_store import (
    connect,
    current_schema_version,
    eval_result_detail,
    eval_result_counts,
    eval_set_case_details,
    import_app_data,
    set_schema_version_for_test,
    skill_detail,
    skills_overview,
    table_counts,
    variant_page,
)
from skillhub_demo.store import SkillHubStore


class SqliteStoreTest(unittest.TestCase):
    def test_initialize_records_schema_version(self):
        connection = connect()
        self.assertEqual(current_schema_version(connection), 2)

    def test_newer_schema_version_is_rejected(self):
        connection = connect()
        set_schema_version_for_test(connection, 99)
        with self.assertRaisesRegex(RuntimeError, "newer than supported"):
            current_schema_version(connection)

    def test_import_seed_data_preserves_counts_and_eval_results(self):
        data = create_seed_data()
        connection = connect()
        import_app_data(connection, data)

        counts = table_counts(connection)
        self.assertEqual(counts["skills"], len(data.skills))
        self.assertEqual(counts["variants"], len(data.variants))
        self.assertEqual(counts["variant_versions"], len(data.variant_versions))
        self.assertEqual(counts["eval_set_cases"], len(data.eval_set_versions[0].case_refs))
        self.assertEqual(counts["case_results"], len(data.case_results))

        self.assertEqual(
            eval_result_counts(connection, "version-a-v1", "evalset-v1"),
            {"passed": 2, "failed": 1, "missing": 0, "total": 3},
        )

    def test_eval_set_case_details_include_input_and_expected_output(self):
        connection = connect()
        import_app_data(connection, create_seed_data())

        cases = list(eval_set_case_details(connection, "evalset-v1"))
        self.assertEqual(cases[0]["id"], "case-null")
        self.assertEqual(cases[0]["source_type"], "manual")
        self.assertIn("nickname.toUpperCase", cases[0]["input"])
        self.assertIn("toUpperCase", cases[0]["expected_output"])

    def test_skill_and_variant_read_models_match_domain_store_shape(self):
        data = create_seed_data()
        connection = connect()
        import_app_data(connection, data)
        domain_store = SkillHubStore(data)

        self.assertEqual(skills_overview(connection), domain_store.skills())
        self.assertEqual(skill_detail(connection, "skill-code-reviewer"), domain_store.skill_detail("skill-code-reviewer"))
        self.assertEqual(
            variant_page(connection, "variant-a", "version-a-v1", "evalset-v1"),
            domain_store.variant_page("variant-a", "version-a-v1", "evalset-v1"),
        )

    def test_eval_result_detail_uses_latest_finished_run(self):
        data = create_seed_data()
        data.eval_runs.append(
            EvalRun(
                id="run-a-v1-later",
                variant_version_ref="version-a-v1",
                eval_set_version_ref="evalset-v1",
                strategy_ref="manual-eval-v1",
                run_config_hash="manual-v1",
                status="finished",
                started_at="2026-05-01T00:00:00.000Z",
                finished_at="2026-05-01T00:00:00.000Z",
            )
        )
        data.case_results.extend(
            [
                CaseResult(run_ref="run-a-v1-later", case_ref="case-null", passed=False, score=0),
                CaseResult(run_ref="run-a-v1-later", case_ref="case-auth", passed=False, score=0),
                CaseResult(run_ref="run-a-v1-later", case_ref="case-noise", passed=False, score=0),
            ]
        )
        connection = connect()
        import_app_data(connection, data)

        detail = eval_result_detail(connection, "version-a-v1", "evalset-v1")

        self.assertEqual(detail["variant"]["id"], "variant-a")
        self.assertEqual(detail["variant_version"]["content_ref"]["kind"], "inline_bundle")
        self.assertEqual(detail["result_counts"], {"passed": 0, "failed": 3, "missing": 0, "total": 3})
        self.assertEqual(detail["score"], 0)
        self.assertFalse(detail["cases"][0]["result"]["passed"])

    def test_foreign_keys_reject_broken_variant_version_reference(self):
        data = copy.deepcopy(create_seed_data())
        data.variant_versions[0].variant_ref = "missing-variant"

        connection = connect()
        with self.assertRaises(sqlite3.IntegrityError):
            import_app_data(connection, data)


if __name__ == "__main__":
    unittest.main()
