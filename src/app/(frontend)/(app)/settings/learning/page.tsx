import { PageHeading } from "@/app/_components/product";
import { LearningSettings } from "./learning-settings";

export default function LearningPage() {
  return (
    <section className="grid gap-6">
      <PageHeading title="My learning">
        Set the role, skills and difficulty for your practice.
      </PageHeading>
      <LearningSettings />
    </section>
  );
}
