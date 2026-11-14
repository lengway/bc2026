import type { Metadata } from "next";
import Link from "next/link";
import { Providers } from "@/app/_components/providers";
import { mocksEnabled } from "@/app/_lib/environment";
import "@/app/base.css";
export const metadata: Metadata = {
  title: { default: "Work practice", template: "%s · Work practice" },
  description: "Practice real work conversations and learn from each move.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <header className="site-header">
          <div className="header-inner">
            <Link href="/" className="wordmark">
              Work practice
            </Link>
            <nav aria-label="Main navigation">
              <Link href="/dashboard">Practice</Link>
              <Link href="/path">Your progress</Link>
              <Link href="/pricing">Plans</Link>
              <Link href="/login">Sign in</Link>
            </nav>
          </div>
        </header>
        {mocksEnabled && (
          <div className="preview-label">
            Interactive preview · Fictional scenarios and sample results
          </div>
        )}
        <Providers>
          <main id="main">{children}</main>
        </Providers>
        <footer className="muted">
          A little practice. A clearer next move.
        </footer>
      </body>
    </html>
  );
}
