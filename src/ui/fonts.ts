import localFont from "next/font/local";

const geist = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

/** Apply on the root element so all typography tokens can use Geist. */
export const fontVariables = geist.variable;
