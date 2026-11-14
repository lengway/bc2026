import type { Metadata } from "next";
import { fontVariables } from "@/ui/fonts";
import { TooltipProvider } from "@/ui/primitives/tooltip";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "[PRODUCT]",
  description:
    "Work a real case, get a move-by-move review, and share a certificate an employer can verify.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
