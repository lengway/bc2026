import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

/** Interface text. */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/** Numbers, IDs, timers — always with `tabular-nums`. */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Display only: landing headline and the certificate. */
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

/** Put this on <html> so `font-sans`, `font-mono` and `font-serif` resolve. */
export const fontVariables = [
  geistSans.variable,
  geistMono.variable,
  instrumentSerif.variable,
].join(" ");
