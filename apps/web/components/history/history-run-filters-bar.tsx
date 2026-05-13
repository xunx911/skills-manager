"use client";

import { SelectField } from "@/components/forms/workbench-field";
import type { HistoryRunFilters } from "@/components/history/workbench-history-pane";

export type HistoryRunFilterOption = {
  id: string;
  label: string;
};

type HistoryRunFiltersBarProps = {
  evalSetVersions: HistoryRunFilterOption[];
  filters: HistoryRunFilters;
  onFilterChange: (key: keyof HistoryRunFilters, value: string) => void;
  variantVersions: HistoryRunFilterOption[];
};

export function HistoryRunFiltersBar({
  evalSetVersions,
  filters,
  onFilterChange,
  variantVersions,
}: HistoryRunFiltersBarProps) {
  return (
    <div className="historyFilters">
      <SelectField
        aria-label="Variant version filter"
        label="Variant"
        onChange={(event) => onFilterChange("variant_version_id", event.currentTarget.value)}
        value={filters.variant_version_id}
      >
        <option value="all">All versions</option>
        {variantVersions.map((version) => (
          <option key={version.id} value={version.id}>{version.label}</option>
        ))}
      </SelectField>
      <SelectField
        aria-label="Eval set version filter"
        label="Eval set"
        onChange={(event) => onFilterChange("eval_set_version_id", event.currentTarget.value)}
        value={filters.eval_set_version_id}
      >
        <option value="all">All snapshots</option>
        {evalSetVersions.map((version) => (
          <option key={version.id} value={version.id}>{version.label}</option>
        ))}
      </SelectField>
      <SelectField
        aria-label="Strategy filter"
        label="Strategy"
        onChange={(event) => onFilterChange("strategy", event.currentTarget.value)}
        value={filters.strategy}
      >
        <option value="all">All strategies</option>
        <option value="manual_pass_fail">manual_pass_fail</option>
      </SelectField>
      <SelectField
        aria-label="Status filter"
        label="Status"
        onChange={(event) => onFilterChange("status", event.currentTarget.value)}
        value={filters.status}
      >
        <option value="all">All statuses</option>
        <option value="finished">finished</option>
        <option value="failed">failed</option>
      </SelectField>
    </div>
  );
}
