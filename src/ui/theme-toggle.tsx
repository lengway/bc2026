"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/ui/lib/utils";

const ORDER = ["system", "light", "dark"] as const;
type ThemeChoice = (typeof ORDER)[number];

const META: Record<ThemeChoice, { label: string; Icon: typeof Sun }> = {
  system: { label: "Theme: system", Icon: Monitor },
  light: { label: "Theme: light", Icon: Sun },
  dark: { label: "Theme: dark", Icon: Moon },
};

/** Cycles system → light → dark. Renders a stable placeholder until mounted to avoid a hydration mismatch. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard next-themes mount guard
  useEffect(() => setMounted(true), []);

  const current: ThemeChoice = mounted && ORDER.includes(theme as ThemeChoice) ? (theme as ThemeChoice) : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const { label, Icon } = META[current];

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`${label}. Switch to ${next}.`}
      title={label}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground outline-none",
        "transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={1.5} />
    </button>
  );
}
