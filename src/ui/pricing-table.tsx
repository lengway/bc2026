"use client";

import { Check, Minus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/ui/lib/utils";
import { Button } from "@/ui/primitives/button";

export type PlanId = "free" | "pro";
export type BillingPeriod = "monthly" | "yearly";

/** Prices in whole US dollars. Source: CONTEXT.md §5. */
export const PRO_PRICE: Record<BillingPeriod, number> = { monthly: 19, yearly: 149 };

type Feature = { label: string; free: string | null; pro: string | null };

const FEATURES: ReadonlyArray<Feature> = [
  { label: "Onboarding case", free: "Included", pro: "Included" },
  { label: "Daily cases", free: "1 per week", pro: "Unlimited" },
  { label: "Weekly case, 30–40 minutes", free: null, pro: "Included" },
  { label: "Skill certificate", free: "Three case results", pro: "Results and key moves" },
  { label: "Skill path", free: "Basic", pro: "Full, with recommendations" },
];

type PricingTableProps = {
  billing: BillingPeriod;
  onBillingChange?: (billing: BillingPeriod) => void;
  onSelectPlan?: (plan: PlanId) => void;
  /** Render a plan's action as a link instead of a button, e.g. on the landing page. */
  planHrefs?: Partial<Record<PlanId, string>>;
  /** Marks the plan the user is on. */
  currentPlan?: PlanId | null;
  /** Disables the Pro action while checkout is being created. */
  pending?: boolean;
  checkoutPending?: boolean;
  checkoutError?: ReactNode;
  titleAs?: "h2" | "h3";
  className?: string;
};

function FeatureList({ plan }: { plan: PlanId }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0 text-sm">
      {FEATURES.map((feature) => {
        const value = feature[plan];
        return (
          <li key={feature.label} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3">
            {value ? (
              <Check aria-hidden="true" className="mt-0.5 size-4 text-ink" strokeWidth={1.5} />
            ) : (
              <Minus
                aria-hidden="true"
                className="mt-0.5 size-4 text-muted-foreground"
                strokeWidth={1.5}
              />
            )}
            <span className={cn(!value && "text-muted-foreground")}>
              {feature.label}
              <span className="block text-muted-foreground">{value ?? "Not included"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Free vs Pro. The emphasis is the full verifiable review and unlimited daily cases. */
export function PricingTable({
  billing,
  onBillingChange,
  onSelectPlan,
  planHrefs,
  currentPlan = null,
  pending = false,
  checkoutPending = false,
  checkoutError,
  titleAs: Title = "h3",
  className,
}: PricingTableProps) {
  const yearlySaving = PRO_PRICE.monthly * 12 - PRO_PRICE.yearly;
  const yearlyPerMonth = (PRO_PRICE.yearly / 12).toFixed(2);

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div
        role="group"
        aria-label="Billing period"
        className="inline-flex self-start rounded-lg border bg-surface p-1"
      >
        {(["monthly", "yearly"] as const).map((period) => (
          <button
            key={period}
            type="button"
            aria-pressed={billing === period}
            disabled={pending || checkoutPending}
            onClick={() => onBillingChange?.(period)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-medium outline-none",
              "transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring",
              billing === period
                ? "bg-card text-foreground shadow-card ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {period === "monthly" ? "Monthly" : "Yearly"}
            {period === "yearly" ? (
              <span className="font-mono text-xs text-ink tabular-nums">
                Save ${yearlySaving}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section
          aria-label="Free plan"
          className="flex flex-col gap-6 rounded-xl border bg-card p-6"
        >
          <header className="flex flex-col gap-3">
            <Title className="m-0 text-base font-medium">Free</Title>
            <p className="m-0 font-mono text-display-sm leading-none font-medium tracking-tight tabular-nums">
              $0
            </p>
            <p className="m-0 text-sm text-muted-foreground">
              One case a week and a shareable case record.
            </p>
          </header>
          <FeatureList plan="free" />
          {planHrefs?.free && currentPlan !== "free" ? (
            <Button asChild variant="outline" size="lg" className="mt-auto h-11">
              <Link href={planHrefs.free}>Start free</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="lg"
              className="mt-auto h-11"
              disabled={currentPlan === "free"}
              onClick={() => onSelectPlan?.("free")}
            >
              {currentPlan === "free" ? "Your current plan" : "Start free"}
            </Button>
          )}
        </section>

        <section
          aria-label="Pro plan"
          className="flex flex-col gap-6 rounded-xl border border-ink bg-card p-6"
        >
          <header className="flex flex-col gap-3">
            <Title className="m-0 text-base font-medium">Pro</Title>
            <p className="m-0 flex items-baseline gap-2">
              <span className="font-mono text-display-sm leading-none font-medium tracking-tight tabular-nums">
                ${PRO_PRICE[billing]}
              </span>
              <span className="text-sm text-muted-foreground">
                {billing === "monthly" ? "per month" : "per year"}
              </span>
            </p>
            <p className="m-0 text-sm text-muted-foreground">
              {billing === "yearly" ? (
                <>
                  <span className="font-mono tabular-nums">${yearlyPerMonth}</span> a month, billed
                  yearly.
                </>
              ) : (
                "Unlimited daily cases and key moves on skill certificates."
              )}
            </p>
          </header>
          <FeatureList plan="pro" />
          {planHrefs?.pro && currentPlan !== "pro" ? (
            <Button asChild size="lg" className="mt-auto h-11">
              <Link href={planHrefs.pro}>Get Pro</Link>
            </Button>
          ) : (
            <Button
              size="lg"
              className="mt-auto h-11"
              disabled={pending || checkoutPending || currentPlan === "pro"}
              aria-busy={checkoutPending}
              onClick={() => onSelectPlan?.("pro")}
            >
              {currentPlan === "pro"
                ? "Your current plan"
                : checkoutPending
                  ? "Opening checkout…"
                  : "Upgrade to Pro"}
            </Button>
          )}
          {checkoutError}
        </section>
      </div>
    </div>
  );
}
