import "server-only";
import { redirect } from "next/navigation";
import { mocksEnabled } from "../environment";
import { cookies } from "next/headers";
import { getRuntime } from "@/modules/runtime";
import { readSessionCookie } from "@/modules/identity";
export async function requireUser() {
  // Browser MSW cannot intercept RSC requests. Preview auth is enforced by SessionGate.
  if (mocksEnabled) return;
  const session = await getRuntime().identity.getSession(
    readSessionCookie((await cookies()).toString()),
  );
  if (!session) redirect("/login");
}
