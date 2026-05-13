"use client";

import Link from "next/link";
import { FormEvent } from "react";

import { Badge } from "@/components/chrome";
import { VariantCreationComposer } from "@/components/variants/variant-creation-composer";
import { WorkspaceVersionComposer } from "@/components/variants/workspace-version-composer";
import type { VariantDetail, VariantVersion } from "@/lib/types";

type VariantActionMode = "new-variant" | "new-version";

type WorkbenchVariantsPaneProps = {
  busy: boolean;
  defaultVariant: VariantDetail | null;
  onAction: (mode: VariantActionMode) => void;
  onCreateVariant: (event: FormEvent<HTMLFormElement>) => void;
  onCreateVersion: (event: FormEvent<HTMLFormElement>) => void;
  onDiff: () => void;
  onPromotionReview: (variantId: string, candidateVersionId: string) => void;
  variants: VariantDetail[];
};

export function WorkbenchVariantsPane({
  busy,
  defaultVariant,
  onAction,
  onCreateVariant,
  onCreateVersion,
  onDiff,
  onPromotionReview,
  variants,
}: WorkbenchVariantsPaneProps) {
  const historyCount = variants.reduce((total, variant) => total + variant.versions.length, 0);

  return (
    <div className="linearPane">
      <div className="linearToolbar">
        <div>
          <h2>变体空间</h2>
          <p>{variants.length} 个当前变体 · {historyCount} 个历史版本 · 默认分发保持清晰可见。</p>
        </div>
        <div>
          <button onClick={() => onAction("new-variant")} type="button">添加 variant</button>
          <button onClick={() => onAction("new-version")} type="button">追加版本</button>
          <button disabled={!defaultVariant || defaultVariant.versions.length < 2} onClick={onDiff} type="button">比较版本</button>
        </div>
      </div>
      <VariantCreationComposer
        busy={busy}
        hasBaseVersion={Boolean(defaultVariant?.current_version)}
        onCreateVariant={onCreateVariant}
      />
      <WorkspaceVersionComposer
        busy={busy}
        defaultVariantId={defaultVariant?.id}
        onCreateVersion={onCreateVersion}
        variants={variants}
      />
      <div className="variantMapCanvas">
        {variants.map((variant) => (
          <article className={`variantMapCard ${variant.id === defaultVariant?.id ? "variantMapCardDefault" : ""}`} key={variant.id}>
            <Link href={`/variants/${variant.id}`}>
              <span>{variant.id === defaultVariant?.id ? "Default variant" : "Variant"}</span>
              <strong>{variant.label}</strong>
              <p>{variant.summary}</p>
            </Link>
            <div className="tagLine">
              {variant.tags.map((tag) => <Badge key={tag} tone="blue">{tag}</Badge>)}
            </div>
            <div className="variantMapMeta">
              <small>{variant.current_version ? `current v${variant.current_version.version_number}` : "no current version"}</small>
              <small>{variant.versions.length} versions</small>
            </div>
            <div className="variantVersionList" aria-label={`${variant.label} versions`}>
              {sortedVersions(variant.versions).map((version) => {
                const isCurrent = version.id === variant.current_version?.id;
                return (
                  <div className="variantVersionRow" key={version.id}>
                    <span>
                      <b>v{version.version_number}</b>
                      <small>{version.change_summary}</small>
                    </span>
                    {isCurrent ? (
                      <Badge tone="good">Current</Badge>
                    ) : (
                      <button onClick={() => onPromotionReview(variant.id, version.id)} type="button">
                        设为当前版本评审
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function sortedVersions(versions: VariantVersion[]) {
  return [...versions].sort((left, right) => left.version_number - right.version_number);
}
