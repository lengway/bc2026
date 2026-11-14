"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Award,
  History,
  House,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
} from "lucide-react";
import { GambitLogo, GambitMark } from "./brand";
import { cn } from "./lib/utils";
import { Button } from "./primitives/button";

export const APP_NAVIGATION = [
  { href: "/dashboard", label: "Home", Icon: House },
  { href: "/path", label: "Skills", Icon: Route },
  { href: "/history", label: "History", Icon: History },
  { href: "/certificates", label: "Certificates", Icon: Award },
] as const;

export type AppBreadcrumb = { label: string; href?: string };

function Navigation({
  pathname,
  mobile,
  collapsed,
}: {
  pathname: string;
  mobile?: boolean;
  collapsed?: boolean;
}) {
  return (
    <nav
      aria-label={mobile ? "Mobile navigation" : "Main navigation"}
      className={
        mobile ? "grid grid-cols-4 gap-1 px-2 pt-1" : "grid gap-1 px-2"
      }
    >
      {APP_NAVIGATION.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            title={collapsed ? label : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
              mobile
                ? "flex-col justify-center gap-0.5 py-1 text-[0.6875rem]"
                : collapsed
                  ? "justify-center"
                  : "px-3",
              active && "bg-ink-soft text-ink",
            )}
          >
            <Icon
              className="size-[18px] shrink-0"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            {(mobile || !collapsed) && <span>{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  pathname,
  children,
  breadcrumbs = [],
  actions,
  plan,
  banner,
  collapsed = false,
  onToggleSidebar,
}: {
  pathname: string;
  children: ReactNode;
  breadcrumbs?: AppBreadcrumb[];
  actions?: ReactNode;
  plan?: ReactNode;
  banner?: ReactNode;
  collapsed?: boolean;
  onToggleSidebar?: () => void;
}) {
  return (
    <div
      className={cn(
        "min-h-dvh lg:grid",
        collapsed
          ? "lg:grid-cols-[64px_minmax(0,1fr)]"
          : "lg:grid-cols-[240px_minmax(0,1fr)]",
      )}
    >
      <a
        href="#app-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:p-3 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh min-h-0 flex-col overflow-y-auto border-r bg-surface lg:flex">
        <div
          className={cn(
            "flex min-h-14 items-center",
            collapsed ? "justify-center" : "px-4",
          )}
        >
          <Link
            href="/dashboard"
            aria-label="Gambit home"
            className="flex min-h-11 items-center rounded-md focus-visible:ring-2 focus-visible:ring-ring"
          >
            {collapsed ? <GambitMark /> : <GambitLogo size="sm" />}
          </Link>
        </div>
        <Navigation pathname={pathname} collapsed={collapsed} />
        <div className="mt-auto space-y-2 p-2">
          {plan}
          {onToggleSidebar && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11"
              onClick={onToggleSidebar}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen aria-hidden="true" strokeWidth={1.5} />
              ) : (
                <PanelLeftClose aria-hidden="true" strokeWidth={1.5} />
              )}
            </Button>
          )}
        </div>
      </aside>
      <div className="min-w-0 pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b bg-background px-4 lg:px-8">
          <Link
            href="/dashboard"
            aria-label="Gambit home"
            className="flex min-h-11 items-center rounded-md focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          >
            <GambitLogo size="sm" />
          </Link>
          <nav
            aria-label="Breadcrumb"
            className="hidden min-w-0 items-center gap-2 text-sm text-muted-foreground lg:flex"
          >
            {breadcrumbs.map(({ label, href }, index) => (
              <span key={index} className="flex min-w-0 items-center gap-2">
                {index > 0 && <span aria-hidden="true">/</span>}
                {href ? (
                  <Link
                    className="truncate rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                    href={href}
                  >
                    {label}
                  </Link>
                ) : (
                  <span
                    className="truncate font-medium text-foreground"
                    aria-current="page"
                  >
                    {label}
                  </span>
                )}
              </span>
            ))}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            {actions}
          </div>
        </header>
        {banner}
        <div id="app-content" tabIndex={-1} className="outline-none">
          {children}
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden">
        <Navigation pathname={pathname} mobile />
      </div>
    </div>
  );
}
