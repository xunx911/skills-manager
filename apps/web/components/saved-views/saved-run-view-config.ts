import type { HistoryRunFilters } from "@/components/history/workbench-history-pane";
import type { RunMatrixControls } from "@/components/run-matrix/run-matrix-panel";
import type { SavedView } from "@/lib/types";
import { DEFAULT_RUN_MATRIX_CONTROLS } from "@/lib/workbench-url-state";

export type SavedRunViewConfigInput = {
  baselineRunId: string | null;
  candidateRunId: string | null;
  filters: HistoryRunFilters;
  matrixControls: RunMatrixControls;
};

export function buildSavedRunViewConfig({
  baselineRunId,
  candidateRunId,
  filters,
  matrixControls,
}: SavedRunViewConfigInput): SavedView["config"] {
  return {
    ...runFilterConfig(filters),
    ...runMatrixControlConfig(matrixControls),
    ...runComparisonConfig(baselineRunId, candidateRunId),
  };
}

export function runFiltersFromConfig(config: SavedView["config"]): Partial<HistoryRunFilters> {
  return {
    ...(config.variant_version_id ? { variant_version_id: config.variant_version_id } : {}),
    ...(config.eval_set_version_id ? { eval_set_version_id: config.eval_set_version_id } : {}),
    ...(config.strategy ? { strategy: config.strategy } : {}),
    ...(config.status ? { status: config.status } : {}),
  };
}

export function runMatrixControlsFromConfig(config: SavedView["config"]): Partial<RunMatrixControls> {
  return {
    ...(config.matrix_group_by === "impact" || config.matrix_group_by === "none" ? { matrix_group_by: config.matrix_group_by } : {}),
    ...(isMatrixImpactConfig(config.matrix_impact) ? { matrix_impact: config.matrix_impact } : {}),
    ...(config.matrix_show_impact === "true" || config.matrix_show_impact === "false" ? { matrix_show_impact: config.matrix_show_impact } : {}),
    ...(config.matrix_show_score === "true" || config.matrix_show_score === "false" ? { matrix_show_score: config.matrix_show_score } : {}),
  };
}

export function runComparisonFromConfig(config: SavedView["config"]) {
  return {
    baselineRunId: config.compare_baseline_run_id ?? null,
    candidateRunId: config.compare_candidate_run_id ?? null,
  };
}

function runFilterConfig(filters: HistoryRunFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== "all"));
}

function runMatrixControlConfig(controls: RunMatrixControls) {
  return Object.fromEntries(
    Object.entries(controls).filter(([key, value]) => value !== DEFAULT_RUN_MATRIX_CONTROLS[key as keyof RunMatrixControls]),
  );
}

function runComparisonConfig(baselineRunId: string | null, candidateRunId: string | null) {
  return {
    ...(baselineRunId ? { compare_baseline_run_id: baselineRunId } : {}),
    ...(candidateRunId ? { compare_candidate_run_id: candidateRunId } : {}),
  };
}

function isMatrixImpactConfig(value: string | undefined): value is RunMatrixControls["matrix_impact"] {
  return value === "all" || value === "waiting" || value === "fixed" || value === "regressed" || value === "stable_pass" || value === "stable_fail" || value === "missing";
}
