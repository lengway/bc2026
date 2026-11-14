import { PageHeading } from "@/app/_components/product";
import { BillingSettings } from "./billing-settings";

export default function BillingPage() {
  return (
    <section className="grid gap-6">
      <PageHeading title="Plan & billing">
        Compare plans and manage your subscription.
      </PageHeading>
      <BillingSettings />
    </section>
  );
}
