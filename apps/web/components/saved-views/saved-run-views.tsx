"use client";

import { SelectField, TextField } from "@/components/forms/workbench-field";
import type { SavedView } from "@/lib/types";

export function SavedRunViews({
  busy,
  loading,
  name,
  onApply,
  onDelete,
  onNameChange,
  onSave,
  selectedViewId,
  views,
}: {
  busy: boolean;
  loading: boolean;
  name: string;
  onApply: (view: SavedView | null) => void;
  onDelete: () => void;
  onNameChange: (name: string) => void;
  onSave: () => void;
  selectedViewId: string;
  views: SavedView[];
}) {
  const selectedView = views.find((view) => view.id === selectedViewId) ?? null;

  return (
    <section className="savedRunViews" aria-label="保存视图">
      <SelectField
        aria-label="Saved run view"
        disabled={loading || busy}
        label="Saved view"
        onChange={(event) => {
          const nextId = event.currentTarget.value;
          onApply(views.find((view) => view.id === nextId) ?? null);
        }}
        value={selectedView?.id ?? "adhoc"}
      >
        <option value="adhoc">临时视图</option>
        {views.map((view) => (
          <option key={view.id} value={view.id}>
            {view.name}
          </option>
        ))}
      </SelectField>
      <TextField
        aria-label="保存视图名称"
        className="savedRunViewName"
        disabled={busy}
        label="保存为"
        onChange={(event) => onNameChange(event.currentTarget.value)}
        placeholder="候选 v2 / Primary v3"
        value={name}
      />
      <button disabled={busy || name.trim().length === 0} onClick={onSave} type="button">
        保存当前视图
      </button>
      <button disabled={busy || !selectedView} onClick={onDelete} type="button">
        删除视图
      </button>
    </section>
  );
}
