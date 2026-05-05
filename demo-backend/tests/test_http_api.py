import json
import socket
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from skillhub_demo import server as server_module
from skillhub_demo.seed import create_seed_data
from skillhub_demo.store import SkillHubStore


class HttpApiTest(unittest.TestCase):
    def setUp(self):
        server_module.STORE = SkillHubStore(create_seed_data())
        server_module.REPOSITORY = None
        server_module.DATA_PATH = None
        try:
            self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server_module.Handler)
        except PermissionError as error:
            self.skipTest("local socket bind is not permitted in this sandbox: %s" % error)
        except socket.error as error:
            self.skipTest("local socket bind failed: %s" % error)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = "http://127.0.0.1:%d" % self.httpd.server_address[1]

    def tearDown(self):
        self.httpd.shutdown()
        self.thread.join(timeout=2)
        self.httpd.server_close()

    def test_health_and_state(self):
        self.assertEqual(self.get("/health"), {"ok": True})
        state = self.get("/api/state")
        self.assertEqual(state["skills"][0]["slug"], "code-reviewer")

    def test_skill_bundle_import_detail_and_publish_flow(self):
        bundle = self.post(
            "/api/skill-bundles",
            {
                "name": "code-reviewer-bundle",
                "files": {
                    "SKILL.md": (
                        "---\n"
                        "name: code-reviewer\n"
                        "description: Review pull requests for bugs and test gaps.\n"
                        "---\n\n"
                        "# Code Reviewer\n"
                    ),
                    "references/checklist.md": "- Check nullability.\n",
                },
            },
        )
        detail = self.get("/api/skill-bundle?artifact_id=%s" % bundle["content_ref"]["locator"])
        self.assertEqual(detail["metadata"]["name"], "code-reviewer")
        self.assertEqual([item["path"] for item in detail["files"]], ["SKILL.md", "references/checklist.md"])

        published = self.post(
            "/api/variant-versions",
            {
                "variant_id": "variant-a",
                "change_note": "发布标准 skill bundle。",
                "content_ref": bundle["content_ref"],
            },
        )
        self.assertEqual(published["variant_version"]["content_ref"]["kind"], "skill_bundle")

        page = self.get(
            "/api/variant-page?variant_id=variant-a&version_id=%s&eval_set_version_id=evalset-v1"
            % published["variant_version"]["id"]
        )
        self.assertEqual(page["content_ref"]["locator"], bundle["content_ref"]["locator"])

    def test_eval_run_rejects_cross_skill_eval_set(self):
        created = self.post(
            "/api/skills",
            {
                "slug": "security-reviewer",
                "owner_ref": "skillhub-lab",
                "default_variant": {
                    "name": "Variant A",
                    "label": "Security baseline",
                    "summary": "审查鉴权和敏感信息泄露。",
                    "tags": ["codex", "security"],
                    "change_note": "初始 security review 版本。",
                },
            },
        )

        with self.assertRaises(HTTPError) as context:
            self.post(
                "/api/eval-runs",
                {
                    "variant_version_id": created["variant_version"]["id"],
                    "eval_set_version_id": "evalset-v1",
                    "results": {"case-null": True},
                },
            )
        self.assertEqual(context.exception.code, 400)

    def test_eval_case_version_publish_flow(self):
        result = self.post(
            "/api/eval-case-versions",
            {
                "case_id": "case-null",
                "input": "updated input",
                "expected_output": "updated expected",
            },
        )

        self.assertEqual(result["eval_case_version"]["version"], "v2")
        self.assertEqual(result["eval_case"]["current_version_ref"], result["eval_case_version"]["id"])
        self.assertEqual(result["eval_set_version"]["version"], "v2")
        detail = self.get("/api/eval-set?eval_set_version_id=%s" % result["eval_set_version"]["id"])
        self.assertEqual(detail["cases"][0]["id"], result["eval_case_version"]["id"])
        self.assertEqual(detail["cases"][0]["input"], "updated input")

    def get(self, path):
        with urlopen("%s%s" % (self.base_url, path), timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))

    def post(self, path, payload):
        request = Request(
            "%s%s" % (self.base_url, path),
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
