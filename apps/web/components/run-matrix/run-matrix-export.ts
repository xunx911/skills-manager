import type { EvalRunMatrix } from "@/lib/types";

export type MatrixImpact = "waiting" | "fixed" | "regressed" | "stable_pass" | "stable_fail" | "missing";

export type RunMatrixCsvRow = {
  impact: MatrixImpact;
  row: EvalRunMatrix["cases"][number];
};

export type RunMatrixCsvInput = {
  cells: EvalRunMatrix["cells"];
  rows: RunMatrixCsvRow[];
  runs: EvalRunMatrix["runs"];
  showImpact: boolean;
};

export const impactCopy: Record<MatrixImpact, string> = {
  waiting: "选择对照/候选",
  fixed: "修复",
  regressed: "回退",
  stable_pass: "稳定通过",
  stable_fail: "仍未通过",
  missing: "缺失",
};

export const impactOrder: MatrixImpact[] = ["fixed", "regressed", "stable_fail", "stable_pass", "missing", "waiting"];

export function buildRunMatrixCsv({ cells, rows, runs, showImpact }: RunMatrixCsvInput) {
  const cellMap = new Map(cells.map((cell) => [`${cell.run_id}:${cell.case_id}`, cell]));
  const header = ["Case", "Versions", ...(showImpact ? ["Impact"] : []), ...runs.map(runMatrixRunLabel)];
  const csvRows = rows.map(({ impact, row }) => {
    const values = [
      row.case.title,
      row.versions.map((version) => `v${version.version_number}`).join(", "),
      ...(showImpact ? [impactCopy[impact]] : []),
      ...runs.map((run) => resultText(cellMap.get(`${run.eval_run.id}:${row.case.id}`)?.passed ?? null)),
    ];

    return values.map(csvEscape).join(",");
  });

  return [header.map(csvEscape).join(","), ...csvRows].join("\n");
}

export function getCaseImpact(
  cells: Map<string, EvalRunMatrix["cells"][number]>,
  caseId: string,
  baselineRunId?: string | null,
  candidateRunId?: string | null,
  hasImpactPair = false,
): MatrixImpact {
  if (!hasImpactPair || !baselineRunId || !candidateRunId) return "waiting";
  const baseline = cells.get(`${baselineRunId}:${caseId}`);
  const candidate = cells.get(`${candidateRunId}:${caseId}`);
  if (!baseline || !candidate) return "missing";
  if (!baseline.passed && candidate.passed) return "fixed";
  if (baseline.passed && !candidate.passed) return "regressed";
  if (baseline.passed && candidate.passed) return "stable_pass";
  return "stable_fail";
}

export function runMatrixCsvFilename(skillSlug: string, timestamp = new Date()) {
  const safeSlug = skillSlug.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "skill";
  const safeTimestamp = timestamp.toISOString().replace(/[:.]/g, "-");
  return `run-matrix-${safeSlug}-${safeTimestamp}.csv`;
}

export function runMatrixRunLabel(row: EvalRunMatrix["runs"][number]) {
  return `${row.variant.label} v${row.variant_version.version_number} / ${row.eval_set.name} v${row.eval_set_version.version_number}`;
}

function resultText(passed: boolean | null) {
  if (passed === null) return "未覆盖";
  return passed ? "通过" : "不通过";
}

function csvEscape(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, "\"\"")}"`;
}
