"use client";

import { ApiError } from "@/app/_lib/api-client";
import { ErrorPanel } from "./error-panel";

export function BillingActionError({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  const unavailable =
    !(error instanceof ApiError) ||
    error.status === 0 ||
    error.status >= 500 ||
    error.code === "INVALID_RESPONSE";
  return (
    <ErrorPanel
      error={
        unavailable
          ? new ApiError(
              "UNAVAILABLE",
              "Billing is temporarily unavailable. Try again in a minute.",
            )
          : error
      }
      retry={retry}
    />
  );
}
