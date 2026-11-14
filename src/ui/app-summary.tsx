import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "./lib/utils";

export function StatCard({
  label,
  value,
  detail,
  action,
  graphic,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
  graphic?: ReactNode;
}) {
  return (
    <article className="flex min-h-28 min-w-0 flex-col justify-between gap-2 rounded-xl border bg-card p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
        {action}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-2xl tracking-tight tabular-nums">
          {value ?? <span aria-label="No data">—</span>}
        </p>
        {graphic}
      </div>
      {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
    </article>
  );
}

export function SectionHeader({
  title,
  link,
  actions,
  className,
}: {
  title: string;
  link?: { href: string; label: string };
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1",
        className,
      )}
    >
      <h2 className="text-base font-medium tracking-tight">{title}</h2>
      <div className="flex items-center gap-2">
        {actions}
        {link && (
          <Link
            href={link.href}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {link.label}
            <ArrowRight
              className="size-4"
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </Link>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
