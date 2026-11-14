import type { EventActor } from "@/contracts";
import { cn } from "@/ui/lib/utils";
import { PersonaAvatar } from "@/ui/persona-card";

type ChatMessageProps = {
  actor: EventActor;
  content: string;
  /** Display name. Required for `persona`; defaults to "You" / "Copilot". */
  authorName?: string;
  /** Pre-formatted time, e.g. "10:42". The container formats it. */
  timeLabel?: string;
  /** Optimistic message that the server has not confirmed yet. */
  pending?: boolean;
  className?: string;
};

const DEFAULT_NAME: Record<EventActor, string> = {
  user: "You",
  persona: "Counterpart",
  copilot: "Copilot",
  system: "System",
};

/** One message in the case conversation or in the copilot panel. */
export function ChatMessage({
  actor,
  content,
  authorName,
  timeLabel,
  pending = false,
  className,
}: ChatMessageProps) {
  const name = authorName ?? DEFAULT_NAME[actor];

  if (actor === "system") {
    return (
      <p
        className={cn(
          "m-0 flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border",
          className,
        )}
      >
        {content}
      </p>
    );
  }

  const isUser = actor === "user";

  return (
    <div
      data-actor={actor}
      className={cn(
        "flex items-start gap-3",
        isUser && "flex-row-reverse",
        pending && "opacity-60",
        className,
      )}
    >
      {actor === "persona" ? <PersonaAvatar name={name} /> : null}
      {actor === "copilot" ? (
        <span
          aria-hidden="true"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-ink-border bg-ink-soft font-mono text-[10px] font-medium text-ink"
        >
          AI
        </span>
      ) : null}

      <div className={cn("flex max-w-[min(34rem,85%)] flex-col gap-1", isUser && "items-end")}>
        <p className="m-0 flex items-baseline gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{name}</span>
          {timeLabel ? <span className="font-mono tabular-nums">{timeLabel}</span> : null}
          {pending ? <span>Sending</span> : null}
        </p>
        <p
          className={cn(
            "m-0 rounded-lg border px-3.5 py-2.5 text-[15px] leading-normal whitespace-pre-line",
            isUser ? "border-ink-border bg-ink-soft" : "bg-card",
          )}
        >
          {content}
        </p>
      </div>
    </div>
  );
}
