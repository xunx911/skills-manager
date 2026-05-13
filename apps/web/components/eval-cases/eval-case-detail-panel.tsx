"use client";

import { FormEvent, useEffect, useState } from "react";

import { TextAreaField, TextField } from "@/components/forms/workbench-field";
import type { EvalCaseHistory, EvalSetVersionDetail } from "@/lib/types";
import { CaseHistoryPanel } from "./case-history-panel";

export type EvalCaseUpdateDraft = {
  caseId: string;
  title: string;
  inputText: string;
  expectedOutput: string;
  notes: string;
};

type EvalCaseDetailPanelProps = {
  busy: boolean;
  currentHistory: EvalCaseHistory | null;
  historyLoading: boolean;
  historyVisible: boolean;
  item: EvalSetVersionDetail["cases"][number] | null;
  onArchiveCase: (caseId: string) => void;
  onCloseHistory: () => void;
  onHistoryCase: (caseId: string) => void;
  onRestoreCaseVersion: (caseId: string, caseVersionId: string, versionNumber: number) => void;
  onUpdateCase: (draft: EvalCaseUpdateDraft) => Promise<boolean>;
};

export function EvalCaseDetailPanel({
  busy,
  currentHistory,
  historyLoading,
  historyVisible,
  item,
  onArchiveCase,
  onCloseHistory,
  onHistoryCase,
  onRestoreCaseVersion,
  onUpdateCase,
}: EvalCaseDetailPanelProps) {
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setEditing(false);
  }, [item?.case.id, item?.case_version.id]);

  if (!item) {
    return (
      <div className="evalCaseDetailEmpty">
        <strong>等待 case</strong>
        <span>添加测试用例后，这里会固定展示 input 和 expected output，左侧只负责快速确认通过/不通过。</span>
      </div>
    );
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    const form = new FormData(event.currentTarget);
    const saved = await onUpdateCase({
      caseId: item.case.id,
      title: textValue(form, "title"),
      inputText: textValue(form, "input_text"),
      expectedOutput: textValue(form, "expected_output"),
      notes: textValue(form, "notes"),
    });
    if (saved) setEditing(false);
  }

  if (historyVisible) {
    return (
      <div className="evalCaseDetailPanel">
        <div className="evalCaseDetailHead">
          <div>
            <span>Case history</span>
            <strong>{item.case.title}</strong>
          </div>
          <button onClick={onCloseHistory} type="button">查看当前</button>
        </div>
        <CaseHistoryPanel
          busy={busy}
          currentCaseVersionId={item.case_version.id}
          history={currentHistory}
          loading={historyLoading}
          onRestoreVersion={onRestoreCaseVersion}
        />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="evalCaseDetailPanel">
        <div className="evalCaseDetailHead">
          <div>
            <span>Editing case v{item.case_version.version_number}</span>
            <strong>{item.case.title}</strong>
          </div>
          <button onClick={() => setEditing(false)} type="button">取消</button>
        </div>
        <form className="evalCaseInlineForm" onSubmit={submitEdit}>
          <TextField aria-label="详情内标题" defaultValue={item.case.title} label="标题" name="title" required />
          <TextAreaField
            aria-label="详情内 input"
            defaultValue={item.case_version.input_artifact.content_text ?? ""}
            label="Input"
            name="input_text"
            required
          />
          <TextAreaField
            aria-label="详情内 expected output"
            defaultValue={item.case_version.expected_output_artifact.content_text ?? ""}
            label="Expected output"
            name="expected_output"
            required
          />
          <TextAreaField aria-label="详情内 notes" defaultValue={item.case_version.notes ?? ""} label="Notes" name="notes" />
          <button disabled={busy} type="submit">保存为新版本</button>
        </form>
      </div>
    );
  }

  return (
    <div className="evalCaseDetailPanel">
      <div className="evalCaseDetailHead">
        <div>
          <span>Selected case</span>
          <strong>{item.case.title}</strong>
        </div>
        <div className="evalCaseDetailActions">
          <button onClick={() => setEditing(true)} type="button">编辑</button>
          <button onClick={() => onHistoryCase(item.case.id)} type="button">历史</button>
          <button onClick={() => onArchiveCase(item.case.id)} type="button">归档</button>
        </div>
      </div>
      <div className="evalCaseMetaStrip">
        <span>case v{item.case_version.version_number}</span>
        <span>position {item.position + 1}</span>
        <span>{item.case_version.notes || "No notes"}</span>
      </div>
      <div className="caseIOGrid">
        <div>
          <span>Input</span>
          <pre>{item.case_version.input_artifact.content_text ?? item.case_version.input_artifact.digest}</pre>
        </div>
        <div>
          <span>Expected output</span>
          <pre>{item.case_version.expected_output_artifact.content_text ?? item.case_version.expected_output_artifact.digest}</pre>
        </div>
      </div>
    </div>
  );
}

function textValue(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}
