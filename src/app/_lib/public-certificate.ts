import "server-only";
import { cache } from "react";
import { Certificate, CertificateSlug } from "@/contracts";
import { apiClient, ApiError } from "./api-client";
import { mocksEnabled } from "./environment";
export const getPublicCertificate = cache(async (slug: string) => {
  if (slug === "sample" || slug === "sample-full") {
    const samples = await import("@/app/(design)/design/fixtures");
    return Certificate.parse({
      ...samples[slug === "sample" ? "certificateLimited" : "certificateFull"],
    });
  }
  if (mocksEnabled) {
    if (slug === "preview-certificate")
      return Certificate.parse(
        (await import("@/mocks/scenarios/sales")).previewCertificate,
      );
    return null; // Browser-local MSW records cannot be read by a server or a link crawler.
  }
  if (!CertificateSlug.safeParse(slug).success) return null;
  const configured = process.env.APP_URL;
  if (!configured)
    throw new ApiError(
      "UNAVAILABLE",
      "Case records are temporarily unavailable.",
    );
  try {
    return await apiClient(
      new URL(
        `/api/certificates/${encodeURIComponent(slug)}`,
        new URL(configured).origin,
      ).href,
      Certificate,
      { credentials: "omit" },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});
