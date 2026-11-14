"use client";

import { useState } from "react";
import { PricingTable, type BillingPeriod } from "@/ui";

type LandingPricingProps = {
  /** Where both plan buttons lead: sign-up, then the first case. */
  startHref: string;
};

/** Pricing on the landing page: only the billing toggle is interactive. */
export function LandingPricing({ startHref }: LandingPricingProps) {
  const [billing, setBilling] = useState<BillingPeriod>("yearly");

  return (
    <PricingTable
      billing={billing}
      onBillingChange={setBilling}
      planHrefs={{ free: startHref, pro: startHref }}
    />
  );
}
