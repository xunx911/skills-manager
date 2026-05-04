import tempfile
import unittest
from pathlib import Path

from skillhub_demo.repository import JsonFileRepository, SqliteRepository
from skillhub_demo.seed import create_seed_data
from skillhub_demo.sqlite_store import connect, eval_result_counts, table_counts
from skillhub_demo.store import SkillHubStore


class RepositoryTest(unittest.TestCase):
    def test_json_repository_round_trips_state(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = JsonFileRepository(Path(tmpdir) / "skillhub-demo.json")
            store = SkillHubStore(repo.load(create_seed_data))
            created = store.create_skill(
                slug="api-reviewer",
                owner_ref="skillhub-lab",
                variant_name="Variant A",
                variant_label="API baseline",
                variant_summary="审查 API 兼容性和鉴权边界。",
                tags=["codex"],
            )

            repo.save(store.data)
            loaded = SkillHubStore(repo.load(create_seed_data))

            detail = loaded.skill_detail(created["skill"]["id"])
            self.assertEqual(detail["skill"]["slug"], "api-reviewer")

    def test_json_repository_mutate_loads_saves_and_returns_payload(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = JsonFileRepository(Path(tmpdir) / "skillhub-demo.json")

            result = repo.mutate(
                create_seed_data,
                lambda store: store.create_variant(
                    skill_id="skill-code-reviewer",
                    name="Variant C",
                    label="OpenCode tuned",
                    summary="OpenCode 环境下维护的当前认可解。",
                    tags=["opencode", "minimax2.7"],
                ),
            )

            loaded = SkillHubStore(repo.load(create_seed_data))
            self.assertEqual(result["variant"]["id"], loaded.data.variants[-1].id)
            self.assertEqual(loaded.tags_for_variant(result["variant"]["id"]), ["minimax2.7", "opencode"])

    def test_sqlite_repository_persists_snapshot_and_normalized_tables(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            sqlite_path = Path(tmpdir) / "skillhub-demo.sqlite3"
            repo = SqliteRepository(sqlite_path)
            store = SkillHubStore(repo.load(create_seed_data))
            created = store.create_skill(
                slug="security-reviewer",
                owner_ref="skillhub-lab",
                variant_name="Variant A",
                variant_label="Security baseline",
                variant_summary="审查鉴权和敏感信息泄露。",
                tags=["codex", "security"],
            )
            repo.save(store.data)

            loaded = SkillHubStore(repo.load(create_seed_data))
            self.assertEqual(loaded.skill_detail(created["skill"]["id"])["skill"]["slug"], "security-reviewer")

            connection = connect(str(sqlite_path))
            try:
                counts = table_counts(connection)
                self.assertEqual(counts["skills"], len(store.data.skills))
                self.assertEqual(counts["variants"], len(store.data.variants))
                self.assertEqual(
                    eval_result_counts(connection, "version-a-v1", "evalset-v1"),
                    {"passed": 2, "failed": 1, "missing": 0, "total": 3},
                )
            finally:
                connection.close()

    def test_sqlite_repository_mutate_refreshes_sql_read_models(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = SqliteRepository(Path(tmpdir) / "skillhub-demo.sqlite3")

            result = repo.mutate(
                create_seed_data,
                lambda store: store.create_eval_case(
                    skill_id="skill-code-reviewer",
                    title="PR: token 写入错误响应",
                    input_text="diff --git a/errors.ts b/errors.ts\n+ return { token }",
                    expected_output="应指出 token 泄露风险。",
                ),
            )
            detail = repo.eval_set_detail(result["eval_set_version"]["id"])

            self.assertEqual(detail["eval_set_version"]["case_refs"][-1], result["eval_case"]["id"])
            self.assertEqual(detail["cases"][-1]["input"], "diff --git a/errors.ts b/errors.ts\n+ return { token }")

    def test_sqlite_repository_serves_eval_result_read_model(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = SqliteRepository(Path(tmpdir) / "skillhub-demo.sqlite3")
            store = SkillHubStore(repo.load(create_seed_data))
            published = store.publish_variant_version("variant-a", "新版本")
            store.record_eval_run(
                variant_version_id=published["variant_version"]["id"],
                eval_set_version_id="evalset-v1",
                results={"case-null": True, "case-auth": False, "case-noise": True},
            )
            repo.save(store.data)

            detail = repo.eval_result_detail(published["variant_version"]["id"], "evalset-v1")

            self.assertEqual(detail["variant"]["id"], "variant-a")
            self.assertEqual(detail["variant_version"]["id"], published["variant_version"]["id"])
            self.assertEqual(detail["result_counts"], {"passed": 2, "failed": 1, "missing": 0, "total": 3})
            self.assertEqual([item["result"]["passed"] for item in detail["cases"]], [True, False, True])

    def test_sqlite_repository_serves_hub_skill_and_variant_read_models(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            repo = SqliteRepository(Path(tmpdir) / "skillhub-demo.sqlite3")
            store = SkillHubStore(repo.load(create_seed_data))
            created = store.create_variant(
                skill_id="skill-code-reviewer",
                name="Variant C",
                label="OpenCode tuned",
                summary="OpenCode 环境下维护的当前认可解。",
                tags=["opencode", "minimax2.7"],
            )
            repo.save(store.data)

            skills = repo.skills()
            skill = repo.skill_detail("skill-code-reviewer")
            page = repo.variant_page(created["variant"]["id"], None, "evalset-v1")

            self.assertEqual(skills[0]["variant"]["id"], "variant-a")
            self.assertEqual(len(skill["variants"]), 3)
            self.assertEqual(page["variant_version"]["id"], created["variant_version"]["id"])
            self.assertEqual(page["tags"], ["minimax2.7", "opencode"])

    def test_sqlite_repository_imports_legacy_json_once(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            json_path = Path(tmpdir) / "legacy.json"
            json_repo = JsonFileRepository(json_path)
            json_store = SkillHubStore(create_seed_data())
            json_store.create_skill(
                slug="api-reviewer",
                owner_ref="skillhub-lab",
                variant_name="Variant A",
                variant_label="API baseline",
                variant_summary="审查 API 兼容性和鉴权边界。",
                tags=["codex"],
            )
            json_repo.save(json_store.data)

            sqlite_repo = SqliteRepository(Path(tmpdir) / "skillhub-demo.sqlite3", import_json_path=json_path)
            loaded = SkillHubStore(sqlite_repo.load(create_seed_data))

            slugs = [item.slug for item in loaded.data.skills]
            self.assertIn("api-reviewer", slugs)


if __name__ == "__main__":
    unittest.main()
