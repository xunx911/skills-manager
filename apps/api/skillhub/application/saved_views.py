from __future__ import annotations

from typing import Mapping

from skillhub.domain.errors import InvariantError


SUPPORTED_SAVED_VIEW_TYPES = frozenset({"run_history"})

SAVED_VIEW_CONFIG_KEYS = frozenset(
    {
        "variant_version_id",
        "eval_set_version_id",
        "strategy",
        "status",
        "matrix_group_by",
        "matrix_impact",
        "matrix_show_impact",
        "matrix_show_score",
        "matrix_show_summary",
        "compare_baseline_run_id",
        "compare_candidate_run_id",
    }
)


def validate_saved_view_type(view_type: str) -> None:
    if view_type not in SUPPORTED_SAVED_VIEW_TYPES:
        raise InvariantError(f"Unsupported saved view type: {view_type}")


def normalize_saved_view_config(config: Mapping[str, object]) -> dict[str, str]:
    clean: dict[str, str] = {}
    for key in SAVED_VIEW_CONFIG_KEYS:
        value = config.get(key)
        if not isinstance(value, str):
            continue
        value = value.strip()
        if value and value != "all":
            clean[key] = value
    return clean
