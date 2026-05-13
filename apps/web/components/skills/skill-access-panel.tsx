"use client";

import type { FormEvent } from "react";

import { SelectField, TextField } from "@/components/forms/workbench-field";
import type { RoleAssignment } from "@/lib/types";

const roleLabels: Record<RoleAssignment["role"], string> = {
  owner: "Owner",
  maintainer: "Maintainer",
  evaluator: "Evaluator",
  viewer: "Viewer",
};

type SkillAccessPanelProps = {
  actor: string;
  busy: boolean;
  onAssignRole: (event: FormEvent<HTMLFormElement>) => void;
  onRevokeRole: (roleAssignmentId: string) => void;
  roleAssignments: RoleAssignment[];
};

export function SkillAccessPanel({
  actor,
  busy,
  onAssignRole,
  onRevokeRole,
  roleAssignments,
}: SkillAccessPanelProps) {
  const ownerCount = roleAssignments.filter((assignment) => assignment.role === "owner").length;

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
      </div>

      <div className="skillAccessRows">
        {roleAssignments.map((assignment) => {
          const isLastOwner = assignment.role === "owner" && ownerCount <= 1;
          return (
            <article className="skillAccessRow" key={assignment.id}>
              <div>
                <strong>{assignment.subject_id}</strong>
                <span>{assignment.subject_type} · {assignment.resource_type}</span>
              </div>
              <b>{roleLabels[assignment.role]}</b>
              <small>by {assignment.created_by}</small>
              <button disabled={busy || isLastOwner} onClick={() => onRevokeRole(assignment.id)} type="button">
                移除
              </button>
            </article>
          );
        })}
      </div>

      <form className="skillAccessForm" onSubmit={onAssignRole}>
        <TextField label="成员" name="subject_id" placeholder="qa-reviewer" required />
        <SelectField aria-label="Access role" defaultValue="evaluator" label="角色" name="role">
          <option value="maintainer">Maintainer</option>
          <option value="evaluator">Evaluator</option>
          <option value="viewer">Viewer</option>
          <option value="owner">Owner</option>
        </SelectField>
        <button disabled={busy} type="submit">添加成员</button>
      </form>
    </section>
  );
}
