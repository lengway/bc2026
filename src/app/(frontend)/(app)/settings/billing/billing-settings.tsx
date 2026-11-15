"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BillingActionError } from "@/app/_components/billing-action-error";
import { useCheckout } from "@/app/_hooks/use-billing-checkout";
import { useBillingSummary } from "@/app/_hooks/use-billing-summary";
import { accountApi } from "@/app/_lib/account-api";
import { api } from "@/app/_lib/api";
import { ErrorPanel } from "@/app/_components/error-panel";
import { Button } from "@/ui/primitives/button";
import { PricingTable, type BillingPeriod } from "@/ui/pricing-table";
import { SettingsLoading, SettingsSection } from "../settings-section";

const formatDate = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export function BillingSettings() {
  const query = useBillingSummary();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => api.session(signal),
  });
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const checkout = useCheckout();
  const portal = useMutation({
    mutationFn: accountApi.portal,
    retry: false,
    onSuccess: ({ url }) => window.location.assign(url),
  });
  if (query.isPending)
    return <SettingsLoading label="Loading plan and billing…" />;
  if (query.isError)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  const { plan, freeDailyRemaining, periodEnd, canManage } = query.data;
  const isGuest = session.data?.user.isGuest === true;
  const update = (next: BillingPeriod) => {
    setPeriod(next);
    checkout.reset();
  };
  return (
    <div className="grid gap-5">
      <SettingsSection title={plan === "pro" ? "Pro plan" : "Free plan"}>
        <p className="text-sm text-muted-foreground">
          {plan === "pro"
            ? "Unlimited daily cases, a weekly case and detailed certificates."
            : `${freeDailyRemaining} of 1 daily cases available in your rolling 7-day allowance.`}
        </p>
        {periodEnd && (
          <p className="text-sm">
            {plan === "pro" ? "Current period ends" : "Previous period ended"}{" "}
            <time dateTime={periodEnd} className="font-mono tabular-nums">
              {formatDate.format(new Date(periodEnd))}
            </time>
            .
          </p>
        )}
        {canManage && (
          <Button
            className="min-h-11 w-fit"
            variant="outline"
            disabled={portal.isPending || checkout.isPending}
            aria-busy={portal.isPending}
            onClick={() => portal.mutate()}
          >
            {portal.isPending ? "Opening billing…" : "Manage subscription"}
          </Button>
        )}
        {isGuest && (
          <Button asChild className="min-h-11 w-fit">
            <Link href="/login?account=1&next=/settings/billing">Sign in to upgrade</Link>
          </Button>
        )}
        {portal.isError && (
          <BillingActionError
            error={portal.error}
            retry={() => portal.mutate()}
          />
        )}
      </SettingsSection>
      <PricingTable
        billing={period}
        currentPlan={plan}
        onBillingChange={update}
        onSelectPlan={(selected) => {
          if (selected === "pro") checkout.mutate(period);
        }}
        planHrefs={
          isGuest ? { pro: "/login?account=1&next=/settings/billing" } : undefined
        }
        pending={portal.isPending}
        checkoutPending={checkout.isPending}
        checkoutError={
          checkout.isError && (
            <BillingActionError
              error={checkout.error}
              retry={() => checkout.mutate(period)}
            />
          )
        }
      />
    </div>
  );
}
