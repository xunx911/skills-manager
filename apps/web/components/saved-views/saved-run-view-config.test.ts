import { describe, expect, it } from "vitest";

import type { HistoryRunFilters } from "@/components/history/workbench-history-pane";
import type { RunMatrixControls } from "@/components/run-matrix/run-matrix-panel";
import type { SavedView } from "@/lib/types";

import {
  buildSavedRunViewConfig,
  runComparisonFromConfig,
  runFiltersFromConfig,
  runMatrixControlsFromConfig,
} from "./saved-run-view-config";

const defaultFilters: HistoryRunFilters = {
  eval_set_version_id: "all",
  status: "all",
  strategy: "all",
  variant_version_id: "all",
};

const defaultMatrixControls: RunMatrixControls = {
  matrix_group_by: "none",
  matrix_impact: "all",
  matrix_show_impact: "true",
  matrix_show_summary: "true",
  matrix_show_score: "true",
};

describe("saved run view config", () => {
  it("builds a compact config from filters, matrix controls, and comparison pointers", () => {
    expect(buildSavedRunViewConfig({
      baselineRunId: "run-baseline",
      candidateRunId: "run-candidate",
      filters: {
        ...defaultFilters,
        strategy: "manual_pass_fail",
        variant_version_id: "version-candidate",
      },
      matrixControls: {
        ...defaultMatrixControls,
        matrix_group_by: "impact",
        matrix_show_summary: "false",
        matrix_show_score: "false",
      },
    })).toEqual({
      compare_baseline_run_id: "run-baseline",
      compare_candidate_run_id: "run-candidate",
      matrix_group_by: "impact",
      matrix_show_summary: "false",
      matrix_show_score: "false",
      strategy: "manual_pass_fail",
      variant_version_id: "version-candidate",
    });
  });

  it("omits default values and empty comparison pointers", () => {
    expect(buildSavedRunViewConfig({
      baselineRunId: null,
      candidateRunId: null,
      filters: defaultFilters,
      matrixControls: defaultMatrixControls,
    })).toEqual({});
  });

  it("restores run filters from config", () => {
    const config: SavedView["config"] = {
      eval_set_version_id: "eval-v3",
      status: "completed",
      strategy: "manual_pass_fail",
      variant_version_id: "variant-v2",
    };

    expect(runFiltersFromConfig(config)).toEqual(config);
  });

  it("restores only valid matrix controls from config", () => {
    expect(runMatrixControlsFromConfig({
      matrix_group_by: "impact",
      matrix_impact: "fixed",
      matrix_show_impact: "false",
      matrix_show_summary: "false",
      matrix_show_score: "maybe",
    })).toEqual({
      matrix_group_by: "impact",
      matrix_impact: "fixed",
      matrix_show_impact: "false",
      matrix_show_summary: "false",
    });
  });

  it("restores comparison pointers from config", () => {
    expect(runComparisonFromConfig({
      compare_baseline_run_id: "run-baseline",
      compare_candidate_run_id: "run-candidate",
    })).toEqual({
      baselineRunId: "run-baseline",
      candidateRunId: "run-candidate",
    });

    expect(runComparisonFromConfig({})).toEqual({
      baselineRunId: null,
      candidateRunId: null,
    });
  });
});
