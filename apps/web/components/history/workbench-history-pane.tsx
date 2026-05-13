"use client";

import Link from "next/link";

import { Badge } from "@/components/chrome";
import type { InspectorActionMode } from "@/components/inspector/workbench-inspector";
import { RunComparisonPanel } from "@/components/run-comparison/run-comparison-panel";
import { RunMatrixPanel, type RunMatrixControls } from "@/components/run-matrix/run-matrix-panel";
import { SavedRunViews } from "@/components/saved-views/saved-run-views";
import { Metric } from "@/components/workbench-metric";
import { passRate } from "@/lib/api";
import { percent } from "@/lib/format";
import type {
  EvalRunComparison,
  EvalRunDetail,
  EvalRunHistory,
  EvalRunMatrix,
  EvalRunRecord,
  SavedView,
  SkillDetail,
  VariantDetail,
} from "@/lib/types";

export type HistoryRunFilters = {
  variant_version_id: string;
  eval_set_version_id: string;
  strategy: string;
  status: string;
};

type WorkbenchHistoryPaneProps = {
  busy: boolean;
  compareBaselineRunId: string | null;
  compareCandidateRunId: string | null;
  evalSets: SkillDetail["eval_sets"];
  filters: HistoryRunFilters;
  loading: boolean;
  onAcceptComparison: (note: string) => void;
  onAction: (mode: InspectorActionMode) => void;
  onApplySavedView: (view: SavedView | null) => void;
  onChooseComparisonRun: (role: "baseline" | "candidate", runId: string) => void;
  onDeleteSavedView: () => void;
  onFilterChange: (key: keyof HistoryRunFilters, value: string) => void;
  onMatrixControlChange: <Key extends keyof RunMatrixControls>(key: Key, value: RunMatrixControls[Key]) => void;
  onSaveView: () => void;
  onSavedViewNameChange: (name: string) => void;
  onSelectRun: (runId: string) => void;
  runComparison: EvalRunComparison | null;
  runComparisonLoading: boolean;
  runDetail: EvalRunDetail | null;
  runHistory: EvalRunHistory | null;
  runMatrix: EvalRunMatrix | null;
  runMatrixControls: RunMatrixControls;
  runMatrixLoading: boolean;
  savedViewName: string;
  savedViews: SavedView[];
  savedViewsLoading: boolean;
  selectedSavedViewId: string;
  selectedRunId: string | null;
  variants: VariantDetail[];
};

export function WorkbenchHistoryPane({
  busy,
  compareBaselineRunId,
  compareCandidateRunId,
  evalSets,
  filters,
  loading,
  onAcceptComparison,
  onAction,
  onApplySavedView,
  onChooseComparisonRun,
  onDeleteSavedView,
  onFilterChange,
  onMatrixControlChange,
  onSaveView,
  onSavedViewNameChange,
  onSelectRun,
  runComparison,
  runComparisonLoading,
  runDetail,
  runHistory,
  runMatrix,
  runMatrixControls,
  runMatrixLoading,
  savedViewName,
  savedViews,
  savedViewsLoading,
  selectedSavedViewId,
  selectedRunId,
  variants,
}: WorkbenchHistoryPaneProps) {
  const rows = runHistory?.runs ?? [];
  const selectedRow = rows.find((row) => row.eval_run.id === selectedRunId) ?? rows[0] ?? null;
  const variantVersions = variants.flatMap((variant) =>
    variant.versions.map((version) => ({
      id: version.id,
      label: `${variant.label} v${version.version_number}`,
    })),
  );
  const evalSetVersions = evalSets.flatMap((evalSet) =>
    evalSet.versions.map((version) => ({
      id: version.id,
      label: `${evalSet.name} v${version.version_number}`,
    })),
  );

  return (
    <div className="linearPane historyPane">
      <div className="linearToolbar">
        <div>
          <h2>历史记录</h2>
          <p>{loading ? "正在加载 runs..." : `${rows.length} runs · exact VariantVersion + EvalSetVersion bindings`}</p>
        </div>
        <div className="historyToolbarStack">
          <SavedRunViews
            busy={busy}
            loading={savedViewsLoading}
            name={savedViewName}
            onApply={onApplySavedView}
            onDelete={onDeleteSavedView}
            onNameChange={onSavedViewNameChange}
            onSave={onSaveView}
            selectedViewId={selectedSavedViewId}
            views={savedViews}
          />
          <div className="historyFilters">
            <label>
              <span>Variant</span>
              <select
                aria-label="Variant version filter"
                onChange={(event) => onFilterChange("variant_version_id", event.currentTarget.value)}
                value={filters.variant_version_id}
              >
                <option value="all">All versions</option>
                {variantVersions.map((version) => (
                  <option key={version.id} value={version.id}>{version.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Eval set</span>
              <select
                aria-label="Eval set version filter"
                onChange={(event) => onFilterChange("eval_set_version_id", event.currentTarget.value)}
                value={filters.eval_set_version_id}
              >
                <option value="all">All snapshots</option>
                {evalSetVersions.map((version) => (
                  <option key={version.id} value={version.id}>{version.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Strategy</span>
              <select
                aria-label="Strategy filter"
                onChange={(event) => onFilterChange("strategy", event.currentTarget.value)}
                value={filters.strategy}
              >
                <option value="all">All strategies</option>
                <option value="manual_pass_fail">manual_pass_fail</option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select
                aria-label="Status filter"
                onChange={(event) => onFilterChange("status", event.currentTarget.value)}
                value={filters.status}
              >
                <option value="all">All statuses</option>
                <option value="finished">finished</option>
                <option value="failed">failed</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <RunMatrixPanel
        baselineRunId={compareBaselineRunId}
        candidateRunId={compareCandidateRunId}
        controls={runMatrixControls}
        loading={runMatrixLoading}
        matrix={runMatrix}
        onControlChange={onMatrixControlChange}
      />

      <div className="historyGrid">
        <section className="historyRunList" aria-label="Eval run history">
          {rows.map((row) => {
            const isSelected = row.eval_run.id === selectedRunId;
            const isBaseline = row.eval_run.id === compareBaselineRunId;
            const isCandidate = row.eval_run.id === compareCandidateRunId;
            return (
              <article
                className={`historyRunRow ${isSelected ? "historyRunRowActive" : ""} ${row.accepted_verification ? "historyRunAccepted" : ""}`}
                key={row.eval_run.id}
              >
                <button className="historyRunMain" onClick={() => onSelectRun(row.eval_run.id)} type="button">
                  <span>
                    <strong>{runFraction(row.eval_run)}</strong>
                    <small>{percent(passRate(row.eval_run))}</small>
                  </span>
                  <span>
                    <b>{row.variant.label} v{row.variant_version.version_number}</b>
                    <small>{row.eval_set.name} v{row.eval_set_version.version_number}</small>
                  </span>
                  <span>
                    <b>{row.eval_run.strategy}</b>
                    <small>{row.eval_run.status} · {formatRunDate(row.eval_run.created_at)}</small>
                  </span>
                </button>
                <div className="historyRunCompareActions">
                  {row.accepted_verification ? <Badge tone="good">Accepted</Badge> : null}
                  <button className={isBaseline ? "historyCompareActive" : ""} onClick={() => onChooseComparisonRun("baseline", row.eval_run.id)} type="button">
                    对照
                  </button>
                  <button className={isCandidate ? "historyCompareActive" : ""} onClick={() => onChooseComparisonRun("candidate", row.eval_run.id)} type="button">
                    候选
                  </button>
                </div>
              </article>
            );
          })}
          {!loading && rows.length === 0 ? (
            <div className="historyEmpty">
              <strong>还没有测评历史</strong>
              <span>先在“测评”里记录一次 run，历史页会按 exact version binding 展示。</span>
              <button onClick={() => onAction("run")} type="button">去记录测评</button>
            </div>
          ) : null}
        </section>

        <section className="historyRunDetail">
          <RunComparisonPanel
            busy={busy}
            comparison={runComparison}
            loading={runComparisonLoading}
            onAccept={onAcceptComparison}
          />
          {selectedRow ? (
            <>
              <div className="historyDetailHead">
                <div>
                  <span>Selected run</span>
                  <strong>{runFraction(selectedRow.eval_run)} · {percent(passRate(selectedRow.eval_run))}</strong>
                </div>
                <Link href={`/eval-runs/${selectedRow.eval_run.id}`}>打开详情</Link>
              </div>
              <div className="historyBindingGrid">
                <Metric label="VariantVersion" value={`v${selectedRow.variant_version.version_number}`} />
                <Metric label="EvalSetVersion" value={`v${selectedRow.eval_set_version.version_number}`} />
                <Metric label="Strategy" value={selectedRow.eval_run.strategy} />
                <Metric label="Status" value={selectedRow.eval_run.status} />
              </div>
              <div className="historyCaseResults">
                <div className="evalCaseRailHead">
                  <strong>Case results</strong>
                  <span>{runDetail?.case_results.length ?? 0} cases</span>
                </div>
                {runDetail?.case_results.map((item) => (
                  <article className="historyCaseResult" key={item.result.case_version_id}>
                    <div>
                      <span>case v{item.case_version.version_number}</span>
                      <strong>{item.case.title}</strong>
                    </div>
                    <Badge tone={item.result.passed ? "good" : "bad"}>{item.result.passed ? "通过" : "不通过"}</Badge>
                  </article>
                ))}
                {!runDetail ? <div className="linearEmpty">正在加载 run 详情...</div> : null}
              </div>
            </>
          ) : (
            <div className="evalCaseDetailEmpty">
              <strong>等待历史记录</strong>
              <span>记录测评后，这里会显示逐 case 结果。</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function runFraction(run: EvalRunRecord) {
  return `${run.summary.passed ?? 0}/${run.summary.total ?? 0}`;
}

function formatRunDate(value?: string) {
  if (!value) return "unknown time";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
