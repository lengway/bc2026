import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon. Same geometry as src/ui/brand.tsx, scaled; iOS rounds the corners itself. */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#1b2a5c",
      }}
    >
      <svg width="180" height="180" viewBox="0 0 32 32">
        <path
          d="M11 23V10h10"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="11"
          cy="23"
          r="2.6"
          fill="#1b2a5c"
          stroke="#ffffff"
          strokeWidth="2"
        />
        <circle cx="21" cy="10" r="3" fill="#ffffff" />
      </svg>
    </div>,
    size,
  );
}
