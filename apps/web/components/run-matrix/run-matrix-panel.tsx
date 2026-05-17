"use client";

import { Fragment, useId } from "react";

import { CheckboxField, SelectField } from "@/components/forms/workbench-field";
import { passRate } from "@/lib/api";
import { percent } from "@/lib/format";
import type { EvalRunMatrix } from "@/lib/types";

export type MatrixImpact = "waiting" | "fixed" | "regressed" | "stable_pass" | "stable_fail" | "missing";
export type RunMatrixControls = {
  matrix_group_by: "none" | "impact";
  matrix_impact: "all" | MatrixImpact;
  matrix_show_impact: "true" | "false";
  matrix_show_score: "true" | "false";
};

const impactCopy: Record<MatrixImpact, string> = {
  waiting: "选择对照/候选",
  fixed: "修复",
  regressed: "回退",
  stable_pass: "稳定通过",
  stable_fail: "仍未通过",
  missing: "缺失",
};
const impactOrder: MatrixImpact[] = ["fixed", "regressed", "stable_fail", "stable_pass", "missing", "waiting"];

const impactClass: Record<MatrixImpact, string> = {
  waiting: "runMatrixImpactWaiting",
  fixed: "runMatrixImpactFixed",
  regressed: "runMatrixImpactRegressed",
  stable_pass: "runMatrixImpactStablePass",
  stable_fail: "runMatrixImpactStableFail",
  missing: "runMatrixImpactMissing",
};

export function RunMatrixPanel({
  baselineRunId,
  candidateRunId,
  controls,
  loading,
  matrix,
  onControlChange,
}: {
  baselineRunId?: string | null;
  candidateRunId?: string | null;
  controls: RunMatrixControls;
  loading: boolean;
  matrix: EvalRunMatrix | null;
  onControlChange: <Key extends keyof RunMatrixControls>(key: Key, value: RunMatrixControls[Key]) => void;
}) {
  const runs = matrix?.runs ?? [];
  const cases = matrix?.cases ?? [];
  const cells = new Map((matrix?.cells ?? []).map((cell) => [`${cell.run_id}:${cell.case_id}`, cell]));
  const hasImpactPair = Boolean(baselineRunId && candidateRunId && baselineRunId !== candidateRunId);
  const rows = cases.map((row) => ({
    impact: caseImpact(cells, row.case.id, baselineRunId, candidateRunId, hasImpactPair),
    row,
  }));
  const visibleRows = rows.filter((item) => controls.matrix_impact === "all" || item.impact === controls.matrix_impact);
  const groupedRows = controls.matrix_group_by === "impact"
    ? impactOrder.map((impact) => ({
      impact,
      label: impactCopy[impact],
      rows: visibleRows.filter((item) => item.impact === impact),
    })).filter((group) => group.rows.length > 0)
    : [{ impact: "waiting" as MatrixImpact, label: null, rows: visibleRows }];
  const showImpact = controls.matrix_show_impact !== "false";
  const showScore = controls.matrix_show_score !== "false";
  const descriptionId = useId();
  const groupRowCount = groupedRows.filter((group) => Boolean(group.label)).length;
  const tableRowCount = 1 + groupRowCount + visibleRows.length;
  const tableColCount = runs.length + (showImpact ? 2 : 1);
  const runColumnOffset = showImpact ? 3 : 2;
  const matrixDescription = loading
    ? "正在加载矩阵。"
    : `${runs.length} runs · ${cases.length} cases · 当前筛选生效`;
  let bodyRowIndex = 2;

  return (
    <section className="runMatrixPanel" data-testid="run-matrix-panel">
      <div className="runMatrixHead">
        <div>
          <h3>Run matrix</h3>
          <p id={descriptionId}>{matrixDescription}</p>
        </div>
        <span>Case x EvalRun</span>
      </div>
      <div className="runMatrixControls" aria-label="Matrix controls">
        <SelectField
          aria-label="Matrix impact filter"
          label="Impact"
          onChange={(event) => onControlChange("matrix_impact", event.currentTarget.value as RunMatrixControls["matrix_impact"])}
          value={controls.matrix_impact}
        >
          <option value="all">All impacts</option>
          {impactOrder.map((impact) => (
            <option key={impact} value={impact}>{impactCopy[impact]}</option>
          ))}
        </SelectField>
        <SelectField
          aria-label="Matrix group by"
          label="Group"
          onChange={(event) => onControlChange("matrix_group_by", event.currentTarget.value as RunMatrixControls["matrix_group_by"])}
          value={controls.matrix_group_by}
        >
          <option value="none">No grouping</option>
          <option value="impact">Impact</option>
        </SelectField>
        <CheckboxField
          aria-label="Show matrix score"
          checked={showScore}
          className="runMatrixToggle"
          label="Score"
          onChange={(event) => onControlChange("matrix_show_score", event.currentTarget.checked ? "true" : "false")}
        />
        <CheckboxField
          aria-label="Impact column"
          checked={showImpact}
          className="runMatrixToggle"
          label="Impact column"
          onChange={(event) => onControlChange("matrix_show_impact", event.currentTarget.checked ? "true" : "false")}
        />
      </div>

      {!loading && runs.length === 0 ? (
        <div className="linearEmpty">还没有可进入矩阵的测评 run。</div>
      ) : !loading && visibleRows.length === 0 ? (
        <div className="runMatrixEmptyView">当前矩阵视图没有匹配 case。</div>
      ) : (
        <div className="runMatrixScroller">
          <table
            aria-colcount={tableColCount}
            aria-describedby={descriptionId}
            aria-rowcount={tableRowCount}
            className="runMatrixTable"
          >
            <caption className="visuallyHidden">Run matrix results</caption>
            <thead>
              <tr aria-rowindex={1}>
                <th aria-colindex={1} className="runMatrixCaseHeader" scope="col">Case</th>
                {showImpact ? <th aria-colindex={2} className="runMatrixImpactHeader" scope="col">Impact</th> : null}
                {runs.map((row, runIndex) => (
                  <th
                    aria-colindex={runIndex + runColumnOffset}
                    className="runMatrixRunHeader"
                    key={row.eval_run.id}
                    scope="col"
                  >
                    <strong>{row.variant.label} v{row.variant_version.version_number}</strong>
                    <span>{row.eval_set.name} v{row.eval_set_version.version_number}</span>
                    {showScore ? <small>{percent(passRate(row.eval_run))}</small> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedRows.map((group) => (
                <Fragment key={group.label ?? "all"}>
                  {group.label ? (
                    <tr aria-rowindex={bodyRowIndex++} className="runMatrixGroupRow">
                      <th colSpan={tableColCount} scope="rowgroup">{group.label} · {group.rows.length} case</th>
                    </tr>
                  ) : null}
                  {group.rows.map(({ impact, row }) => {
                    const rowIndex = bodyRowIndex++;
                    return (
                      <tr aria-rowindex={rowIndex} key={row.case.id}>
                        <th aria-colindex={1} className="runMatrixCaseTitle" scope="row">
                          <strong>{row.case.title}</strong>
                          <span>{row.versions.map((version) => `v${version.version_number}`).join(", ")}</span>
                        </th>
                        {showImpact ? (
                          <td
                            aria-colindex={2}
                            aria-label={`${row.case.title} 的对照候选影响：${impactCopy[impact]}`}
                            className="runMatrixImpactCell"
                          >
                            <span className={impactClass[impact]}>{impactCopy[impact]}</span>
                          </td>
                        ) : null}
                        {runs.map((run, runIndex) => {
                          const cell = cells.get(`${run.eval_run.id}:${row.case.id}`);
                          return (
                            <td
                              aria-colindex={runIndex + runColumnOffset}
                              aria-label={resultLabel(row.case.title, run, cell?.passed ?? null)}
                              key={run.eval_run.id}
                            >
                              {cell ? (
                                <span className={cell.passed ? "runMatrixCellPass" : "runMatrixCellFail"}>
                                  {cell.passed ? "通过" : "不通过"}
                                </span>
                              ) : (
                                <span className="runMatrixCellMissing">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function caseImpact(
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

function runLabel(row: EvalRunMatrix["runs"][number]) {
  return `${row.variant.label} v${row.variant_version.version_number} / ${row.eval_set.name} v${row.eval_set_version.version_number}`;
}

function resultLabel(caseTitle: string, run: EvalRunMatrix["runs"][number], passed: boolean | null) {
  const result = passed === null ? "未覆盖" : passed ? "通过" : "不通过";
  return `${caseTitle} 在 ${runLabel(run)} 的结果：${result}`;
}
