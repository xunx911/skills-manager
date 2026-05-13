"use client";

import Link from "next/link";
import { FormEvent, useLayoutEffect, useRef } from "react";

import { Badge } from "@/components/chrome";
import { FileField, SelectField, TextAreaField, TextField } from "@/components/forms/workbench-field";
import { LocalSessionPanel } from "@/components/session/local-session-panel";
import { percent, shortId } from "@/lib/format";
import type { EvalRunRecord, EvalSetVersionDetail, SkillDetail, VariantDetail } from "@/lib/types";

export type InspectorActionMode =
  | "skill"
  | "new-skill"
  | "import-skill"
  | "new-variant"
  | "new-version"
  | "new-case"
  | "edit-case"
  | "run";

export type InspectorImportPreview = {
  tone: "good" | "bad" | "neutral";
  title: string;
  detail: string;
} | null;

type WorkbenchInspectorProps = {
  actionMode: InspectorActionMode;
  actionFocusRequest: number;
  actor: string;
  busy: boolean;
  cases: EvalSetVersionDetail["cases"];
  confirmedDraft: number;
  createCase: (event: FormEvent<HTMLFormElement>) => void;
  createSkill: (event: FormEvent<HTMLFormElement>) => void;
  createVariant: (event: FormEvent<HTMLFormElement>) => void;
  createVariantVersion: (event: FormEvent<HTMLFormElement>) => void;
  currentEvalSetVersionId?: string;
  defaultVariant: VariantDetail | null;
  failedDraft: number;
  hasPersistedSkill: boolean;
  importPreview: InspectorImportPreview;
  importSkill: (event: FormEvent<HTMLFormElement>) => void;
  latestRun: EvalRunRecord | null;
  onAction: (mode: InspectorActionMode) => void;
  onSelectCase: (caseId: string) => void;
  passedDraft: number;
  recordEvalRun: () => void;
  refreshImportPreview: (event: FormEvent<HTMLFormElement>) => void;
  score: number | null;
  selectedCase: EvalSetVersionDetail["cases"][number] | null;
  selectedDetail: SkillDetail;
  switchActor: (event: FormEvent<HTMLFormElement>) => void;
  updateCase: (event: FormEvent<HTMLFormElement>) => void;
  updateSkill: (event: FormEvent<HTMLFormElement>) => void;
};

const actionItems: Array<{ mode: InspectorActionMode; label: string }> = [
  { mode: "skill", label: "Skill 设置" },
  { mode: "import-skill", label: "导入 bundle" },
  { mode: "new-skill", label: "新建 skill" },
  { mode: "new-variant", label: "新建 variant" },
  { mode: "new-version", label: "追加版本" },
  { mode: "new-case", label: "新增 case" },
  { mode: "edit-case", label: "编辑 case" },
  { mode: "run", label: "记录测评" },
];

const folderInputProps = {
  directory: "",
  multiple: true,
  name: "folder_files",
  type: "file",
  webkitdirectory: "",
} as const;

const versionFolderInputProps = {
  directory: "",
  multiple: true,
  name: "version_folder_files",
  type: "file",
  webkitdirectory: "",
} as const;

export function WorkbenchInspector({
  actionMode,
  actionFocusRequest,
  actor,
  busy,
  cases,
  confirmedDraft,
  createCase,
  createSkill,
  createVariant,
  createVariantVersion,
  currentEvalSetVersionId,
  defaultVariant,
  latestRun,
  onAction,
  onSelectCase,
  importPreview,
  failedDraft,
  hasPersistedSkill,
  importSkill,
  passedDraft,
  recordEvalRun,
  refreshImportPreview,
  score,
  selectedCase,
  selectedDetail,
  switchActor,
  updateCase,
  updateSkill,
}: WorkbenchInspectorProps) {
  const stackRef = useRef<HTMLDivElement>(null);
  const lastFocusRequestRef = useRef(0);

  useLayoutEffect(() => {
    if (!actionFocusRequest || lastFocusRequestRef.current === actionFocusRequest) return;
    lastFocusRequestRef.current = actionFocusRequest;
    const panel = stackRef.current?.querySelector<HTMLElement>(".inspectorForm");
    const target = panel?.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href]',
    );
    if (!target) return;
    target.focus();
  }, [actionFocusRequest, actionMode]);

  return (
    <div className="inspectorStack" ref={stackRef}>
      <section className="inspectorCard inspectorEvidence">
        <div className="inspectorTitle">
          <span>Verification</span>
          <Badge tone={latestRun ? (score === 100 ? "good" : "bad") : "neutral"}>{latestRun ? "已验证" : "未验证"}</Badge>
        </div>
        <strong>{latestRun ? percent(score) : "未测评"}</strong>
        <small>{latestRun ? `${latestRun.summary.passed ?? 0}/${latestRun.summary.total ?? 0} 通过` : "暂无 accepted run"}</small>
        <div className="bindingList">
          <span>VariantVersion <b>{shortId(defaultVariant?.current_version?.id)}</b></span>
          <span>EvalSetVersion <b>{shortId(currentEvalSetVersionId)}</b></span>
        </div>
      </section>

      <LocalSessionPanel actor={actor} busy={busy} onSwitchActor={switchActor} />

      <div className="actionMenu">
        {actionItems.map(({ mode, label }) => (
          <button
            className={actionMode === mode ? "actionMenuActive" : ""}
            disabled={!hasPersistedSkill && mode !== "new-skill" && mode !== "import-skill"}
            key={mode}
            onClick={() => onAction(mode)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {actionMode === "skill" ? (
        <form className="inspectorForm" key={selectedDetail.skill.id} onSubmit={updateSkill}>
          <h3>编辑 skill</h3>
          <TextField label="Skill ID" name="slug" defaultValue={selectedDetail.skill.slug} required />
          <TextField label="归属" name="owner_ref" defaultValue={selectedDetail.skill.owner_ref} required />
          <button disabled={busy} type="submit">保存</button>
        </form>
      ) : null}

      {actionMode === "new-skill" ? (
        <form className="inspectorForm" onSubmit={createSkill}>
          <h3>添加 skill</h3>
          <TextField label="Skill ID" name="slug" placeholder="security-reviewer" required />
          <TextField label="归属" name="owner_ref" placeholder="skillhub-lab" required />
          <TextField label="初始变体" name="variant_label" placeholder="Baseline" required />
          <TextField label="约束标签" name="tags" placeholder="codex, gpt5.4" required />
          <TextAreaField label="简介" name="summary" placeholder="这个 skill 解决什么问题" required />
          <TextAreaField label="初始版本说明" name="change_summary" placeholder="初始版本说明" required />
          <button disabled={busy} type="submit">创建</button>
        </form>
      ) : null}

      {actionMode === "import-skill" ? (
        <form className="inspectorForm" onChange={refreshImportPreview} onSubmit={importSkill}>
          <h3>导入标准 Skill</h3>
          <p className="inspectorHint">选择包含 SKILL.md 的文件夹，或上传 zip。SKILL.md frontmatter 的 name 会成为 skill slug。</p>
          <TextField label="归属" name="owner_ref" placeholder="skillhub-lab" required />
          <TextField label="约束标签" name="tags" placeholder="codex, gpt5.4" required />
          <TextField label="变体名称" name="variant_label" placeholder="Imported" defaultValue="Imported" />
          <FileField className="fileDrop" label="选择文件夹" {...folderInputProps} />
          <FileField accept=".zip,application/zip" className="fileDrop" label="或选择 zip" name="zip_file" type="file" />
          {importPreview ? (
            <div className={`importPreview importPreview-${importPreview.tone}`}>
              <strong>{importPreview.title}</strong>
              <span>{importPreview.detail}</span>
            </div>
          ) : null}
          <button disabled={busy || importPreview?.tone === "bad"} type="submit">导入并创建 skill</button>
        </form>
      ) : null}

      {actionMode === "new-variant" ? (
        <form className="inspectorForm" onSubmit={createVariant}>
          <h3>添加 variant</h3>
          <TextField label="变体名称" name="label" placeholder="Codex + long-context" required />
          <TextField label="约束标签" name="tags" placeholder="codex, long-context" required />
          <TextAreaField label="说明" name="summary" placeholder="这个约束下的最优解说明" required />
          <TextAreaField label="初始版本说明" name="change_summary" placeholder="初始版本说明" required />
          <label><input name="make_default" type="checkbox" /> 设为默认</label>
          <button disabled={busy} type="submit">创建 variant</button>
        </form>
      ) : null}

      {actionMode === "new-version" ? (
        <form className="inspectorForm" onSubmit={createVariantVersion}>
          <h3>追加版本</h3>
          <SelectField label="目标 variant" name="variant_id" required>
            {selectedDetail.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>{variant.label}</option>
            ))}
          </SelectField>
          <p className="inspectorHint">优先上传标准 Skill 文件夹或 zip；这会生成可 diff 的不可变 bundle artifact。</p>
          <FileField className="fileDrop" label="选择新版本文件夹" {...versionFolderInputProps} />
          <FileField accept=".zip,application/zip" className="fileDrop" label="或选择新版本 zip" name="version_zip_file" type="file" />
          <TextAreaField label="内容来源" name="content" placeholder="没有文件时，可填写 content_ref 摘要或 locator 来源" />
          <TextAreaField label="版本说明" name="change_summary" placeholder="这次更新的收益" required />
          <label><input name="make_current" type="checkbox" defaultChecked /> 设为 current</label>
          <button disabled={busy} type="submit">保存版本</button>
        </form>
      ) : null}

      {actionMode === "new-case" ? (
        <form className="inspectorForm" onSubmit={createCase}>
          <h3>添加测试用例</h3>
          <TextField label="标题" name="title" placeholder="PR: 缺少 owner 校验" required />
          <TextAreaField label="Input" name="input_text" placeholder="输入：代码 diff、上下文、用户请求..." required />
          <TextAreaField label="Expected output" name="expected_output" placeholder="期望输出：应该指出什么、避免什么..." required />
          <TextAreaField label="Notes" name="notes" placeholder="来源、bad case、维护说明" />
          <button disabled={busy} type="submit">加入评测集</button>
        </form>
      ) : null}

      {actionMode === "edit-case" ? (
        <form className="inspectorForm" key={selectedCase?.case.id ?? "empty-case"} onSubmit={updateCase}>
          <h3>编辑 case 为新版本</h3>
          <SelectField
            label="选择 case"
            name="case_id"
            onChange={(event) => onSelectCase(event.currentTarget.value)}
            required
            value={selectedCase?.case.id ?? ""}
          >
            {cases.length === 0 ? <option value="">暂无 case</option> : null}
            {cases.map((item) => (
              <option key={item.case.id} value={item.case.id}>{item.case.title}</option>
            ))}
          </SelectField>
          <TextField label="标题" name="title" defaultValue={selectedCase?.case.title ?? ""} placeholder="新标题" required />
          <TextAreaField label="Input" name="input_text" defaultValue={selectedCase?.case_version.input_artifact.content_text ?? ""} placeholder="新的 input" required />
          <TextAreaField label="Expected output" name="expected_output" defaultValue={selectedCase?.case_version.expected_output_artifact.content_text ?? ""} placeholder="新的 expected output" required />
          <TextAreaField label="Notes" name="notes" defaultValue={selectedCase?.case_version.notes ?? ""} placeholder="为什么更新" />
          <button disabled={busy || cases.length === 0} type="submit">保存 case version</button>
        </form>
      ) : null}

      {actionMode === "run" ? (
        <section className="inspectorForm">
          <h3>记录本次测评</h3>
          <div className="runSummary">
            <span>已确认 <b>{confirmedDraft}/{cases.length}</b></span>
            <span>通过 <b>{passedDraft}</b></span>
            <span>不通过 <b>{failedDraft}</b></span>
          </div>
          <button disabled={busy || cases.length === 0 || confirmedDraft !== cases.length} onClick={recordEvalRun} type="button">
            提交 eval run
          </button>
          {latestRun ? <Link href={`/eval-runs/${latestRun.id}`}>查看最近 run</Link> : null}
        </section>
      ) : null}
    </div>
  );
}
