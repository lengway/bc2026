"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Stripe returns to /dashboard?checkout=success or /settings/billing?checkout=cancelled.
 * Confirm the result once, refresh plan data (the webhook may land a moment later) and clean the URL.
 */
export function CheckoutNotice() {
  const client = useQueryClient();
  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get("checkout");
    if (result !== "success" && result !== "cancelled") return;
    url.searchParams.delete("checkout");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    if (result === "success") {
      toast.success("Welcome to Pro. Your plan is active.");
      void client.invalidateQueries();
      const retry = setTimeout(() => void client.invalidateQueries(), 4000);
      return () => clearTimeout(retry);
    }
    toast("Checkout cancelled. You are still on the Free plan.");
  }, [client]);
  return null;
}
