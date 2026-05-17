"use client";

import type { FormEvent } from "react";

import { ValidatedForm } from "@/components/forms/form-validation";
import { CheckboxField, FileField, SelectField, TextAreaField } from "@/components/forms/workbench-field";
import type { VariantDetail } from "@/lib/types";

type WorkspaceVersionComposerProps = {
  busy: boolean;
  defaultVariantId?: string | null;
  onCreateVersion: (event: FormEvent<HTMLFormElement>) => void;
  variants: VariantDetail[];
};

const workspaceVersionFolderInputProps = {
  directory: "",
  multiple: true,
  name: "version_folder_files",
  type: "file",
  webkitdirectory: "",
} as const;

export function WorkspaceVersionComposer({
  busy,
  defaultVariantId,
  onCreateVersion,
  variants,
}: WorkspaceVersionComposerProps) {
  const defaultValue = defaultVariantId ?? variants[0]?.id ?? "";

  return (
    <section className="workspaceVersionComposer">
      <div className="workspaceVersionComposerCopy">
        <span>Candidate pipeline</span>
        <strong>追加候选版本</strong>
        <p>上传标准 Skill bundle，先生成不可变候选版本，再进入 exact 测评。</p>
      </div>
      <ValidatedForm className="workspaceVersionComposerGrid" onValidSubmit={onCreateVersion}>
        <SelectField defaultValue={defaultValue} label="Variant" name="variant_id" required>
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>
              {variant.label}
            </option>
          ))}
        </SelectField>
        <FileField className="workspaceVersionDrop" label="Skill 文件夹" {...workspaceVersionFolderInputProps} />
        <FileField
          accept=".zip,application/zip"
          className="workspaceVersionDrop"
          label="或 zip"
          name="version_zip_file"
          type="file"
        />
        <TextAreaField
          characterLimit={1000}
          className="workspaceVersionSummary"
          label="Change summary"
          name="change_summary"
          placeholder="这次更新解决了什么"
          required
        />
        <CheckboxField className="workspaceVersionCurrentToggle" label="直接设为 current" name="make_current" />
        <button disabled={busy || variants.length === 0} type="submit">
          追加候选版本
        </button>
      </ValidatedForm>
    </section>
  );
}
