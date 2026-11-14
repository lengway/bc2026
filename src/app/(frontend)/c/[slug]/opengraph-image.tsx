import { ImageResponse } from "next/og";
import { getPublicCertificate } from "@/app/_lib/public-certificate";
export const alt =
  "Recorded work simulation — assessment coverage and limitations available in the case record";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const certificate = await getPublicCertificate(slug).catch(() => null);
  // A narrow public projection only. Never import an owner review or its diagnostics here.
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        background: "#ffffff",
        color: "#18181b",
        padding: 64,
        fontFamily: "sans-serif",
        border: "16px solid #e4e4e7",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 22,
          color: "#1b2a5c",
        }}
      >
        <span>GAMBIT</span>
        <span>CASE RECORD</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <span style={{ fontSize: 50 }}>
          {certificate?.holderName ?? "A record of practice"}
        </span>
        <span style={{ fontSize: 30, color: "#71717a" }}>
          {certificate?.caseTitle.slice(0, 100) ?? "A timed work simulation"}
        </span>
        <span style={{ fontSize: 38 }}>
          {certificate
            ? certificate.accuracy === null
              ? "Not enough evidence"
              : `${certificate.accuracy}% case accuracy`
            : "View the case record for details"}
        </span>
      </div>
      <div style={{ display: "flex", fontSize: 20, color: "#71717a" }}>
        AI help permitted · Scope and assessment coverage in the case record
      </div>
    </div>,
    size,
  );
}
