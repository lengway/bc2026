"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCheckout } from "@/app/_hooks/case-hooks";
import { usePreviewStatus } from "@/app/_components/providers";
import { mocksEnabled } from "@/app/_lib/environment";
import { ErrorPanel } from "@/app/_components/error-panel";
import { PageHeading, PublicShell } from "@/app/_components/product";
import { PricingTable, type BillingPeriod } from "@/ui/pricing-table";
export function PricingPreview() {
  const checkout = useCheckout();
  const previewStatus = usePreviewStatus();
  const router = useRouter();
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const [error, setError] = useState("");
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
          onBillingChange={setBilling}
          titleAs="h2"
          pending={!previewStatus.ready || checkout.isPending}
          planHrefs={{ free: "/login?next=/onboarding" }}
          onSelectPlan={() => {
            setError("");
            checkout.mutate(billing, {
              onSuccess: (result) => {
                const url = new URL(result.url);
                const allowed =
                  url.protocol === "https:" &&
                  url.hostname === "checkout.stripe.com" &&
                  !url.username &&
                  !url.password;
                const preview =
                  mocksEnabled &&
                  url.origin === window.location.origin &&
                  url.pathname === "/billing/success";
                if (!allowed && !preview) {
                  setError("We could not open checkout. Please try again.");
                  return;
                }
                window.location.assign(url.href);
              },
              onError: (e) => {
                if ("status" in e && e.status === 401)
                  router.push("/login?next=/pricing");
              },
            });
          }}
        />
        {previewStatus.failed && (
          <p role="alert" className="text-sm text-destructive">
            Preview checkout is unavailable. Reload the page to try again.
          </p>
        )}
        {checkout.isError && <ErrorPanel error={checkout.error} />}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
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
