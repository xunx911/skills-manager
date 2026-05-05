import unittest

from skillhub_demo.models import ContentRef
from skillhub_demo.seed import create_seed_data
from skillhub_demo.store import SkillHubStore


class StoreTest(unittest.TestCase):
    def setUp(self):
        self.store = SkillHubStore(create_seed_data())

    def test_variant_page_is_bound_to_version_and_eval_set(self):
        page = self.store.variant_page("variant-a", "version-a-v1", "evalset-v1")
        self.assertEqual(page["variant"]["id"], "variant-a")
        self.assertEqual(page["variant_version"]["id"], "version-a-v1")
        self.assertEqual(page["result_counts"], {"passed": 2, "failed": 1, "missing": 0, "total": 3})
        self.assertEqual(page["verification_runs"][0]["eval_set_version"]["id"], "evalset-v1")
        self.assertEqual(page["verification_runs"][0]["result_counts"]["passed"], 2)

    def test_eval_case_creates_new_eval_set_version(self):
        result = self.store.create_eval_case(
            skill_id="skill-code-reviewer",
            title="PR: token 写入错误响应",
            input_text="diff --git a/errors.ts b/errors.ts\n+ return { token }",
            expected_output="应指出 token 泄露风险。",
        )
        self.assertEqual(result["eval_set_version"]["version"], "v2")
        detail = self.store.eval_set_detail("evalset-v2")
        self.assertEqual(len(detail["cases"]), 4)
        self.assertEqual(detail["cases"][-1]["input"], "diff --git a/errors.ts b/errors.ts\n+ return { token }")

    def test_create_skill_creates_default_variant_and_empty_eval_set(self):
        result = self.store.create_skill(
            slug="api-reviewer",
            owner_ref="skillhub-lab",
            variant_name="Variant A",
            variant_label="API baseline",
            variant_summary="审查 API 兼容性和鉴权边界。",
            tags=["codex"],
            change_note="初始 API review 版本。",
        )
        skill = result["skill"]
        variant = result["variant"]
        self.assertEqual(skill["default_variant_ref"], variant["id"])
        detail = self.store.skill_detail(skill["id"])
        self.assertEqual(detail["eval_set_version"]["version"], "v1")
        self.assertEqual(detail["eval_set_version"]["case_refs"], [])
        self.assertEqual(len(detail["variants"]), 1)

    def test_eval_cases_are_scoped_to_their_skill_corpus(self):
        created = self.store.create_skill(
            slug="security-reviewer",
            owner_ref="skillhub-lab",
            variant_name="Variant A",
            variant_label="Security baseline",
            variant_summary="审查鉴权和敏感信息泄露。",
            tags=["codex", "security"],
            change_note="初始 security review 版本。",
        )

        result = self.store.create_eval_case(
            skill_id=created["skill"]["id"],
            title="发现 token 输出到错误响应",
            input_text="diff --git a/errors.ts b/errors.ts\n+ return { access_token }",
            expected_output="应指出 token 泄露风险。",
        )

        code_detail = self.store.skill_detail("skill-code-reviewer")
        security_detail = self.store.skill_detail(created["skill"]["id"])
        self.assertEqual(code_detail["eval_set_version"]["id"], "evalset-v1")
        self.assertEqual(code_detail["eval_set_version"]["case_refs"], ["case-null", "case-auth", "case-noise"])
        self.assertEqual(security_detail["eval_set_version"]["id"], result["eval_set_version"]["id"])
        self.assertEqual(security_detail["eval_set_version"]["case_refs"], [result["eval_case"]["id"]])

    def test_create_variant_registers_tag_set_and_initial_version(self):
        result = self.store.create_variant(
            skill_id="skill-code-reviewer",
            name="Variant C",
            label="OpenCode tuned",
            summary="OpenCode 环境下维护的当前认可解。",
            tags=["opencode", "minimax2.7"],
            change_note="初始 OpenCode 版本。",
        )
        variant = result["variant"]
        version = result["variant_version"]
        self.assertEqual(variant["current_version_ref"], version["id"])
        self.assertEqual(version["version"], "v1")
        page = self.store.variant_page(variant["id"], None, "evalset-v1")
        self.assertEqual(page["tags"], ["minimax2.7", "opencode"])
        self.assertEqual(page["result_counts"]["missing"], 3)

    def test_update_variant_changes_metadata_without_new_version(self):
        before = len(self.store.data.variant_versions)
        result = self.store.update_variant("variant-a", summary="新的简介")
        after = len(self.store.data.variant_versions)
        self.assertEqual(before, after)
        self.assertEqual(result["variant"]["summary"], "新的简介")

    def test_update_skill_changes_metadata_and_default_variant(self):
        result = self.store.update_skill(
            "skill-code-reviewer",
            slug="code-reviewer-v2",
            default_variant_ref="variant-b",
        )
        self.assertEqual(result["skill"]["slug"], "code-reviewer-v2")
        self.assertEqual(result["skill"]["default_variant_ref"], "variant-b")

    def test_archived_skill_is_hidden_from_hub_but_direct_detail_remains(self):
        result = self.store.update_skill("skill-code-reviewer", lifecycle_status="archived")

        self.assertEqual(result["skill"]["lifecycle_status"], "archived")
        self.assertEqual(self.store.skills(), [])
        detail = self.store.skill_detail("skill-code-reviewer")
        self.assertEqual(detail["skill"]["id"], "skill-code-reviewer")
        self.assertEqual(detail["skill"]["lifecycle_status"], "archived")

    def test_archiving_default_variant_requires_changing_default_first(self):
        with self.assertRaisesRegex(ValueError, "default variant"):
            self.store.update_variant("variant-a", lifecycle_status="archived")

        self.store.update_skill("skill-code-reviewer", default_variant_ref="variant-b")
        result = self.store.update_variant("variant-a", lifecycle_status="archived")

        self.assertEqual(result["variant"]["lifecycle_status"], "archived")
        page = self.store.variant_page("variant-a", None, "evalset-v1")
        self.assertEqual(page["variant"]["lifecycle_status"], "archived")

    def test_import_skill_bundle_creates_content_ref(self):
        result = self.store.import_skill_bundle(
            name="code-reviewer-bundle",
            files={
                "SKILL.md": (
                    "---\n"
                    "name: code-reviewer\n"
                    "description: Review pull requests for bugs and test gaps.\n"
                    "---\n\n"
                    "# Code Reviewer\n"
                ),
                "references/checklist.md": "- Check nullability.\n",
            },
        )

        self.assertEqual(result["content_ref"]["kind"], "skill_bundle")
        self.assertEqual(result["metadata"]["name"], "code-reviewer")
        self.assertEqual(result["files"], ["SKILL.md", "references/checklist.md"])
        artifact = self.store._artifact(result["content_ref"]["locator"])
        self.assertEqual(artifact.kind, "skill_bundle")
        detail = self.store.skill_bundle_detail(result["content_ref"]["locator"])
        self.assertEqual(detail["metadata"]["description"], "Review pull requests for bugs and test gaps.")
        self.assertEqual(detail["files"][0]["path"], "SKILL.md")

    def test_import_skill_bundle_requires_skill_md(self):
        with self.assertRaisesRegex(ValueError, "SKILL.md"):
            self.store.import_skill_bundle(name="broken", files={"references/checklist.md": "missing"})

    def test_publish_variant_version_moves_current_pointer(self):
        result = self.store.publish_variant_version("variant-a", "加强 token 泄露审查")
        self.assertEqual(result["variant_version"]["version"], "v3")
        page = self.store.variant_page("variant-a", None, "evalset-v1")
        self.assertEqual(page["variant_version"]["id"], result["variant_version"]["id"])
        self.assertEqual(page["result_counts"]["missing"], 3)

    def test_publish_variant_version_can_reference_skill_bundle(self):
        bundle = self.store.import_skill_bundle(
            name="code-reviewer-bundle",
            files={
                "SKILL.md": (
                    "---\n"
                    "name: code-reviewer\n"
                    "description: Review pull requests for bugs and test gaps.\n"
                    "---\n\n"
                    "# Code Reviewer\n"
                )
            },
        )
        content_ref = bundle["content_ref"]

        result = self.store.publish_variant_version(
            "variant-a",
            "发布标准 skill bundle。",
            content_ref=ContentRef(**content_ref),
        )

        self.assertEqual(result["variant_version"]["content_ref"]["kind"], "skill_bundle")
        self.assertEqual(result["variant_version"]["content_ref"]["locator"], content_ref["locator"])

    def test_record_eval_run_is_pass_fail_only(self):
        created = self.store.publish_variant_version("variant-a", "新版本")
        version_id = created["variant_version"]["id"]
        run = self.store.record_eval_run(
            variant_version_id=version_id,
            eval_set_version_id="evalset-v1",
            results={"case-null": True, "case-auth": False, "case-noise": True},
        )
        self.assertEqual(run["result_counts"], {"passed": 2, "failed": 1, "missing": 0, "total": 3})

    def test_record_eval_run_requires_same_skill_for_variant_version_and_eval_set(self):
        created = self.store.create_skill(
            slug="security-reviewer",
            owner_ref="skillhub-lab",
            variant_name="Variant A",
            variant_label="Security baseline",
            variant_summary="审查鉴权和敏感信息泄露。",
            tags=["codex", "security"],
            change_note="初始 security review 版本。",
        )

        with self.assertRaisesRegex(ValueError, "same skill"):
            self.store.record_eval_run(
                variant_version_id=created["variant_version"]["id"],
                eval_set_version_id="evalset-v1",
                results={"case-null": True, "case-auth": True, "case-noise": True},
            )


if __name__ == "__main__":
    unittest.main()
