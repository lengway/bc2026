"use client";

import { useQuery } from "@tanstack/react-query";
import { BillingSummary } from "@/contracts";
import { apiClient } from "@/app/_lib/api-client";

export const billingSummaryKey = ["billing-summary"] as const;

export function useBillingSummary() {
  return useQuery({
    queryKey: billingSummaryKey,
    queryFn: ({ signal }) =>
      apiClient("/api/billing/summary", BillingSummary, { signal }),
  });
}
