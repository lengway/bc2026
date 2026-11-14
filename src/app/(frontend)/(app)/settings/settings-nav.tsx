"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ChevronRight,
  CreditCard,
  Shield,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/ui/lib/utils";

const settings = [
  { path: "/settings/learning", title: "My learning", icon: BookOpen },
  { path: "/settings/account", title: "Account", icon: UserRound },
  { path: "/settings/billing", title: "Plan & billing", icon: CreditCard },
  { path: "/settings/privacy", title: "Privacy & data", icon: Shield },
];

export function SettingsNav({ children }: { children: ReactNode }) {
  const path = usePathname();
  const index = path === "/settings";
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-8 sm:py-8 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] md:gap-8">
      <nav
        aria-label="Settings sections"
        className={cn("min-w-0 space-y-3 md:block", !index && "hidden")}
      >
        {index ? (
          <h1 className="text-2xl font-medium tracking-tight md:hidden">
            Settings
          </h1>
        ) : null}
        <p
          aria-hidden="true"
          className="hidden px-2 font-mono text-xs uppercase tracking-wider text-muted-foreground md:block"
        >
          Settings
        </p>
        <ul className="grid gap-1 max-md:rounded-xl max-md:border max-md:bg-card max-md:p-2">
          {settings.map(({ title, path: href, icon: Icon }) => {
            const active =
              path === href || (index && href.endsWith("/learning"));
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={path === href ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-md px-2.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                    active && "md:bg-ink-soft md:font-medium md:text-ink",
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className="size-4 shrink-0"
                    strokeWidth={1.5}
                  />
                  {title}
                  <ChevronRight
                    aria-hidden="true"
                    className="ml-auto size-4 text-muted-foreground md:hidden"
                    strokeWidth={1.5}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className={cn("min-w-0 space-y-5 md:block", index && "hidden")}>
        {!index && (
          <Link
            href="/settings"
            className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            All settings
          </Link>
        )}
        {children}
      </div>
    </main>
  );
}
