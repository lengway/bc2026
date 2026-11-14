import { NextResponse, type NextRequest } from "next/server";
import { mocksEnabled } from "./app/_lib/environment";
import { apiClient } from "./app/_lib/api-client";
import { SessionView } from "./app/_lib/contracts";
export async function proxy(request: NextRequest) {
  if (mocksEnabled) return NextResponse.next();
  const configured = process.env.APP_URL;
  const session = configured
    ? await apiClient(
        new URL("/api/auth/session", new URL(configured).origin).href,
        SessionView,
        {
          headers: { Cookie: request.headers.get("cookie") ?? "" },
          timeoutMs: 5000,
        },
      ).catch(() => null)
    : null;
  if (session) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set(
    "next",
    request.nextUrl.pathname + request.nextUrl.search,
  );
  return NextResponse.redirect(url);
}
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/case/:path*",
    "/review/:path*",
    "/path/:path*",
    "/billing/:path*",
  ],
};
