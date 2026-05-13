"use client";

import { passRate } from "@/lib/api";
import { percent } from "@/lib/format";
import type { SkillSummary } from "@/lib/types";

type SkillCatalogProps = {
  catalogQuery: string;
  onCatalogQueryChange: (query: string) => void;
  onCreateSkill: () => void;
  onImportSkill: () => void;
  onSelectSkill: (skillId: string) => void;
  selectedSkillId: string;
  skills: SkillSummary[];
  visibleSkills: SkillSummary[];
};

export function SkillCatalog({
  catalogQuery,
  onCatalogQueryChange,
  onCreateSkill,
  onImportSkill,
  onSelectSkill,
  selectedSkillId,
  skills,
  visibleSkills,
}: SkillCatalogProps) {
  return (
    <aside className="linearCatalog" aria-label="Skill catalog">
      <div className="linearCatalogTop">
        <div>
          <span>SkillHub</span>
          <small>{skills.length} skills</small>
        </div>
        <div className="catalogTopActions">
          <button onClick={onImportSkill} type="button">
            导入
          </button>
          <button onClick={onCreateSkill} type="button">
            新建
          </button>
        </div>
      </div>
      <label className="linearSearch">
        <span>Filter</span>
        <input
          onChange={(event) => onCatalogQueryChange(event.currentTarget.value)}
          placeholder="skill、owner、tag"
          value={catalogQuery}
        />
      </label>
      <div className="linearSkillList">
        {visibleSkills.map((summary) => {
          const isSelected = summary.skill.id === selectedSkillId;
          const run = summary.latest_accepted_eval_run;
          const rate = run ? passRate(run) : null;
          return (
            <button
              className={`linearSkillItem ${isSelected ? "linearSkillItemActive" : ""}`}
              key={summary.skill.id}
              onClick={() => onSelectSkill(summary.skill.id)}
              type="button"
            >
              <span className="linearSkillTitle">
                <strong>{summary.skill.slug}</strong>
                <i>{run ? percent(rate) : "未测"}</i>
              </span>
              <span>{summary.skill.owner_ref}</span>
              <span>{summary.default_variant?.tags.join(" + ") ?? "draft"}</span>
            </button>
          );
        })}
        {visibleSkills.length === 0 ? (
          <div className="linearCatalogEmpty">
            {skills.length === 0 ? "还没有 skill。先导入 bundle 或新建一个。" : "没有匹配的 skill"}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
