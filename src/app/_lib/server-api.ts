import "server-only";
import type { z } from "zod";
import { cookies } from "next/headers";
import { apiClient, ApiError, type ApiRequestOptions } from "./api-client";
export async function serverApiClient<T>(
  path: string,
  schema: z.ZodType<T>,
  options: ApiRequestOptions = {},
): Promise<T> {
  const configured = process.env.APP_URL;
  if (!configured)
    throw new ApiError("UNAVAILABLE", "Sign-in is temporarily unavailable.");
  const origin = new URL(configured).origin;
  const headers = new Headers(options.headers);
  headers.set("Cookie", (await cookies()).toString());
  if (options.method && !["GET", "HEAD"].includes(options.method.toUpperCase()))
    headers.set("Origin", origin);
  return apiClient(new URL(path, origin).href, schema, { ...options, headers });
}
