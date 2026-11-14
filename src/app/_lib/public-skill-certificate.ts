import "server-only";
import { cache } from "react";
import { SkillCertificateResponse, SkillCertificateSlug } from "@/contracts";
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
  try {
    const certificate = await app.credentials.getSkillCertificateBySlug(slug);
    return SkillCertificateResponse.parse(certificate);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) return null;
    throw error;
  }
});
