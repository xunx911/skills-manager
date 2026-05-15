"use client";

import { FormEvent, useMemo, useState } from "react";

import { Badge } from "@/components/chrome";
import { ValidatedForm } from "@/components/forms/form-validation";
import { TextAreaField } from "@/components/forms/workbench-field";
import { percent, shortId } from "@/lib/format";
import type { PromotionReview } from "@/lib/types";
import { PromotionCaseComparisonList } from "./promotion-case-comparison-list";
import { PromotionDiffViewer } from "./promotion-diff-viewer";
import { PromotionReadinessCard } from "./promotion-readiness-card";

export function PromotionReviewPane({
  busy,
  loading,
  onBack,
  onOpenEvals,
  onPromote,
  review,
}: {
  busy: boolean;
  loading: boolean;
  onBack: () => void;
  onOpenEvals: () => void;
  onPromote: (decisionNote: string) => void | Promise<void>;
  review: PromotionReview | null;
}) {
  const [decisionNote, setDecisionNote] = useState("");
  const candidateScore = useMemo(() => runScore(review?.candidate_run ?? null), [review?.candidate_run]);
  const currentScore = useMemo(() => runScore(review?.current_run ?? null), [review?.current_run]);

  if (loading) {
    return (
      <div className="linearPane promotionPane">
        <div className="promotionLoading">
          <strong>正在生成设为当前版本评审...</strong>
          <span>加载 exact eval binding、case impact 和 bundle diff。</span>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="linearPane promotionPane">
        <div className="promotionLoading">
          <strong>还没有选择候选版本</strong>
          <span>回到变体页，选择一个非 current 版本进入评审。</span>
          <button onClick={onBack} type="button">返回变体</button>
        </div>
      </div>
    );
  }

  const canPromote =
    !busy &&
    Boolean(review.candidate_run) &&
    (review.readiness.status === "ready" || review.readiness.status === "risky");
  const promoteLabel = review.readiness.status === "risky" ? "接受风险并设为当前版本" : "设为当前版本";

  function submitPromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canPromote) return;
    return onPromote(decisionNote.trim());
  }

  return (
    <div className="linearPane promotionPane">
      <div className="promotionHero">
        <div>
          <span>Promotion review</span>
          <h2>设为当前版本评审</h2>
          <p>
            {review.variant.label} · v{review.current_version?.version_number ?? "-"} {"->"} v{review.candidate_version.version_number}
          </p>
        </div>
        <div className="promotionHeroActions">
          <button onClick={onBack} type="button">返回变体</button>
          <button onClick={onOpenEvals} type="button">去测评</button>
        </div>
      </div>

      <div className="promotionTopGrid">
        <PromotionReadinessCard readiness={review.readiness} />
        <section className="promotionBindingCard">
          <div className="promotionPanelHead">
            <div>
              <span>Exact binding</span>
              <strong>{review.eval_set.name} v{review.eval_set_version.version_number}</strong>
            </div>
            <Badge>{review.eval_set.lifecycle_status}</Badge>
          </div>
          <div className="promotionScoreGrid">
            <ScoreBox label="Current" runId={review.current_run?.id} score={currentScore} />
            <ScoreBox label="Candidate" runId={review.candidate_run?.id} score={candidateScore} />
          </div>
          <div className="promotionBindingList">
            <span>From <b>{review.current_version ? `v${review.current_version.version_number}` : "-"}</b></span>
            <span>To <b>v{review.candidate_version.version_number}</b></span>
            <span>EvalSetVersion <b>{shortId(review.eval_set_version.id)}</b></span>
          </div>
        </section>
      </div>

      <div className="promotionMainGrid">
        <PromotionCaseComparisonList cases={review.case_comparisons} summary={review.comparison_summary} />
        <PromotionDiffViewer diff={review.bundle_diff} />
      </div>

      <ValidatedForm className="promotionDecisionBar" onValidSubmit={submitPromotion}>
        <div>
          <span>Decision</span>
          <strong>{review.readiness.label}</strong>
          <small>{decisionHint(review)}</small>
        </div>
        <TextAreaField
          aria-label="设为当前版本说明"
          data-required-message="填写设为当前版本说明。"
          label="设为当前版本说明"
          name="decision_note"
          onChange={(event) => setDecisionNote(event.currentTarget.value)}
          placeholder={review.readiness.requires_note ? "说明为什么接受这次风险或仍失败项" : "可选：记录这次上架的判断依据"}
          required={review.readiness.requires_note}
          value={decisionNote}
        />
        <button className="primaryAction" disabled={!canPromote} type="submit">
          {promoteLabel}
        </button>
      </ValidatedForm>
    </div>
  );
}

function ScoreBox({ label, runId, score }: { label: string; runId?: string; score: number | null }) {
  return (
    <div className="promotionScoreBox">
      <span>{label}</span>
      <strong>{runId ? percent(score) : "未测"}</strong>
      <small>{runId ? shortId(runId) : "没有 finished run"}</small>
    </div>
  );
}

function runScore(run: PromotionReview["candidate_run"]): number | null {
  const passed = run?.summary.passed;
  const total = run?.summary.total;
  if (passed === undefined || !total) return null;
  return Math.round((passed / total) * 100);
}

function decisionHint(review: PromotionReview) {
  if (review.readiness.status === "unverified") return "候选版本必须先在当前 EvalSetVersion 上完成测评。";
  if (review.readiness.status === "blocked") return review.readiness.reason;
  if (review.readiness.requires_note) return "需要填写说明后才能 promote。";
  return "证据完整，可以把 candidate 设为 current。";
}
