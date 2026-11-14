import type { z } from "zod";
import { ErrorResponse } from "./contracts";
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  timeoutMs?: number;
};
export async function apiClient<T>(
  path: string,
  schema: z.ZodType<T>,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, timeoutMs = 20_000, signal, ...init } = options;
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (body !== undefined) headers.set("Content-Type", "application/json");
  try {
    if (combined.aborted) throw combined.reason;
    const origin =
      typeof window === "undefined"
        ? "http://localhost"
        : window.location.origin;
    const response = await fetch(new URL(path, origin), {
      ...init,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
      signal: combined,
    });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ApiError(
        response.ok ? "INVALID_RESPONSE" : "UNAVAILABLE",
        "We couldn't load this information. Please try again.",
        response.status,
      );
    }
    if (!response.ok) {
      const parsed = ErrorResponse.safeParse(payload);
      if (parsed.success)
        throw new ApiError(
          parsed.data.error.code,
          parsed.data.error.message,
          response.status,
        );
      throw new ApiError(
        "UNAVAILABLE",
        "The service is temporarily unavailable. Please try again.",
        response.status,
      );
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success)
      throw new ApiError(
        "INVALID_RESPONSE",
        "We received an unexpected response. Please try again.",
        response.status,
      );
    return parsed.data;
  } catch (error) {
    if (signal?.aborted)
      throw new ApiError("REQUEST_ABORTED", "The request was cancelled.");
    if (timeout.aborted)
      throw new ApiError(
        "TIMEOUT",
        "This is taking longer than expected. Please try again.",
      );
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "NETWORK_ERROR",
      "Couldn't connect. Check your connection and try again.",
    );
  }
}
