import { PageHeading } from "@/app/_components/product";
import { AccountSettings } from "./account-settings";

export default function AccountPage() {
  return (
    <section className="grid gap-6">
      <PageHeading title="Account">
        Manage your identity, credentials and sessions.
      </PageHeading>
      <AccountSettings />
    </section>
  );
}
