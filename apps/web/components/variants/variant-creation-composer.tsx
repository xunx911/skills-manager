"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { ValidatedForm } from "@/components/forms/form-validation";
import { CheckboxField, TextAreaField, TextField } from "@/components/forms/workbench-field";

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
        <ValidatedForm className="variantCreationComposerGrid" onValidSubmit={onCreateVariant}>
          <TextField label="Label" name="label" placeholder="Codex + stricter auth" required />
          <TextField label="Tags" name="tags" placeholder="codex, strict-auth" required />
          <TextAreaField
            characterLimit={1000}
            className="variantCreationFull"
            label="Summary"
            name="summary"
            placeholder="这个约束组合下的最优解说明"
            required
          />
          <TextAreaField
            characterLimit={1000}
            className="variantCreationFull"
            label="Change summary"
            name="change_summary"
            placeholder="为什么要创建这个 variant"
            required
          />
          <CheckboxField
            className="variantCreationToggle"
            defaultChecked
            disabled={!hasBaseVersion}
            label={hasBaseVersion ? "从当前版本复制基线" : "暂无当前版本可复制"}
            name="copy_current"
          />
          <CheckboxField className="variantCreationToggle" label="设为 default" name="make_default" />
          <button disabled={busy} type="submit">
            创建约束 variant
          </button>
        </ValidatedForm>
      ) : (
        <button className="variantCreationComposerOpen" disabled={busy} onClick={() => setExpanded(true)} type="button">
          新建约束 variant
        </button>
      )}
    </section>
  );
}
