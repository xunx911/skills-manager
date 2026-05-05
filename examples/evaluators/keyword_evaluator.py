from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Dict, List


def main() -> None:
    parser = argparse.ArgumentParser(description="Example SkillHub evaluator using a simple expected-output keyword check.")
    parser.add_argument("--keyword", required=True, help="Case passes when expectation or expected_output contains this text.")
    args = parser.parse_args()

    payload = json.load(sys.stdin)
    eval_set = payload.get("eval_set")
    if not isinstance(eval_set, dict):
        raise SystemExit("stdin must be a JSON object with eval_set")

    results = evaluate(eval_set, args.keyword)
    print(json.dumps({"results": results}, ensure_ascii=False))


def evaluate(eval_set: Dict[str, Any], keyword: str) -> Dict[str, bool]:
    cases = eval_set.get("cases")
    if not isinstance(cases, list):
        raise SystemExit("eval_set.cases must be a list")

    results: Dict[str, bool] = {}
    for case in cases:
        normalized = normalize_case(case)
        haystack = "%s\n%s\n%s" % (
            normalized.get("title", ""),
            normalized.get("expectation", ""),
            normalized.get("expected_output", ""),
        )
        results[normalized["id"]] = keyword in haystack
    return results


def normalize_case(case: Any) -> Dict[str, str]:
    if not isinstance(case, dict):
        raise SystemExit("each case must be an object")
    required = ["id"]
    for key in required:
        if not isinstance(case.get(key), str) or not case[key]:
            raise SystemExit("case.%s must be a non-empty string" % key)
    return {
        "id": case["id"],
        "title": string_or_empty(case.get("title")),
        "expectation": string_or_empty(case.get("expectation")),
        "expected_output": string_or_empty(case.get("expected_output")),
    }


def string_or_empty(value: Any) -> str:
    return value if isinstance(value, str) else ""


if __name__ == "__main__":
    main()
