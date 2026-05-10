"use client";

import type { VariantDetail, VariantVersion } from "@/lib/types";

export function CandidateVerificationBanner({
  variant,
  version,
  onPromotionReview,
}: {
  variant: VariantDetail;
  version: VariantVersion;
  onPromotionReview: (variantId: string, candidateVersionId: string) => void;
}) {
  return (
    <section className="candidateVerificationBanner">
      <div>
        <span>Candidate verification</span>
        <strong>{variant.label} v{version.version_number}</strong>
        <p>{version.change_summary}</p>
      </div>
      <button onClick={() => onPromotionReview(variant.id, version.id)} type="button">
        进入设为当前版本评审
      </button>
    </section>
  );
}
