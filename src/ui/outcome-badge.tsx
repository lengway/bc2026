import { CircleCheck, CircleDashed, CircleX, LogOut } from "lucide-react";
import { formatOutcome } from "@/ui/lib/format";
import { cn } from "@/ui/lib/utils";

type OutcomeBadgeProps = {
  /** Contract outcome: won | lost | left | incomplete. Unknown values render neutrally. */
  outcome: string;
  className?: string;
};

const OUTCOME_META: Record<string, { Icon: typeof CircleCheck; className: string }> = {
  won: { Icon: CircleCheck, className: "bg-label-best-soft text-label-best" },
  lost: { Icon: CircleX, className: "bg-label-blunder-soft text-label-blunder" },
  left: { Icon: LogOut, className: "bg-label-mistake-soft text-label-mistake" },
  incomplete: { Icon: CircleDashed, className: "bg-muted text-muted-foreground" },
};

/** How the case ended: Deal won, Deal lost, Client left. */
export function OutcomeBadge({ outcome, className }: OutcomeBadgeProps) {
  const meta = OUTCOME_META[outcome] ?? OUTCOME_META.incomplete;
  const { Icon } = meta;

  return (
    <span
      data-outcome={outcome}
      className={cn(
        "inline-flex h-7 w-fit items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap",
        meta.className,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
      {formatOutcome(outcome)}
    </span>
  );
}
