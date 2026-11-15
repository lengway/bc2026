"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCheckout } from "@/app/_hooks/use-billing-checkout";
import { usePreviewStatus } from "@/app/_components/providers";
import { mocksEnabled } from "@/app/_lib/environment";
import { BillingActionError } from "@/app/_components/billing-action-error";
import { PageHeading, PublicShell } from "@/app/_components/product";
import { PricingTable, type BillingPeriod } from "@/ui/pricing-table";
export function PricingPreview() {
  const checkout = useCheckout();
  const previewStatus = usePreviewStatus();
  const router = useRouter();
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const startCheckout = () =>
    checkout.mutate(billing, {
      onError: (error) => {
        if ("status" in error && error.status === 401)
          router.push("/login?account=1&next=/pricing");
      },
    });
  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-12 sm:px-8 sm:py-16">
        <PageHeading
          eyebrow="Invest in your next move"
          title="Practice at your pace."
        >
          Start with a real conversation. Keep going when you are ready.
        </PageHeading>
        <PricingTable
          billing={billing}
          onBillingChange={(period) => {
            setBilling(period);
            checkout.reset();
          }}
          titleAs="h2"
          pending={!previewStatus.ready}
          checkoutPending={checkout.isPending}
          checkoutError={
            checkout.isError && (
              <BillingActionError
                error={checkout.error}
                retry={startCheckout}
              />
            )
          }
          planHrefs={{ free: "/login?next=/onboarding" }}
          onSelectPlan={startCheckout}
        />
        {previewStatus.failed && (
          <p role="alert" className="text-sm text-destructive">
            Preview checkout is unavailable. Reload the page to try again.
          </p>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          {mocksEnabled
            ? "Preview checkout does not collect payment or change a subscription."
            : "Payment is handled by Stripe. Your access updates after the server confirms payment."}{" "}
          {billing === "yearly"
            ? "Yearly billing is $149 charged once per year."
            : "Monthly billing is $19 per month."}
        </p>
      </main>
    </PublicShell>
  );
}
