"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CaseHistoryPage,
  OwnedCertificates,
  type CaseHistoryFilters,
  type OwnedCertificateFilters,
} from "@/contracts";
import { apiClient } from "@/app/_lib/api-client";

function resource(path: string, filters: Record<string, unknown>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) search.set(key, String(value));
  }
  return search.size ? `${path}?${search}` : path;
}

export function useCaseHistory(filters: CaseHistoryFilters = {}) {
  return useQuery({
    queryKey: ["owner-history", filters],
    queryFn: ({ signal }) =>
      apiClient(resource("/api/me/history", filters), CaseHistoryPage, {
        signal,
      }),
    staleTime: 0,
  });
}

export function useOwnedCertificates(filters: OwnedCertificateFilters = {}) {
  return useQuery({
    queryKey: ["owner-certificates", filters],
    queryFn: ({ signal }) =>
      apiClient(resource("/api/me/certificates", filters), OwnedCertificates, {
        signal,
      }),
    staleTime: 0,
  });
}
