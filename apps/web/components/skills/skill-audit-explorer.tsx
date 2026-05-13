"use client";

import { useEffect, useMemo, useState } from "react";

import { auditPayloadSummary, formatAuditDate } from "@/components/skills/audit-event-format";
import { shortId } from "@/lib/format";
import type { AuditEvent } from "@/lib/types";

export type AuditExplorerFilters = {
  actor: string;
  action: string;
  resource_type: string;
};

type SkillAuditExplorerProps = {
  events: AuditEvent[];
  filters: AuditExplorerFilters;
  loading: boolean;
  onClearFilters: () => void;
  onFilterChange: (key: keyof AuditExplorerFilters, value: string) => void;
  onOpenOverview: () => void;
};

const resourceTypes = ["all", "skill", "variant", "eval_run"] as const;
const ACTION_LABELS: Record<string, string> = {
  "eval_run.accepted_verification_set": "Verification accepted",
  "role.assigned": "Access role assigned",
  "role.revoked": "Access role revoked",
  "skill.archived": "Skill archived",
  "variant.promoted": "Variant promoted",
};

export function SkillAuditExplorer({
  events,
  filters,
  loading,
  onClearFilters,
  onFilterChange,
  onOpenOverview,
}: SkillAuditExplorerProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? events[0] ?? null;
  const summary = useMemo(() => auditSummary(events), [events]);
  const actionChips = useMemo(() => auditActionChips(events), [events]);
  const selectedPayloadFields = selectedEvent ? auditPayloadFields(selectedEvent) : [];

  useEffect(() => {
    if (!selectedEventId || events.some((event) => event.id === selectedEventId)) return;
    setSelectedEventId(events[0]?.id ?? null);
  }, [events, selectedEventId]);

  return (
    <section className="skillAuditExplorer">
      <div className="auditExplorerHeader">
        <div>
          <span>Audit explorer</span>
          <h2>审计 Explorer</h2>
          <p>按 actor、action 和资源类型追踪当前 skill 的治理事件；列表包含 skill 本身，以及它关联的 variant 和 eval run 事件。</p>
        </div>
        <button onClick={onOpenOverview} type="button">回到治理面板</button>
      </div>

      <div className="auditExplorerSummary">
        <AuditMetric label="Events" value={String(events.length)} />
        <AuditMetric label="Actors" value={String(summary.actorCount)} />
        <AuditMetric label="Resources" value={String(summary.resourceTypeCount)} />
        <AuditMetric label="Key actions" value={String(summary.keyActionCount)} />
      </div>

      {actionChips.length > 0 ? (
        <div aria-label="Action quick filters" className="auditActionChips">
          {actionChips.map((chip) => (
            <button
              aria-label={`筛选 ${chip.action} ${chip.count} 条事件`}
              aria-pressed={filters.action === chip.action}
              key={chip.action}
              onClick={() => onFilterChange("action", chip.action)}
              type="button"
            >
              <span>{auditActionLabel(chip.action)}</span>
              <code>{chip.action}</code>
              <b>{chip.count}</b>
            </button>
          ))}
        </div>
      ) : null}

      <div className="auditExplorerFilters">
        <label>
          <span>Actor</span>
          <input
            aria-label="Actor filter"
            onChange={(event) => onFilterChange("actor", event.currentTarget.value)}
            placeholder="product-operator"
            value={filters.actor}
          />
        </label>
        <label>
          <span>Action</span>
          <input
            aria-label="Action filter"
            onChange={(event) => onFilterChange("action", event.currentTarget.value)}
            placeholder="role.assigned"
            value={filters.action}
          />
        </label>
        <label>
          <span>Resource</span>
          <select
            aria-label="Resource type filter"
            onChange={(event) => onFilterChange("resource_type", event.currentTarget.value)}
            value={filters.resource_type}
          >
            {resourceTypes.map((type) => (
              <option key={type} value={type}>{type === "all" ? "All resources" : type}</option>
            ))}
          </select>
        </label>
        <button onClick={onClearFilters} type="button">清除筛选</button>
      </div>

      <div className="auditExplorerGrid">
        <div className="auditExplorerTimeline" aria-label="Audit events">
          {loading ? <p className="auditExplorerEmpty">正在加载审计事件...</p> : null}
          {!loading && events.length === 0 ? (
            <p className="auditExplorerEmpty">当前筛选没有事件。清除筛选后再看完整时间线。</p>
          ) : null}
          {events.map((event) => (
            <button
              className={`auditExplorerEvent ${event.id === selectedEvent?.id ? "auditExplorerEventActive" : ""}`}
              key={event.id}
              onClick={() => setSelectedEventId(event.id)}
              aria-pressed={event.id === selectedEvent?.id}
              type="button"
            >
              <span className="auditEventActionLine">
                <strong>{auditActionLabel(event.action)}</strong>
                <code>{event.action}</code>
              </span>
              <span className="auditEventSummary">{auditPayloadSummary(event)}</span>
              <span className="auditEventMetaLine">
                <small><b>Actor</b>{event.actor_ref}</small>
                <small><b>Resource</b>{formatAuditResource(event)}</small>
                <time>{formatAuditDate(event.created_at)}</time>
              </span>
            </button>
          ))}
        </div>

        <aside className="auditPayloadPanel">
          {selectedEvent ? (
            <>
              <div className="auditPayloadHead">
                <span>Readable summary</span>
                <strong>{auditActionLabel(selectedEvent.action)}</strong>
                <small>{selectedEvent.action}</small>
              </div>
              <div className="auditPayloadBody">
                <dl className="auditPayloadFacts">
                  <div>
                    <dt>Actor</dt>
                    <dd>{selectedEvent.actor_ref}</dd>
                  </div>
                  <div>
                    <dt>Resource</dt>
                    <dd>{formatAuditResource(selectedEvent)}</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd>{formatAuditDate(selectedEvent.created_at)}</dd>
                  </div>
                </dl>
                <div className="auditPayloadSummaryCard">
                  <span>Readable summary</span>
                  <p>{auditPayloadSummary(selectedEvent)}</p>
                </div>
                {selectedPayloadFields.length > 0 ? (
                  <dl className="auditPayloadFields">
                    {selectedPayloadFields.map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                <details className="auditRawPayload">
                  <summary>Raw payload</summary>
                  <pre>{JSON.stringify(selectedEvent.payload, null, 2)}</pre>
                </details>
              </div>
            </>
          ) : (
            <p className="auditExplorerEmpty">选择一条事件后查看 payload。</p>
          )}
        </aside>
      </div>
    </section>
  );
}

function AuditMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="auditExplorerMetric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function auditActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function formatAuditResource(event: AuditEvent) {
  return `${event.resource_type} / ${shortId(event.resource_id)}`;
}

function auditActionChips(events: AuditEvent[]) {
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.action, (counts.get(event.action) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((left, right) => right.count - left.count || left.action.localeCompare(right.action))
    .slice(0, 6);
}

function auditPayloadFields(event: AuditEvent) {
  return Object.entries(event.payload).filter(([, value]) => {
    const valueType = typeof value;
    return valueType === "string" || valueType === "number" || valueType === "boolean";
  }).slice(0, 6);
}

function auditSummary(events: AuditEvent[]) {
  const actors = new Set(events.map((event) => event.actor_ref));
  const resourceTypesSet = new Set(events.map((event) => event.resource_type));
  const keyActionCount = events.filter((event) =>
    ["skill.archived", "variant.promoted", "eval_run.accepted_verification_set"].includes(event.action),
  ).length;
  return {
    actorCount: actors.size,
    resourceTypeCount: resourceTypesSet.size,
    keyActionCount,
  };
}
