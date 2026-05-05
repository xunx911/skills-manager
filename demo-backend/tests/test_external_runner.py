import socket
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

from skillhub_demo import server as server_module
from skillhub_demo.external_runner import build_eval_result_payload, import_eval_result
from skillhub_demo.seed import create_seed_data
from skillhub_demo.store import SkillHubStore


REPO_ROOT = Path(__file__).resolve().parents[2]


class ExternalRunnerTest(unittest.TestCase):
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

    def test_runner_builds_payload_from_eval_set_and_imports_result(self):
        payload = build_eval_result_payload(
            base_url=self.base_url,
            variant_version_id="version-a-v1",
            eval_set_version_id="evalset-v1",
            strategy_ref="external-demo-runner-v1",
            fail_case_version_ids=["casever-noise-v1"],
        )

        self.assertEqual(payload["results"]["casever-null-v1"], True)
        self.assertEqual(payload["results"]["casever-auth-v1"], True)
        self.assertEqual(payload["results"]["casever-noise-v1"], False)

        result = import_eval_result(self.base_url, payload)

        self.assertEqual(result["eval_run"]["strategy_ref"], "external-demo-runner-v1")
        self.assertEqual(result["result_counts"], {"passed": 2, "failed": 1, "missing": 0, "total": 3})

    def test_runner_rejects_fail_case_outside_eval_set(self):
        with self.assertRaisesRegex(ValueError, "not in eval set"):
            build_eval_result_payload(
                base_url=self.base_url,
                variant_version_id="version-a-v1",
                eval_set_version_id="evalset-v1",
                strategy_ref="external-demo-runner-v1",
                fail_case_version_ids=["casever-missing-v1"],
            )

    def test_runner_can_select_failed_case_by_title_filter(self):
        payload = build_eval_result_payload(
            base_url=self.base_url,
            variant_version_id="version-a-v1",
            eval_set_version_id="evalset-v1",
            strategy_ref="external-demo-runner-v1",
            fail_case_title_contains=["仅重命名"],
        )

        self.assertEqual(payload["results"]["casever-noise-v1"], False)
        self.assertEqual(payload["results"]["casever-null-v1"], True)

    def test_runner_supports_all_pass_strategy(self):
        payload = build_eval_result_payload(
            base_url=self.base_url,
            variant_version_id="version-a-v1",
            eval_set_version_id="evalset-v1",
            strategy_ref="external-demo-runner-v1",
            strategy="all_pass",
        )

        self.assertEqual(set(payload["results"].values()), {True})
        self.assertEqual(payload["config"]["strategy"], "all_pass")

    def test_runner_supports_expected_keyword_strategy(self):
        payload = build_eval_result_payload(
            base_url=self.base_url,
            variant_version_id="version-a-v1",
            eval_set_version_id="evalset-v1",
            strategy_ref="external-demo-runner-v1",
            strategy="expected_keyword",
            expected_keyword="ownerId",
        )

        self.assertEqual(payload["results"]["casever-auth-v1"], True)
        self.assertEqual(payload["results"]["casever-null-v1"], False)
        self.assertEqual(payload["results"]["casever-noise-v1"], False)

    def test_expected_keyword_strategy_requires_keyword(self):
        with self.assertRaisesRegex(ValueError, "expected_keyword"):
            build_eval_result_payload(
                base_url=self.base_url,
                variant_version_id="version-a-v1",
                eval_set_version_id="evalset-v1",
                strategy_ref="external-demo-runner-v1",
                strategy="expected_keyword",
            )

    def test_runner_supports_external_command_strategy(self):
        command = [
            sys.executable,
            "-c",
            (
                "import json, sys; "
                "payload=json.load(sys.stdin); "
                "cases=payload['eval_set']['eval_set_version']['case_version_refs']; "
                "print(json.dumps({'results': {case: case.endswith('auth-v1') for case in cases}}))"
            ),
        ]

        payload = build_eval_result_payload(
            base_url=self.base_url,
            variant_version_id="version-a-v1",
            eval_set_version_id="evalset-v1",
            strategy_ref="external-demo-runner-v1",
            strategy="external_command",
            external_command=command,
        )

        self.assertEqual(payload["results"]["casever-auth-v1"], True)
        self.assertEqual(payload["results"]["casever-null-v1"], False)
        self.assertEqual(payload["config"]["external_command"], command)

    def test_external_command_strategy_requires_command(self):
        with self.assertRaisesRegex(ValueError, "external_command"):
            build_eval_result_payload(
                base_url=self.base_url,
                variant_version_id="version-a-v1",
                eval_set_version_id="evalset-v1",
                strategy_ref="external-demo-runner-v1",
                strategy="external_command",
            )

    def test_runner_can_use_example_keyword_evaluator(self):
        evaluator_path = REPO_ROOT / "examples" / "evaluators" / "keyword_evaluator.py"
        payload = build_eval_result_payload(
            base_url=self.base_url,
            variant_version_id="version-a-v1",
            eval_set_version_id="evalset-v1",
            strategy_ref="example-keyword-evaluator-v1",
            strategy="external_command",
            external_command=[sys.executable, str(evaluator_path), "--keyword", "ownerId"],
        )

        self.assertEqual(payload["results"]["casever-auth-v1"], True)
        self.assertEqual(payload["results"]["casever-null-v1"], False)
        self.assertEqual(payload["strategy_ref"], "example-keyword-evaluator-v1")


if __name__ == "__main__":
    unittest.main()
