"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import type { SessionView } from "@/contracts";
import { useCheckout } from "@/app/_hooks/use-billing-checkout";
import { PRO_PRICE } from "@/ui/pricing-table";
import { Button } from "@/ui/primitives/button";
import { BillingActionError } from "./billing-action-error";

export function UpgradeCheckout() {
  const session = useQueryClient().getQueryData<SessionView>(["session"]);
  const checkout = useCheckout();
  const start = () => checkout.mutate("monthly");
  return (
    <div className="w-full min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {session?.user.isGuest ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-11 lg:min-h-8"
          >
            <Link href="/login?account=1&next=/settings/billing">Sign in to upgrade</Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 lg:min-h-8"
            aria-busy={checkout.isPending}
            disabled={checkout.isPending}
            onClick={start}
          >
            {checkout.isPending ? "Opening checkout…" : "Upgrade to Pro"}
          </Button>
        )}
        <Link
          href="/settings/billing"
          className="min-h-11 content-center rounded-sm text-sm text-muted-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring lg:min-h-8"
        >
          See plans
        </Link>
      </div>
      {!session?.user.isGuest && (
        <p className="text-xs text-muted-foreground">
          ${PRO_PRICE.monthly} per month
        </p>
      )}
      {checkout.isError && (
        <BillingActionError error={checkout.error} retry={start} />
      )}
    </div>
  );
}
