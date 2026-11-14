"use client";

import { Hash, Mail, MessageSquare } from "lucide-react";
import { cn } from "@/ui/lib/utils";
import { Button } from "@/ui/primitives/button";

type TwistKind = "email" | "slack" | "persona_message";

type TwistNoticeProps = {
  kind: TwistKind;
  /** Sender, e.g. "Marcus Reyes, CFO". */
  from: string;
  content: string;
  /** Pre-formatted time, e.g. "10:47". */
  timeLabel?: string;
  /** Opens the new document. Omit when there is nothing to open. */
  onOpen?: () => void;
  className?: string;
};

const KIND_META: Record<TwistKind, { title: string; Icon: typeof Mail }> = {
  email: { title: "New email", Icon: Mail },
  slack: { title: "New Slack message", Icon: Hash },
  persona_message: { title: "New message", Icon: MessageSquare },
};

/** A plot twist arriving mid-case, shown as incoming work, not as a game event. */
export function TwistNotice({
  kind,
  from,
  content,
  timeLabel,
  onOpen,
  className,
}: TwistNoticeProps) {
  const { title, Icon } = KIND_META[kind];

  return (
    <aside
      role="status"
      aria-label={`${title} from ${from}`}
      className={cn(
        "flex items-start gap-3 rounded-lg border border-ink-border bg-ink-soft px-4 py-3",
        className,
      )}
    >
      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-ink text-primary-foreground">
        <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium">{title}</span>
          <span className="text-muted-foreground">from {from}</span>
          {timeLabel ? (
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {timeLabel}
            </span>
          ) : null}
        </p>
        <p className="m-0 mt-1 line-clamp-2 text-sm leading-relaxed">{content}</p>
      </div>
      {onOpen ? (
        <Button variant="outline" size="sm" onClick={onOpen} className="shrink-0">
          Open
        </Button>
      ) : null}
    </aside>
  );
}
