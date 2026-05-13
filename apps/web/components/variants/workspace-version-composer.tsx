"use client";

import type { FormEvent } from "react";

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
      <form className="workspaceVersionComposerGrid" onSubmit={onCreateVersion}>
        <label>
          <span>Variant</span>
          <select defaultValue={defaultValue} name="variant_id" required>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label}
              </option>
            ))}
          </select>
        </label>
        <label className="workspaceVersionDrop">
          <span>Skill 文件夹</span>
          <input {...workspaceVersionFolderInputProps} />
        </label>
        <label className="workspaceVersionDrop">
          <span>或 zip</span>
          <input accept=".zip,application/zip" name="version_zip_file" type="file" />
        </label>
        <label className="workspaceVersionSummary">
          <span>Change summary</span>
          <textarea name="change_summary" placeholder="这次更新解决了什么" required />
        </label>
        <label className="workspaceVersionCurrentToggle">
          <input name="make_current" type="checkbox" />
          <span>直接设为 current</span>
        </label>
        <button disabled={busy || variants.length === 0} type="submit">
          追加候选版本
        </button>
      </form>
    </section>
  );
}
