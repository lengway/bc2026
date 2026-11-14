import type { MoveLabel } from "@/contracts";
import { cn } from "@/ui/lib/utils";
import { MOVE_LABEL_META } from "@/ui/move-labels";

type MoveLabelBadgeProps = {
  label: MoveLabel | null;
  /** `full` shows glyph and name, `glyph` only the glyph (name stays in aria-label). */
  variant?: "full" | "glyph";
  size?: "sm" | "md";
  className?: string;
};

/** The label of a reviewed move. Color is never the only signal: the glyph is always shown. */
export function MoveLabelBadge({
  label,
  variant = "full",
  size = "md",
  className,
}: MoveLabelBadgeProps) {
  const meta = label === null ? {
    name: "Unassessed",
    glyph: "?",
    badgeClassName: "bg-muted text-muted-foreground",
  } : MOVE_LABEL_META[label];

  return (
    <span
      role="img"
      aria-label={`${meta.name} move`}
      title={label === null ? "Unassessed: insufficient evidence" : undefined}
      data-label={label ?? "unassessed"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap",
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2.5 py-1 text-[13px]",
        variant === "glyph" && (size === "sm" ? "min-w-7" : "min-w-9"),
        meta.badgeClassName,
        className,
      )}
    >
      <span aria-hidden="true" className="font-mono">
        {meta.glyph}
      </span>
      {variant === "full" ? <span aria-hidden="true">{meta.name}</span> : null}
    </span>
  );
}
