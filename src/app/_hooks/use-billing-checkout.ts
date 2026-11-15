"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/app/_lib/api";
import { ApiError } from "@/app/_lib/api-client";
import { mocksEnabled } from "@/app/_lib/environment";

async function openBillingCheckout(plan: "monthly" | "yearly") {
  const result = await api.checkout(plan);
  const url = new URL(result.url);
  const hostedCheckout =
    url.protocol === "https:" && url.hostname === "checkout.stripe.com";
  const previewCheckout =
    mocksEnabled &&
    url.origin === window.location.origin &&
    url.pathname === "/billing/success";
  if (url.username || url.password || (!hostedCheckout && !previewCheckout)) {
    throw new ApiError("INVALID_RESPONSE", "We could not open checkout.");
  }
  window.location.assign(url.href);
}

export function useCheckout() {
  return useMutation({ mutationFn: openBillingCheckout, retry: false });
}
