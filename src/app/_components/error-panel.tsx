"use client";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/ui/primitives/button";
import { ApiError } from "@/app/_lib/api-client";
export function ErrorPanel({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  const message =
    error instanceof ApiError
      ? error.message
      : "We couldn't load this information. Please try again.";
  return (
    <div
      role="alert"
      className="my-3 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-card p-4 text-sm"
    >
      <AlertCircle
        aria-hidden="true"
        className="size-4 shrink-0 text-destructive"
      />
      <p className="min-w-0 flex-1">{message}</p>
      {retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          <RotateCcw aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}
