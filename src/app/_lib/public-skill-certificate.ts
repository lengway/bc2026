import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { SkillCertificateResponse, SkillCertificateSlug } from "@/contracts";
import { readSessionCookie } from "@/modules/identity";
import { getRuntime } from "@/modules/runtime";
import { AppError } from "@/modules/shared";
import { mocksEnabled } from "./environment";

export const getPublicSkillCertificate = cache(async (slug: string) => {
  if (slug === "sample")
    return (await import("@/mocks/scenarios/skill-certificate"))
      .sampleSkillCertificate;

  if (mocksEnabled || !SkillCertificateSlug.safeParse(slug).success)
    return null;

  const app = getRuntime();
  const token = readSessionCookie((await cookies()).toString());
  const session = token ? await app.identity.getSession(token) : null;
  try {
    const certificate = await app.credentials.getSkillCertificateBySlug(
      slug,
      session?.user.id ?? null,
    );
    return SkillCertificateResponse.parse(certificate);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) return null;
    throw error;
  }
});
