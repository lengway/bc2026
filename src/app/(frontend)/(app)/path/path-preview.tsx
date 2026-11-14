"use client";
import { useSkillPath } from "@/app/_hooks/case-hooks";
import { LoadingState } from "@/app/_components/providers";
import { ErrorPanel } from "@/app/_components/error-panel";
export function PathPreview() {
  const query = useSkillPath();
  if (query.isPending) return <LoadingState />;
  if (query.isError)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <section className="stack">
      <p className="eyebrow">One conversation at a time</p>
      <h1>Your progress</h1>
      <div className="grid">
        {query.data.skills.map((skill) => (
          <article key={skill.skill} className="panel stack tight">
            <h2>{skill.skill.replaceAll("_", " ")}</h2>
            <p>
              Level {skill.level} · {skill.xp} / {skill.nextLevelXp} XP
            </p>
            <progress
              value={skill.xp}
              max={skill.nextLevelXp}
              aria-label={`${skill.skill} progress`}
            />
          </article>
        ))}
      </div>
      <p className="muted">
        {query.data.streak.current
          ? `${query.data.streak.current}-day practice record`
          : "Your practice record starts with your first completed case."}
      </p>
    </section>
  );
}
