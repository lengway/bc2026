import type { SkillPath } from "@/contracts";
import { formatSkill } from "@/ui/lib/format";
import { cn } from "@/ui/lib/utils";

type SkillProgressProps = {
  skill: SkillPath["skills"][number];
  className?: string;
};

/** One skill on the path: "Level 3 · Objection handling" and progress to the next level. */
export function SkillProgress({ skill, className }: SkillProgressProps) {
  const name = formatSkill(skill.skill);
  const ratio =
    skill.nextLevelXp > 0 ? Math.min(1, Math.max(0, skill.xp / skill.nextLevelXp)) : 0;
  const percent = Math.round(ratio * 100);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="m-0 text-sm">
          <span className="font-medium">{name}</span>
          <span className="text-muted-foreground"> · Level {skill.level}</span>
        </p>
        <p className="m-0 font-mono text-xs text-muted-foreground tabular-nums">
          {skill.xp} / {skill.nextLevelXp} XP
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={`${name}, level ${skill.level}`}
        aria-valuemin={0}
        aria-valuemax={skill.nextLevelXp}
        aria-valuenow={skill.xp}
        aria-valuetext={`${skill.xp} of ${skill.nextLevelXp} XP to level ${skill.level + 1}`}
        className="h-1.5 overflow-hidden rounded-sm bg-muted"
      >
        <div
          className="h-full rounded-sm bg-ink transition-[width] duration-200 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
