import tempfile
import unittest
from pathlib import Path

from skillhub_demo.persistence import load_app_data, save_app_data
from skillhub_demo.seed import create_seed_data
from skillhub_demo.store import SkillHubStore


class PersistenceTest(unittest.TestCase):
    def test_save_and_load_round_trips_mutated_state(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            data_path = Path(tmpdir) / "skillhub-demo.json"
            store = SkillHubStore(create_seed_data())
            created = store.create_skill(
                slug="api-reviewer",
                owner_ref="skillhub-lab",
                variant_name="Variant A",
                variant_label="API baseline",
                variant_summary="审查 API 兼容性和鉴权边界。",
                tags=["codex"],
                change_note="初始 API review 版本。",
            )

            save_app_data(data_path, store.data)
            loaded = load_app_data(data_path, create_seed_data)
            loaded_store = SkillHubStore(loaded)

            detail = loaded_store.skill_detail(created["skill"]["id"])
            self.assertEqual(detail["skill"]["slug"], "api-reviewer")
            self.assertEqual(detail["variants"][0]["id"], created["variant"]["id"])
            self.assertEqual(detail["eval_set_version"]["case_version_refs"], [])

    def test_missing_file_uses_seed_fallback(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            data = load_app_data(Path(tmpdir) / "missing.json", create_seed_data)
            self.assertEqual(data.skills[0].id, "skill-code-reviewer")


if __name__ == "__main__":
    unittest.main()
