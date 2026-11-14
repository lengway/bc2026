import { cn } from "@/ui/lib/utils";

/**
 * Gambit mark: a knight's move on an ink tile. An open ring marks the start square,
 * a solid dot the destination: the whole product is about reviewing moves.
 * Geometry is shared with src/app/icon.svg and src/app/apple-icon.tsx; keep them in sync.
 */
export const MARK_PATH = "M11 23V10h10";

export function GambitMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("size-6 shrink-0", className)}
    >
      <rect width="32" height="32" rx="7" className="fill-ink" />
      <path
        d={MARK_PATH}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
      />
      <circle cx="11" cy="23" r="2.6" strokeWidth="2" className="fill-ink stroke-primary-foreground" />
      <circle cx="21" cy="10" r="3" className="fill-primary-foreground" />
    </svg>
  );
}

/** Mark + wordmark. The wordmark uses the certificate serif. */
export function GambitLogo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <GambitMark className={size === "sm" ? "size-5" : "size-6"} />
      <span
        className={cn(
          "font-serif leading-none tracking-tight text-foreground",
          size === "sm" ? "text-xl" : "text-2xl",
        )}
      >
        Gambit
      </span>
    </span>
  );
}
