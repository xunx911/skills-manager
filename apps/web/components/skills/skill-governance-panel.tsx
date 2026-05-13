"use client";

import { useState } from "react";

import { TextField } from "@/components/forms/workbench-field";
import { auditPayloadSummary, formatAuditDate } from "@/components/skills/audit-event-format";
import type { AuditEvent, RoleAssignment, SkillDetail } from "@/lib/types";

type SkillGovernancePanelProps = {
  busy: boolean;
  onArchiveSkill: () => void;
  onOpenAudit: () => void;
  selectedDetail: SkillDetail;
};

export function SkillGovernancePanel({ busy, onArchiveSkill, onOpenAudit, selectedDetail }: SkillGovernancePanelProps) {
  const [confirmation, setConfirmation] = useState("");
  const skill = selectedDetail.skill;
  const auditEvents = selectedDetail.audit_events.slice(0, 5);
  const ownerCount = roleCount(selectedDetail.role_assignments, "owner");
  const maintainerCount = roleCount(selectedDetail.role_assignments, "maintainer");
  const canArchive = confirmation.trim() === skill.slug;
  const latestEvent = auditEvents[0]?.action ?? "暂无事件";

  return (
    <section className="skillGovernancePanel">
      <div className="skillGovernanceHeader">
        <div>
          <span>Governance</span>
          <h3>治理与审计</h3>
        </div>
        <p>低频设置和危险操作集中在这里；归档会隐藏 hub 入口，但历史版本、评测集和 run 证据仍可通过直接链接追溯。</p>
      </div>

      <div className="governanceSummary">
        <GovernanceMetric label="Lifecycle" value={skill.lifecycle_status} />
        <GovernanceMetric label="Owners" value={String(ownerCount)} />
        <GovernanceMetric label="Maintainers" value={String(maintainerCount)} />
        <GovernanceMetric label="Latest event" value={latestEvent} />
      </div>

      <div className="auditTrailList">
        <div className="auditTrailTitle">
          <strong>Audit trail</strong>
          <span>{auditEvents.length} recent events</span>
          <button onClick={onOpenAudit} type="button">查看全部审计</button>
        </div>
        {auditEvents.length > 0 ? (
          auditEvents.map((event) => <AuditEventRow event={event} key={event.id} />)
        ) : (
          <p className="auditTrailEmpty">暂无审计事件。角色变更和归档会显示在这里。</p>
        )}
      </div>

      <div className="dangerZone">
        <div>
          <span>Danger zone</span>
          <strong>归档 skill</strong>
          <p>归档后它会从 catalog 中隐藏；历史版本、测评记录和审计事件不会被删除。</p>
        </div>
        <TextField
          aria-label="确认 Skill ID"
          label="确认 Skill ID"
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={skill.slug}
          value={confirmation}
        />
        <button className="dangerButton" disabled={busy || !canArchive} onClick={onArchiveSkill} type="button">
          归档 skill
        </button>
      </div>
    </section>
  );
}

function GovernanceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="governanceMetric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AuditEventRow({ event }: { event: AuditEvent }) {
  return (
    <article className="auditTrailRow">
      <div>
        <strong>{event.action}</strong>
        <span>{auditPayloadSummary(event)}</span>
      </div>
      <small>{event.actor_ref}</small>
      <time>{formatDate(event.created_at)}</time>
    </article>
  );
}

function roleCount(assignments: RoleAssignment[], role: RoleAssignment["role"]) {
  return assignments.filter((assignment) => assignment.role === role).length;
}

function formatDate(value?: string) {
  return formatAuditDate(value);
}
