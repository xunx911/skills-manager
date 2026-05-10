from __future__ import annotations

from typing import Any


COMPARISON_KEYS = (
    "fixed",
    "regressed",
    "stable_pass",
    "stable_fail",
    "missing_baseline",
    "missing_candidate",
)

CHANGE_LABELS = {
    "fixed": "修复",
    "regressed": "回退",
    "stable_pass": "稳定通过",
    "stable_fail": "仍未通过",
    "missing_baseline": "缺少基线",
    "missing_candidate": "候选缺失",
}


def run_change(*, baseline_passed: bool | None, candidate_passed: bool | None) -> str:
    if candidate_passed is None:
        return "missing_candidate"
    if baseline_passed is None:
        return "missing_baseline"
    if not baseline_passed and candidate_passed:
        return "fixed"
    if baseline_passed and not candidate_passed:
        return "regressed"
    if baseline_passed and candidate_passed:
        return "stable_pass"
    return "stable_fail"


def pass_rate(*, passed: int, total: int) -> int | None:
    if total == 0:
        return None
    return round((passed / total) * 100)


def build_run_case_comparisons(
    *,
    eval_set_cases: list[dict[str, Any]],
    baseline_results: dict[str, bool],
    candidate_results: dict[str, bool],
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    summary = {key: 0 for key in COMPARISON_KEYS}
    comparisons = []
    for case_entry in eval_set_cases:
        case_version = case_entry["case_version"]
        case_version_id = case_version["id"]
        baseline_passed = baseline_results.get(case_version_id)
        candidate_passed = candidate_results.get(case_version_id)
        change = run_change(baseline_passed=baseline_passed, candidate_passed=candidate_passed)
        summary[change] += 1
        comparisons.append(
            {
                "case_id": case_entry["case"]["id"],
                "case_title": case_entry["case"]["title"],
                "case_version_id": case_version_id,
                "change": change,
                "change_label": CHANGE_LABELS[change],
                "baseline_passed": baseline_passed,
                "candidate_passed": candidate_passed,
                "input_text": case_version["input_artifact"].get("content_text"),
                "expected_output_text": case_version["expected_output_artifact"].get("content_text"),
            }
        )
    return comparisons, summary


def build_run_comparison_summary(
    *,
    baseline_summary: dict[str, Any],
    candidate_summary: dict[str, Any],
    comparison_summary: dict[str, int],
) -> dict[str, Any]:
    baseline_pass_rate = pass_rate(
        passed=int(baseline_summary.get("passed", 0)),
        total=int(baseline_summary.get("total", 0)),
    )
    candidate_pass_rate = pass_rate(
        passed=int(candidate_summary.get("passed", 0)),
        total=int(candidate_summary.get("total", 0)),
    )
    return {
        **comparison_summary,
        "baseline_pass_rate": baseline_pass_rate,
        "candidate_pass_rate": candidate_pass_rate,
        "delta": None if baseline_pass_rate is None or candidate_pass_rate is None else candidate_pass_rate - baseline_pass_rate,
    }
