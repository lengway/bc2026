"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { CircleArrowUp } from "lucide-react";
import type { SessionUser } from "@/contracts/auth";
import { AppShell } from "@/ui/app-shell";
import { GambitLogo } from "@/ui/brand";
import { Button } from "@/ui/primitives/button";
import { Skeleton } from "@/ui/primitives/skeleton";
import { ThemeToggle } from "@/ui/theme-toggle";
import { useCase } from "../_hooks/case-hooks";
import { useBillingSummary } from "../_hooks/use-billing-summary";
import { appBreadcrumbs } from "./app-navigation";
import { StartCaseButton } from "./start-case-button";
import { ProfileMenu, VerifyEmailBanner } from "./profile-menu";

const sidebarStorageKey = "gambit.sidebar.collapsed";
const sidebarListeners = new Set<() => void>();
let sidebarPreference: boolean | undefined;

function readSidebarPreference() {
  try {
    return localStorage.getItem(sidebarStorageKey) === "1";
  } catch {
    return sidebarPreference ?? false;
  }
}

function subscribeToSidebar(listener: () => void) {
  sidebarListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === sidebarStorageKey || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    sidebarListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function toggleSidebar() {
  const collapsed = !readSidebarPreference();
  try {
    localStorage.setItem(sidebarStorageKey, collapsed ? "1" : "0");
  } catch {
    sidebarPreference = collapsed;
  }
  for (const listener of sidebarListeners) listener();
}

const renewalDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function SidebarPlan({
  billing,
  collapsed,
}: {
  billing: ReturnType<typeof useBillingSummary>;
  collapsed: boolean;
}) {
  if (!billing.data) {
    if (billing.isPending) return <Skeleton className="h-11 w-full" />;
    return (
      <Button asChild variant="ghost" className="min-h-11 w-full">
        <Link href="/settings/billing" aria-label="Plan and billing">
          {collapsed ? <CircleArrowUp aria-hidden="true" /> : "Plan & billing"}
        </Link>
      </Button>
    );
  }

  const { plan, periodEnd, freeDailyRemaining } = billing.data;
  const label = plan === "pro" ? "Pro" : "Free";
  if (collapsed)
    return (
      <Button asChild variant="ghost" className="size-11 px-0">
        <Link href="/settings/billing" aria-label={`${label} plan and billing`}>
          {label}
        </Link>
      </Button>
    );
  return (
    <div className="space-y-1 rounded-lg border bg-card px-3 py-2 text-sm">
      <p className="font-medium">
        {label}
        {plan === "pro" && periodEnd && (
          <span className="font-normal text-muted-foreground">
            {" · Renews "}
            {renewalDate.format(new Date(periodEnd))}
          </span>
        )}
      </p>
      {plan === "free" && (
        <>
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-mono tabular-nums">
              {freeDailyRemaining} of 1
            </span>{" "}
            free daily cases available · 7-day limit
          </p>
          <Button asChild variant="link" size="sm" className="min-h-8 px-0">
            <Link href="/settings/billing">Upgrade</Link>
          </Button>
        </>
      )}
    </div>
  );
}

function ProductShell({
  pathname,
  caseTitle,
  user,
  children,
}: {
  pathname: string;
  caseTitle?: string;
  user: SessionUser;
  children: ReactNode;
}) {
  const collapsed = useSyncExternalStore(
    subscribeToSidebar,
    readSidebarPreference,
    () => false,
  );
  const billing = useBillingSummary();

  return (
    <AppShell
      pathname={pathname}
      breadcrumbs={appBreadcrumbs(pathname, caseTitle)}
      collapsed={collapsed}
      onToggleSidebar={toggleSidebar}
      plan={<SidebarPlan billing={billing} collapsed={collapsed} />}
      actions={
        <>
          {!pathname.startsWith("/case/") && <StartCaseButton />}
          <ThemeToggle className="hidden size-11 lg:inline-flex" />
          <ProfileMenu user={user} plan={billing.data?.plan} />
        </>
      }
      banner={<VerifyEmailBanner user={user} />}
    >
      {children}
    </AppShell>
  );
}

export function AuthenticatedShell({
  children,
  pathname,
  user,
}: {
  children: ReactNode;
  pathname: string;
  user: SessionUser;
}) {
  const [, section, caseId] = pathname.split("/");
  const onCase = section === "case";
  const onboarding = section === "onboarding";
  const current = useCase(
    onCase || section === "review" ? (caseId ?? "") : "",
    false,
  );
  const view = current.data;
  const standalone =
    onboarding ||
    (onCase && (current.isPending || view?.status === "in_progress"));

  if (standalone)
    return (
      <>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:p-3 focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        {onboarding && (
          <header className="flex h-14 items-center justify-between gap-2 border-b px-4 sm:px-8">
            <Link
              href="/dashboard"
              aria-label="Gambit home"
              className="flex min-h-11 items-center rounded-md focus-visible:ring-2 focus-visible:ring-ring"
            >
              <GambitLogo size="sm" />
            </Link>
            <ThemeToggle className="size-11" />
          </header>
        )}
        <div
          id="main"
          tabIndex={-1}
          className="flex flex-1 flex-col outline-none"
        >
          {children}
        </div>
      </>
    );
  return (
    <ProductShell
      pathname={pathname}
      caseTitle={view && "brief" in view ? view.brief.title : undefined}
      user={user}
    >
      {children}
    </ProductShell>
  );
}
