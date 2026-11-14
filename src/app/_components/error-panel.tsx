"use client";
import Link from "next/link";
import { ApiError } from "../_lib/api-client";
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
      : "Something went wrong. Please try again.";
  return (
    <div role="alert" className="notice">
      <p>{message}</p>
      {error instanceof ApiError && error.code === "UNAUTHORIZED" ? (
        <Link href="/login">Sign in again</Link>
      ) : retry ? (
        <button className="secondary" onClick={retry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
