"use client";

import { FormEvent, useMemo, useState } from "react";

import {
  batchCaseErrorMessage,
  parseBatchCases,
  type BatchCaseRowError,
  type QuickEvalCaseDraft,
} from "@/components/eval-cases/quick-add-cases-parser";
import { ValidatedForm, type FormFieldError } from "@/components/forms/form-validation";
import { TextAreaField, TextField } from "@/components/forms/workbench-field";

export type { QuickEvalCaseDraft } from "@/components/eval-cases/quick-add-cases-parser";

export function QuickAddCases({
  busy,
  onCreateCases,
}: {
  busy: boolean;
  onCreateCases: (cases: QuickEvalCaseDraft[]) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [batchText, setBatchText] = useState("");
  const parsed = useMemo(() => parseBatchCases(batchText), [batchText]);

  async function submitSingle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const saved = await onCreateCases([
      {
        title: textValue(data, "quick_title"),
        input_text: textValue(data, "quick_input_text"),
        expected_output: textValue(data, "quick_expected_output"),
        notes: textValue(data, "quick_notes") || undefined,
      },
    ]);
    if (saved) form.reset();
  }

  async function submitBatch(event: FormEvent<HTMLFormElement>) {
    if (parsed.valid.length === 0) return;
    const saved = await onCreateCases(parsed.valid);
    if (saved) setBatchText("");
  }

  function validateBatch(form: HTMLFormElement): FormFieldError[] {
    if (parsed.invalidRows.length === 0) return [];
    const control = form.elements.namedItem("batch_cases");
    const fieldId = control instanceof HTMLTextAreaElement ? control.id : null;
    return [{ fieldId, fieldName: "batch_cases", message: batchCaseErrorMessage(parsed.invalidRows) }];
  }

  return (
    <section className="quickCaseComposer">
      <div className="quickCaseHeader">
        <div>
          <span>Fast case entry</span>
          <strong>快速扩充测评集</strong>
        </div>
        <div className="quickCaseModeSwitch" aria-label="快速添加模式">
          <button className={mode === "single" ? "quickCaseModeActive" : ""} onClick={() => setMode("single")} type="button">
            单条
          </button>
          <button className={mode === "batch" ? "quickCaseModeActive" : ""} onClick={() => setMode("batch")} type="button">
            批量
          </button>
        </div>
      </div>

      {mode === "single" ? (
        <ValidatedForm className="quickCaseGrid" onValidSubmit={submitSingle}>
          <TextField className="quickCaseTitleField" label="标题" name="quick_title" placeholder="PR: 缺少 tenant scope" required />
          <TextAreaField className="quickCaseInputField" label="Input" name="quick_input_text" placeholder="代码 diff、用户请求、上下文" required />
          <TextAreaField className="quickCaseExpectedField" label="Expected output" name="quick_expected_output" placeholder="应该指出什么" required />
          <TextField className="quickCaseNotesField" label="Notes" name="quick_notes" placeholder="来源或维护说明，可选" />
          <button disabled={busy} type="submit">快速加入</button>
        </ValidatedForm>
      ) : (
        <ValidatedForm className="quickCaseBatch" onValidSubmit={submitBatch} validate={validateBatch}>
          <TextAreaField
            aria-label="批量 case 文本"
            label="批量 case 文本"
            name="batch_cases"
            onChange={(event) => setBatchText(event.currentTarget.value)}
            placeholder={[
              "每行一条：title | input | expected output | notes",
              "PR: missing tenant scope | Project.all() | Flag missing tenant scope.",
              "也支持从表格复制 tab 分隔内容。",
            ].join("\n")}
            required
            value={batchText}
          />
          <div className="quickCaseBatchPreview">
            <strong>可导入 {parsed.valid.length} 条</strong>
            <span>{parsed.invalidCount > 0 ? `发现 ${parsed.invalidCount} 行需要修正` : "空行自动忽略"}</span>
          </div>
          {parsed.invalidRows.length > 0 ? <BatchCaseErrors rows={parsed.invalidRows} /> : null}
          <button disabled={busy} type="submit">批量加入评测集</button>
        </ValidatedForm>
      )}
    </section>
  );
}

function BatchCaseErrors({ rows }: { rows: BatchCaseRowError[] }) {
  return (
    <ul className="quickCaseBatchErrors" aria-label="批量 case 行错误">
      {rows.slice(0, 3).map((row) => (
        <li key={row.lineNumber}>{row.message}</li>
      ))}
      {rows.length > 3 ? <li>还有 {rows.length - 3} 行需要修正。</li> : null}
    </ul>
  );
}

function textValue(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}
