import type { Metadata } from "next";
import { fontVariables } from "@/ui/fonts";
import { TooltipProvider } from "@/ui/primitives/tooltip";
import { Toaster } from "@/ui/primitives/sonner";
import { Providers } from "@/app/_components/providers";
import { mocksEnabled } from "@/app/_lib/environment";
import "@/app/globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://127.0.0.1:3000"),
  title: { default: "Work practice", template: "%s · Work practice" },
  description:
    "Practice realistic work conversations. Review your decisions and share a recorded simulation.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fontVariables} min-h-full antialiased`}>
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
