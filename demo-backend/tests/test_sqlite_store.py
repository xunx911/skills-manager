import copy
import sqlite3
import unittest

from skillhub_demo.seed import create_seed_data
from skillhub_demo.sqlite_store import (
    connect,
    eval_result_counts,
    eval_set_case_details,
    import_app_data,
    table_counts,
)


class SqliteStoreTest(unittest.TestCase):
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
        self.assertIn("nickname.toUpperCase", cases[0]["input"])
        self.assertIn("toUpperCase", cases[0]["expected_output"])

    def test_foreign_keys_reject_broken_variant_version_reference(self):
        data = copy.deepcopy(create_seed_data())
        data.variant_versions[0].variant_ref = "missing-variant"

        connection = connect()
        with self.assertRaises(sqlite3.IntegrityError):
            import_app_data(connection, data)


if __name__ == "__main__":
    unittest.main()
