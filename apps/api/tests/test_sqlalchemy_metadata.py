import unittest

from sqlalchemy import ForeignKeyConstraint, Index, UniqueConstraint

from skillhub.infrastructure.db.tables import metadata


class SqlAlchemyMetadataTest(unittest.TestCase):
    def test_metadata_declares_all_schema_tables(self):
        self.assertEqual(
            set(metadata.tables),
            {
                "artifacts",
                "tag_sets",
                "skills",
                "variants",
                "variant_versions",
                "eval_sets",
                "eval_set_versions",
                "eval_cases",
                "eval_case_versions",
                "eval_set_case_versions",
                "eval_runs",
                "case_results",
                "jobs",
                "role_assignments",
                "audit_events",
            },
        )

    def test_metadata_can_create_sqlite_test_schema(self):
        from sqlalchemy import create_engine

        engine = create_engine("sqlite:///:memory:")
        metadata.create_all(engine)
        with engine.connect() as connection:
            self.assertTrue(engine.dialect.has_table(connection, "skills"))

    def test_eval_run_same_skill_composite_foreign_keys_are_mapped(self):
        self.assert_foreign_key(
            "eval_runs",
            "eval_runs_variant_version_skill_fkey",
            ("variant_version_id", "skill_id"),
            "variant_versions",
            ("id", "skill_id"),
        )
        self.assert_foreign_key(
            "eval_runs",
            "eval_runs_eval_set_version_skill_fkey",
            ("eval_set_version_id", "skill_id"),
            "eval_set_versions",
            ("id", "skill_id"),
        )

    def test_case_results_are_scoped_by_run_and_case_skill(self):
        self.assert_foreign_key(
            "case_results",
            "case_results_run_skill_fkey",
            ("run_id", "skill_id"),
            "eval_runs",
            ("id", "skill_id"),
        )
        self.assert_foreign_key(
            "case_results",
            "case_results_case_skill_fkey",
            ("case_version_id", "skill_id"),
            "eval_case_versions",
            ("id", "skill_id"),
        )

    def test_version_uniqueness_constraints_are_mapped(self):
        self.assert_unique_constraint("variant_versions", "variant_versions_variant_version_unique", ("variant_id", "version_number"))
        self.assert_unique_constraint("eval_case_versions", "eval_case_versions_case_version_unique", ("case_id", "version_number"))
        self.assert_unique_constraint("eval_set_versions", "eval_set_versions_eval_set_version_unique", ("eval_set_id", "version_number"))

    def test_query_indexes_are_mapped(self):
        for table_name, index_name in [
            ("variants", "variants_skill_id_idx"),
            ("variant_versions", "variant_versions_variant_id_idx"),
            ("eval_case_versions", "eval_case_versions_case_id_idx"),
            ("eval_set_versions", "eval_set_versions_eval_set_id_idx"),
            ("eval_runs", "eval_runs_variant_version_id_idx"),
            ("eval_runs", "eval_runs_eval_set_version_id_idx"),
            ("case_results", "case_results_case_version_id_idx"),
            ("jobs", "jobs_status_created_at_idx"),
        ]:
            self.assertIn(index_name, self.index_names(table_name))

    def assert_foreign_key(
        self,
        table_name: str,
        constraint_name: str,
        local_columns: tuple[str, ...],
        referred_table: str,
        referred_columns: tuple[str, ...],
    ) -> None:
        table = metadata.tables[table_name]
        constraints = [item for item in table.constraints if isinstance(item, ForeignKeyConstraint)]
        match = next((item for item in constraints if item.name == constraint_name), None)
        self.assertIsNotNone(match, constraint_name)
        assert match is not None
        self.assertEqual(tuple(column.name for column in match.columns), local_columns)
        self.assertEqual(match.referred_table.name, referred_table)
        self.assertEqual(tuple(element.column.name for element in match.elements), referred_columns)

    def assert_unique_constraint(self, table_name: str, constraint_name: str, columns: tuple[str, ...]) -> None:
        table = metadata.tables[table_name]
        constraints = [item for item in table.constraints if isinstance(item, UniqueConstraint)]
        match = next((item for item in constraints if item.name == constraint_name), None)
        self.assertIsNotNone(match, constraint_name)
        assert match is not None
        self.assertEqual(tuple(column.name for column in match.columns), columns)

    def index_names(self, table_name: str) -> set[str]:
        return {item.name for item in metadata.tables[table_name].indexes if isinstance(item, Index)}


if __name__ == "__main__":
    unittest.main()
