import type { Metadata } from "next";
import { fontVariables } from "@/ui/fonts";
import { TooltipProvider } from "@/ui/primitives/tooltip";
import { Toaster } from "@/ui/primitives/sonner";
import { Providers } from "@/app/_components/providers";
import { mocksEnabled } from "@/app/_lib/environment";
import { noIndex, publicOrigin } from "@/app/_lib/seo";
import "@/app/globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(publicOrigin),
  title: { default: "Gambit", template: "%s · Gambit" },
  robots: noIndex,
  description:
    "Practice realistic work conversations. Review your decisions and share a recorded simulation.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontVariables} min-h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        <TooltipProvider>
          <Providers>
            {mocksEnabled && (
              <div
                role="note"
                className="border-b bg-surface px-4 py-2 text-center font-mono text-[11px] text-muted-foreground"
              >
                Interactive preview · Fictional scenarios and sample results
              </div>
            )}
            {children}
            <Toaster />
          </Providers>
        </TooltipProvider>
      </body>
    </html>
  );
}
