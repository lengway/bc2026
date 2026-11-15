import { requireUser } from "@/app/_lib/auth/server";
import { ClientData } from "@/app/_components/providers";
import { SessionGate } from "@/app/_components/session-gate";
import { CheckoutNotice } from "@/app/_components/checkout-notice";
export const dynamic = "force-dynamic";
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return (
    <ClientData>
      <SessionGate>
        <CheckoutNotice />
        {children}
      </SessionGate>
    </ClientData>
  );
}
