"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type VariantCreationComposerProps = {
  busy: boolean;
  hasBaseVersion: boolean;
  onCreateVariant: (event: FormEvent<HTMLFormElement>) => void;
};

export function VariantCreationComposer({
  busy,
  hasBaseVersion,
  onCreateVariant,
}: VariantCreationComposerProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className={`variantCreationComposer ${expanded ? "variantCreationComposerExpanded" : ""}`}>
      <div className="variantCreationComposerCopy">
        <span>Constraint set</span>
        <strong>新建约束 variant</strong>
        <p>用 tags 表达使用约束，默认从当前版本复制基线，再按这个约束继续演进。</p>
      </div>
      {expanded ? (
        <form className="variantCreationComposerGrid" onSubmit={onCreateVariant}>
          <label>
            <span>Label</span>
            <input name="label" placeholder="Codex + stricter auth" required />
          </label>
          <label>
            <span>Tags</span>
            <input name="tags" placeholder="codex, strict-auth" required />
          </label>
          <label className="variantCreationFull">
            <span>Summary</span>
            <textarea name="summary" placeholder="这个约束组合下的最优解说明" required />
          </label>
          <label className="variantCreationFull">
            <span>Change summary</span>
            <textarea name="change_summary" placeholder="为什么要创建这个 variant" required />
          </label>
          <label className="variantCreationToggle">
            <input defaultChecked disabled={!hasBaseVersion} name="copy_current" type="checkbox" />
            <span>{hasBaseVersion ? "从当前版本复制基线" : "暂无当前版本可复制"}</span>
          </label>
          <label className="variantCreationToggle">
            <input name="make_default" type="checkbox" />
            <span>设为 default</span>
          </label>
          <button disabled={busy} type="submit">
            创建约束 variant
          </button>
        </form>
      ) : (
        <button className="variantCreationComposerOpen" disabled={busy} onClick={() => setExpanded(true)} type="button">
          新建约束 variant
        </button>
      )}
    </section>
  );
}
