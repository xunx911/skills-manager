"use client";

import type { FormEvent } from "react";

import { ValidatedForm } from "@/components/forms/form-validation";
import { SelectField, TextField } from "@/components/forms/workbench-field";
import { canUseCapability, capabilityDeniedReason, roleSummary } from "@/lib/capabilities";
import type { RoleAssignment, SkillCapabilities, SkillPermission } from "@/lib/types";

const roleLabels: Record<RoleAssignment["role"], string> = {
  owner: "Owner",
  maintainer: "Maintainer",
  evaluator: "Evaluator",
  viewer: "Viewer",
};

type SkillAccessPanelProps = {
  actor: string;
  busy: boolean;
  capabilities: SkillCapabilities | null;
  onAssignRole: (event: FormEvent<HTMLFormElement>) => void;
  onRevokeRole: (roleAssignmentId: string) => void;
  roleAssignments: RoleAssignment[];
};

export function SkillAccessPanel({
  actor,
  busy,
  capabilities,
  onAssignRole,
  onRevokeRole,
  roleAssignments,
}: SkillAccessPanelProps) {
  const ownerCount = roleAssignments.filter((assignment) => assignment.role === "owner").length;
  const canManageRoles = canUseCapability(capabilities, "role.manage");

  return (
    <section className="skillAccessPanel">
      <div className="skillAccessHeader">
        <div>
          <span>Access control</span>
          <h3>访问控制</h3>
        </div>
        <p>受保护动作包括设为当前版本和接受验证依据；本地开发身份来自请求 header，正式版会替换为 session/token。</p>
      </div>

      <div className="skillAccessActor">
        <span>Local actor</span>
        <strong>{actor}</strong>
        <small>{roleSummary(capabilities)}</small>
      </div>

      <div className="skillCapabilityGrid" aria-label="Current actor capabilities">
        <CapabilityChip capabilities={capabilities} label="管理角色" permission="role.manage" />
        <CapabilityChip capabilities={capabilities} label="设为当前版本" permission="variant.promote" />
        <CapabilityChip capabilities={capabilities} label="接受验证依据" permission="verification.accept" />
      </div>

      <div className="skillAccessRows">
        {roleAssignments.map((assignment) => {
          const isLastOwner = assignment.role === "owner" && ownerCount <= 1;
          const disableRevoke = busy || isLastOwner || !canManageRoles;
          return (
            <article className="skillAccessRow" key={assignment.id}>
              <div>
                <strong>{assignment.subject_id}</strong>
                <span>{assignment.subject_type} · {assignment.resource_type}</span>
              </div>
              <b>{roleLabels[assignment.role]}</b>
              <small>by {assignment.created_by}</small>
              <button disabled={disableRevoke} onClick={() => onRevokeRole(assignment.id)} title={!canManageRoles ? capabilityDeniedReason("role.manage") : undefined} type="button">
                移除
              </button>
            </article>
          );
        })}
      </div>

      <ValidatedForm className="skillAccessForm" onValidSubmit={onAssignRole}>
        <TextField label="成员" name="subject_id" placeholder="qa-reviewer" required />
        <SelectField aria-label="Access role" defaultValue="evaluator" label="角色" name="role">
          <option value="maintainer">Maintainer</option>
          <option value="evaluator">Evaluator</option>
          <option value="viewer">Viewer</option>
          <option value="owner">Owner</option>
        </SelectField>
        <button disabled={busy || !canManageRoles} title={!canManageRoles ? capabilityDeniedReason("role.manage") : undefined} type="submit">添加成员</button>
      </ValidatedForm>
    </section>
  );
}

function CapabilityChip({
  capabilities,
  label,
  permission,
}: {
  capabilities: SkillCapabilities | null;
  label: string;
  permission: SkillPermission;
}) {
  const allowed = canUseCapability(capabilities, permission);
  return (
    <span className={`skillCapabilityChip ${allowed ? "skillCapabilityChipAllowed" : "skillCapabilityChipDenied"}`}>
      <b>{label}</b>
      <small>{allowed ? "可执行" : deniedShortLabel(permission)}</small>
    </span>
  );
}

function deniedShortLabel(permission: SkillPermission) {
  if (permission === "role.manage") return "不能管理角色";
  if (permission === "variant.promote") return "不能 promote";
  return "不能接受验证";
}
