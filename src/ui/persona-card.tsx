import { MapPin } from "lucide-react";
import type { PersonaPublic } from "@/contracts";
import { initials } from "@/ui/lib/format";
import { cn } from "@/ui/lib/utils";

type PersonaAvatarProps = {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const AVATAR_SIZE = {
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-11 text-sm",
} as const;

/** Initials tile. No photos: personas are generated, and stock faces would look fake. */
export function PersonaAvatar({ name, size = "md", className }: PersonaAvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border bg-surface font-semibold text-muted-foreground select-none",
        AVATAR_SIZE[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

type PersonaCardProps = {
  persona: PersonaPublic;
  /** `compact` drops the context paragraph, for headers and sidebars. */
  variant?: "full" | "compact";
  className?: string;
};

/** Who the user is about to talk to. */
export function PersonaCard({ persona, variant = "full", className }: PersonaCardProps) {
  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <PersonaAvatar name={persona.name} />
        <div className="min-w-0">
          <p className="m-0 truncate text-sm font-medium">{persona.name}</p>
          <p className="m-0 truncate text-xs text-muted-foreground">
            {persona.role} · {persona.company}
          </p>
        </div>
      </div>
    );
  }

  return (
    <article
      aria-label={persona.name}
      className={cn("rounded-xl border bg-card p-5 text-card-foreground", className)}
    >
      <div className="flex items-start gap-4">
        <PersonaAvatar name={persona.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-base font-medium">{persona.name}</h3>
          <p className="m-0 text-sm text-muted-foreground">
            {persona.role} · {persona.company}
          </p>
          <p className="m-0 mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
            {persona.location}
          </p>
        </div>
      </div>
      <p className="m-0 mt-4 border-t pt-4 text-sm leading-relaxed">{persona.context}</p>
    </article>
  );
}
