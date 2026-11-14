import { firstName } from "@/ui/lib/format";
import { cn } from "@/ui/lib/utils";
import { PersonaAvatar } from "@/ui/persona-card";

type TypingIndicatorProps = {
  /** Who is typing, e.g. "Dana Whitfield". */
  name: string;
  className?: string;
};

const DOT_DELAYS = ["0ms", "150ms", "300ms"];

/** "Dana is typing" — three quiet dots. Static when reduced motion is requested. */
export function TypingIndicator({ name, className }: TypingIndicatorProps) {
  return (
    <div role="status" className={cn("flex items-center gap-3", className)}>
      <PersonaAvatar name={name} />
      <span className="sr-only">{firstName(name)} is typing</span>
      <span
        aria-hidden="true"
        className="inline-flex h-9 items-center gap-1 rounded-lg border bg-card px-3.5"
      >
        {DOT_DELAYS.map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-typing-dot rounded-full bg-muted-foreground"
            style={{ animationDelay: delay }}
          />
        ))}
      </span>
    </div>
  );
}
