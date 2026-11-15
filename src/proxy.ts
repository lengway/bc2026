import { NextResponse, type NextRequest } from "next/server";
import { mocksEnabled } from "./app/_lib/environment";
import { getRuntime } from "@/modules/runtime";
import { readSessionCookie, sessionCookie } from "@/modules/identity";
export async function proxy(request: NextRequest) {
  if (mocksEnabled) return NextResponse.next();
  const token = readSessionCookie(request.headers.get("cookie"));
  try {
    const app = getRuntime();
    const session = await app.identity.getSession(token);
    if (session && token) {
      const response = NextResponse.next();
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set(
        "Set-Cookie",
        sessionCookie(
          token,
          new Date(session.expiresAt),
          new URL(app.config.APP_URL).protocol === "https:",
          app.now(),
        ),
      );
      return response;
    }
  } catch {
    // Infrastructure failure is not evidence that the visitor has signed out.
    return NextResponse.json(
      {
        error: {
          code: "UNAVAILABLE",
          message: "Sign-in is temporarily unavailable. Please try again.",
        },
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store", "Retry-After": "5" },
      },
    );
  }
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
    "/prepare/:path*",
    "/pressure/:path*",
    "/history/:path*",
    "/certificates/:path*",
    "/help/:path*",
    "/billing/:path*",
    "/settings/:path*",
  ],
};
