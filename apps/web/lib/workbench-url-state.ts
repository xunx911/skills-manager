import type { DiffFilter } from "@/components/diff/workbench-diff-pane";
import type { HistoryRunFilters } from "@/components/history/workbench-history-pane";
import type { RunMatrixControls } from "@/components/run-matrix/run-matrix-panel";
import type { AuditExplorerFilters } from "@/components/skills/skill-audit-explorer";
import type { WorkbenchMode } from "@/components/workbench-tabs";

export const SHAREABLE_MODES: WorkbenchMode[] = ["overview", "variants", "evals", "diff", "history", "audit", "promotion"];

export const DEFAULT_RUN_FILTERS: HistoryRunFilters = {
  variant_version_id: "all",
  eval_set_version_id: "all",
  strategy: "all",
  status: "all",
};

export const DEFAULT_RUN_MATRIX_CONTROLS: RunMatrixControls = {
  matrix_group_by: "none",
  matrix_impact: "all",
  matrix_show_score: "true",
};

export const DEFAULT_AUDIT_FILTERS: AuditExplorerFilters = {
  actor: "",
  action: "",
  resource_type: "all",
};

export type PromotionUrlTarget = {
  candidateVersionId: string;
  evalSetVersionId: string | null;
  variantId: string;
};

export type WorkbenchUrlState = {
  auditFilters: AuditExplorerFilters;
  compareBaselineRunId: string | null;
  compareCandidateRunId: string | null;
  diffFilter: DiffFilter;
  diffLeftVersionId: string | null;
  diffRightVersionId: string | null;
  evalTargetVersionId: string | null;
  mode: WorkbenchMode;
  promotionTarget: PromotionUrlTarget | null;
  runFilters: HistoryRunFilters;
  runMatrixControls: RunMatrixControls;
  selectedCaseId: string | null;
  selectedDiffPath: string | null;
  selectedRunId: string | null;
  skill: string;
};

type WorkbenchUrlInput = {
  hash: string;
  pathname: string;
  state: WorkbenchUrlState;
};

const DIFF_FILTERS: DiffFilter[] = ["all", "changed", "added", "removed", "binary"];
const MATRIX_GROUPS: RunMatrixControls["matrix_group_by"][] = ["none", "impact"];
const MATRIX_IMPACTS: RunMatrixControls["matrix_impact"][] = [
  "all",
  "waiting",
  "fixed",
  "regressed",
  "stable_pass",
  "stable_fail",
  "missing",
];
const MATRIX_SCORES: RunMatrixControls["matrix_show_score"][] = ["true", "false"];
const AUDIT_RESOURCE_TYPES = ["all", "skill", "variant", "eval_run"];

export function parseWorkbenchUrlState(search: string | URLSearchParams): WorkbenchUrlState {
  const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
  const mode = enumValue(params.get("mode"), SHAREABLE_MODES, "overview");
  return {
    auditFilters: {
      actor: params.get("audit_actor") ?? "",
      action: params.get("audit_action") ?? "",
      resource_type: enumValue(params.get("audit_resource"), AUDIT_RESOURCE_TYPES, "all"),
    },
    compareBaselineRunId: params.get("compare_base"),
    compareCandidateRunId: params.get("compare_candidate"),
    diffFilter: enumValue(params.get("diff_filter"), DIFF_FILTERS, "all"),
    diffLeftVersionId: params.get("diff_left"),
    diffRightVersionId: params.get("diff_right"),
    evalTargetVersionId: params.get("eval_target"),
    mode,
    promotionTarget: promotionTargetFromParams(params),
    runFilters: {
      variant_version_id: params.get("run_variant") ?? "all",
      eval_set_version_id: params.get("run_eval_set") ?? "all",
      strategy: params.get("run_strategy") ?? "all",
      status: params.get("run_status") ?? "all",
    },
    runMatrixControls: {
      matrix_group_by: enumValue(params.get("matrix_group"), MATRIX_GROUPS, "none"),
      matrix_impact: enumValue(params.get("matrix_impact"), MATRIX_IMPACTS, "all"),
      matrix_show_score: enumValue(params.get("matrix_score"), MATRIX_SCORES, "true"),
    },
    selectedCaseId: params.get("case"),
    selectedDiffPath: params.get("diff_file"),
    selectedRunId: params.get("run"),
    skill: params.get("skill") ?? "",
  };
}

export function workbenchUrlForState({ hash, pathname, state }: WorkbenchUrlInput) {
  const params = new URLSearchParams();
  setParam(params, "skill", state.skill);
  if (state.mode !== "overview") setParam(params, "mode", state.mode);

  if (state.mode === "diff") {
    setParam(params, "diff_left", state.diffLeftVersionId);
    setParam(params, "diff_right", state.diffRightVersionId);
    setParam(params, "diff_file", state.selectedDiffPath);
    if (state.diffFilter !== "all") setParam(params, "diff_filter", state.diffFilter);
  }

  if (state.mode === "evals") {
    setParam(params, "eval_target", state.evalTargetVersionId);
    setParam(params, "case", state.selectedCaseId);
  }

  if (state.mode === "history") {
    setParam(params, "run_variant", nonDefault(state.runFilters.variant_version_id, DEFAULT_RUN_FILTERS.variant_version_id));
    setParam(params, "run_eval_set", nonDefault(state.runFilters.eval_set_version_id, DEFAULT_RUN_FILTERS.eval_set_version_id));
    setParam(params, "run_strategy", nonDefault(state.runFilters.strategy, DEFAULT_RUN_FILTERS.strategy));
    setParam(params, "run_status", nonDefault(state.runFilters.status, DEFAULT_RUN_FILTERS.status));
    setParam(params, "run", state.selectedRunId);
    setParam(params, "compare_base", state.compareBaselineRunId);
    setParam(params, "compare_candidate", state.compareCandidateRunId);
    setParam(params, "matrix_group", nonDefault(state.runMatrixControls.matrix_group_by, DEFAULT_RUN_MATRIX_CONTROLS.matrix_group_by));
    setParam(params, "matrix_impact", nonDefault(state.runMatrixControls.matrix_impact, DEFAULT_RUN_MATRIX_CONTROLS.matrix_impact));
    setParam(params, "matrix_score", nonDefault(state.runMatrixControls.matrix_show_score, DEFAULT_RUN_MATRIX_CONTROLS.matrix_show_score));
  }

  if (state.mode === "promotion" && state.promotionTarget) {
    setParam(params, "promotion_variant", state.promotionTarget.variantId);
    setParam(params, "promotion_candidate", state.promotionTarget.candidateVersionId);
    setParam(params, "promotion_eval_set", state.promotionTarget.evalSetVersionId);
  }

  if (state.mode === "audit") {
    setParam(params, "audit_actor", state.auditFilters.actor.trim());
    setParam(params, "audit_action", state.auditFilters.action.trim());
    setParam(params, "audit_resource", nonDefault(state.auditFilters.resource_type, DEFAULT_AUDIT_FILTERS.resource_type));
  }

  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

function promotionTargetFromParams(params: URLSearchParams): PromotionUrlTarget | null {
  const variantId = params.get("promotion_variant");
  const candidateVersionId = params.get("promotion_candidate");
  if (!variantId || !candidateVersionId) return null;
  return {
    candidateVersionId,
    evalSetVersionId: params.get("promotion_eval_set"),
    variantId,
  };
}

function setParam(params: URLSearchParams, key: string, value: string | null | undefined) {
  if (value) params.set(key, value);
}

function nonDefault(value: string, defaultValue: string) {
  return value === defaultValue ? null : value;
}

function enumValue<Value extends string>(value: string | null, allowed: readonly Value[], fallback: Value): Value {
  return allowed.includes(value as Value) ? (value as Value) : fallback;
}
