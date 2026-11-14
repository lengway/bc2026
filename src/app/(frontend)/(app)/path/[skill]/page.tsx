import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SkillId } from "@/contracts";
import { SkillSkeleton } from "@/screens/path/skill-skeleton";
import { SkillsClient } from "../skills-client";

export default function SkillPage({ params }: PageProps<"/path/[skill]">) {
  return (
    <Suspense fallback={<SkillSkeleton detail />}>
      {params.then(({ skill }) => {
        const result = SkillId.safeParse(skill);
        if (!result.success) notFound();
        return <SkillsClient key={result.data} skill={result.data} />;
      })}
    </Suspense>
  );
}
