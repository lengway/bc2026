import { PageHeading } from "@/app/_components/product";
import { PrivacySettings } from "./privacy-settings";

export default function PrivacyPage() {
  return (
    <section className="grid gap-6">
      <PageHeading title="Privacy & data">
        Control who can access your published results.
      </PageHeading>
      <PrivacySettings />
    </section>
  );
}
