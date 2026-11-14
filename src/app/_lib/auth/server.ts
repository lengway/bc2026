import "server-only";
import { redirect } from "next/navigation";
import { mocksEnabled } from "../environment";
import { serverApiClient } from "../server-api";
import { SessionView } from "../contracts";
export async function requireUser() {
  // Browser MSW cannot intercept RSC requests. Preview auth is enforced by SessionGate.
  if (mocksEnabled) return;
  const session = await serverApiClient("/api/auth/session", SessionView).catch(
    () => null,
  );
  if (!session) redirect("/login");
}
