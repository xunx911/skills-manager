"use client";

import { FormEvent, useMemo, useState } from "react";

import { TextAreaField, TextField } from "@/components/forms/workbench-field";

export type QuickEvalCaseDraft = {
  title: string;
  input_text: string;
  expected_output: string;
  notes?: string;
};

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
    event.preventDefault();
    if (parsed.valid.length === 0) return;
    const saved = await onCreateCases(parsed.valid);
    if (saved) setBatchText("");
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
        <form className="quickCaseGrid" onSubmit={submitSingle}>
          <TextField className="quickCaseTitleField" label="标题" name="quick_title" placeholder="PR: 缺少 tenant scope" required />
          <TextAreaField className="quickCaseInputField" label="Input" name="quick_input_text" placeholder="代码 diff、用户请求、上下文" required />
          <TextAreaField className="quickCaseExpectedField" label="Expected output" name="quick_expected_output" placeholder="应该指出什么" required />
          <TextField className="quickCaseNotesField" label="Notes" name="quick_notes" placeholder="来源或维护说明，可选" />
          <button disabled={busy} type="submit">快速加入</button>
        </form>
      ) : (
        <form className="quickCaseBatch" onSubmit={submitBatch}>
          <TextAreaField
            aria-label="批量 case 文本"
            label="批量 case 文本"
            onChange={(event) => setBatchText(event.currentTarget.value)}
            placeholder={[
              "每行一条：title | input | expected output | notes",
              "PR: missing tenant scope | Project.all() | Flag missing tenant scope.",
              "也支持从表格复制 tab 分隔内容。",
            ].join("\n")}
            value={batchText}
          />
          <div className="quickCaseBatchPreview">
            <strong>可导入 {parsed.valid.length} 条</strong>
            <span>跳过 {parsed.invalidCount} 行 · 空行自动忽略</span>
          </div>
          <button disabled={busy || parsed.valid.length === 0} type="submit">批量加入评测集</button>
        </form>
      )}
    </section>
  );
}

export function parseBatchCases(text: string): { valid: QuickEvalCaseDraft[]; invalidCount: number } {
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const valid: QuickEvalCaseDraft[] = [];
  let invalidCount = 0;

  for (const row of rows) {
    const separator = row.includes("\t") ? "\t" : "|";
    const [title, inputText, expectedOutput, notes] = row.split(separator).map((part) => part.trim());
    if (!title || !inputText || !expectedOutput) {
      invalidCount += 1;
      continue;
    }
    valid.push({
      title,
      input_text: inputText,
      expected_output: expectedOutput,
      notes: notes || undefined,
    });
  }

  return { valid, invalidCount };
}

function textValue(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}
