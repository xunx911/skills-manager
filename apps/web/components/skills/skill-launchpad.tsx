"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { FileField, TextAreaField, TextField } from "@/components/forms/workbench-field";

type ImportPreview = {
  tone: "good" | "bad" | "neutral";
  title: string;
  detail: string;
} | null;

type SkillLaunchpadProps = {
  busy: boolean;
  importPreview: ImportPreview;
  onCreateSkill: (event: FormEvent<HTMLFormElement>) => void;
  onImportSkill: (event: FormEvent<HTMLFormElement>) => void;
  onRefreshImportPreview: (event: FormEvent<HTMLFormElement>) => void;
};

const launchpadFolderInputProps = {
  directory: "",
  multiple: true,
  name: "folder_files",
  type: "file",
  webkitdirectory: "",
} as const;

export function SkillLaunchpad({
  busy,
  importPreview,
  onCreateSkill,
  onImportSkill,
  onRefreshImportPreview,
}: SkillLaunchpadProps) {
  const [mode, setMode] = useState<"import" | "create">("import");

  return (
    <section className="skillLaunchpad">
      <div className="skillLaunchpadIntro">
        <span>首次接入</span>
        <h2>把第一个 Skill 接进来</h2>
        <p>导入标准 Skill bundle 是最可信的起点；也可以先创建草稿 skill，再补 bundle、case 和测评证据。</p>
        <div className="skillLaunchpadSegments" aria-label="Skill 接入方式">
          <button className={mode === "import" ? "skillLaunchpadSegmentActive" : ""} onClick={() => setMode("import")} type="button">
            导入 bundle
          </button>
          <button className={mode === "create" ? "skillLaunchpadSegmentActive" : ""} onClick={() => setMode("create")} type="button">
            新建 skill
          </button>
        </div>
      </div>

      {mode === "import" ? (
        <form className="skillLaunchpadForm" onChange={onRefreshImportPreview} onSubmit={onImportSkill}>
          <TextField label="归属" name="owner_ref" placeholder="skillhub-lab" required />
          <TextField label="约束标签" name="tags" placeholder="codex, gpt5.4" required />
          <TextField defaultValue="Imported" label="变体名称" name="variant_label" placeholder="Imported" />
          <FileField className="skillLaunchpadDrop" label="Skill 文件夹" {...launchpadFolderInputProps} />
          <FileField accept=".zip,application/zip" className="skillLaunchpadDrop" label="或 zip" name="zip_file" type="file" />
          {importPreview ? (
            <div className={`importPreview importPreview-${importPreview.tone}`}>
              <strong>{importPreview.title}</strong>
              <span>{importPreview.detail}</span>
            </div>
          ) : null}
          <button disabled={busy || importPreview?.tone === "bad"} type="submit">
            导入并创建 skill
          </button>
        </form>
      ) : (
        <form className="skillLaunchpadForm" onSubmit={onCreateSkill}>
          <TextField label="Skill ID" name="slug" placeholder="security-reviewer" required />
          <TextField label="归属" name="owner_ref" placeholder="skillhub-lab" required />
          <TextField label="初始变体" name="variant_label" placeholder="Baseline" required />
          <TextField label="约束标签" name="tags" placeholder="codex, gpt5.4" required />
          <TextAreaField className="skillLaunchpadFull" label="简介" name="summary" placeholder="这个 skill 解决什么问题" required />
          <TextAreaField className="skillLaunchpadFull" label="初始版本说明" name="change_summary" placeholder="初始版本说明" required />
          <button disabled={busy} type="submit">
            创建 skill
          </button>
        </form>
      )}

      <div className="skillLaunchpadChecklist">
        <strong>证据闭环</strong>
        <span>1. 导入 bundle 或创建草稿 skill</span>
        <span>2. 补充可复用 eval cases</span>
        <span>3. 记录首轮 pass / fail run</span>
        <span>4. 接受一次 exact verification</span>
      </div>
    </section>
  );
}
