import Link from "next/link";
import { GambitLogo } from "@/ui/brand";
import { ThemeToggle } from "@/ui/theme-toggle";
import { ArrowRight } from "lucide-react";
import { Button } from "@/ui/primitives/button";
import { cn } from "@/ui/lib/utils";
import type { ReactNode } from "react";

export const inputClass =
  "flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";
export const labelClass = "mb-2 block text-sm font-medium";
export function Surface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 sm:p-6", className)}>
      {children}
    </section>
  );
}
export function PageHeading({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-2xl space-y-3">
        {eyebrow && (
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
          {title}
        </h1>
        {children && (
          <div className="text-sm leading-relaxed text-muted-foreground">
            {children}
          </div>
        )}
      </div>
      {action}
    </header>
  );
}
function ProductHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Link
          href="/"
          aria-label="Gambit home"
          className="inline-flex min-h-11 items-center"
        >
          <GambitLogo />
        </Link>
        <nav
          aria-label="Main navigation"
          className="flex items-center gap-1 sm:gap-3"
        >
          <ThemeToggle />
          <Button asChild variant="ghost">
            <Link href="/pricing">Plans</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/login?account=1">
              Sign in
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
      <ProductHeader />
      {children}
      <footer className="mx-auto mt-auto w-full max-w-7xl border-t px-4 py-6 text-xs text-muted-foreground sm:px-8">
        Recorded practice. Clearer next steps.
      </footer>
    </>
  );
}
