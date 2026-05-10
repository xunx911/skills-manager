"use client";

import { percent } from "@/lib/format";

export type EvalReviewFilter = "all" | "pending" | "passed" | "failed";

type EvalReviewControlsProps = {
  busy: boolean;
  canRecord: boolean;
  confirmedCount: number;
  failedCount: number;
  filter: EvalReviewFilter;
  passedCount: number;
  pendingCount: number;
  totalCount: number;
  onClearDraft: () => void;
  onFilterChange: (filter: EvalReviewFilter) => void;
  onJumpPending: () => void;
  onMarkPendingPassed: () => void;
  onRecord: () => void;
};

const FILTERS: Array<{ id: EvalReviewFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "pending", label: "未确认" },
  { id: "passed", label: "通过" },
  { id: "failed", label: "不通过" },
];

export function EvalReviewControls({
  busy,
  canRecord,
  confirmedCount,
  failedCount,
  filter,
  passedCount,
  pendingCount,
  totalCount,
  onClearDraft,
  onFilterChange,
  onJumpPending,
  onMarkPendingPassed,
  onRecord,
}: EvalReviewControlsProps) {
  const coverage = totalCount === 0 ? 0 : Math.round((confirmedCount / totalCount) * 100);
  const counts: Record<EvalReviewFilter, number> = {
    all: totalCount,
    pending: pendingCount,
    passed: passedCount,
    failed: failedCount,
  };

  return (
    <section className="evalRunBar evalQueueControls" data-testid="eval-run-bar">
      <div className="evalProgress">
        <strong>{percent(coverage)}</strong>
        <span>confirmation coverage</span>
        <i style={{ width: `${coverage}%` }} />
      </div>

      <div className="evalFilterTabs" aria-label="测评 case 筛选">
        {FILTERS.map((item) => (
          <button
            aria-pressed={filter === item.id}
            className={filter === item.id ? "evalFilterActive" : ""}
            key={item.id}
            onClick={() => onFilterChange(item.id)}
            type="button"
          >
            <span>{item.label}</span>
            <strong>{counts[item.id]}</strong>
          </button>
        ))}
      </div>

      <div className="evalQueueActions">
        <button disabled={pendingCount === 0} onClick={onJumpPending} type="button">下一条未确认</button>
        <button disabled={busy || pendingCount === 0} onClick={onMarkPendingPassed} type="button">未确认标为通过</button>
        <button disabled={busy || confirmedCount === 0} onClick={onClearDraft} type="button">清空草稿</button>
        <button className="primaryAction" disabled={busy || !canRecord} onClick={onRecord} type="button">
          记录本次测评
        </button>
      </div>
    </section>
  );
}
