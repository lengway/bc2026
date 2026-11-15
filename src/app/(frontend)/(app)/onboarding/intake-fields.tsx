import { Check } from "lucide-react";
import { useId } from "react";
import { cn } from "@/ui/lib/utils";
import { FOCUS_AREAS, type FocusArea } from "@/contracts";
import { FOCUS_CHOICES, MAX_FOCUS } from "./intake";

export function Question({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-3 grid gap-1">
        <span className="text-sm font-medium">{title}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

export function Choice({
  name,
  checked,
  onChange,
  label,
  detail,
  disabled,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  detail?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const detailId = `${id}-detail`;

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors duration-150 ease-out",
        disabled
          ? "cursor-not-allowed bg-surface text-muted-foreground"
          : "cursor-pointer hover:border-border-strong",
        checked && "border-ink bg-ink-soft hover:border-ink",
      )}
    >
      <input
        id={id}
        type="radio"
        name={name}
        aria-labelledby={labelId}
        aria-describedby={detail ? detailId : undefined}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="size-4 shrink-0 accent-ink"
      />
      <span className="grid gap-0.5">
        <span id={labelId} className="font-medium">
          {label}
        </span>
        {detail && (
          <span id={detailId} className="text-xs text-muted-foreground">
            {detail}
          </span>
        )}
      </span>
    </label>
  );
}

export function FocusChips({
  selected,
  blocked,
  onToggle,
  label,
}: {
  selected: FocusArea[];
  blocked: FocusArea[];
  onToggle: (area: FocusArea) => void;
  label: string;
}) {
  const full = selected.length >= MAX_FOCUS;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {FOCUS_CHOICES.map((area) => {
        const on = selected.includes(area);
        const disabled = !on && (full || blocked.includes(area));
        return (
          <button
            key={area}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(area)}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm outline-none transition-colors duration-150 ease-out",
              "focus-visible:ring-2 focus-visible:ring-ring",
              on
                ? "border-ink bg-ink text-primary-foreground"
                : "bg-card hover:border-border-strong",
              disabled && "cursor-not-allowed opacity-45 hover:border-border",
            )}
          >
            {on && (
              <Check aria-hidden="true" className="size-3.5" strokeWidth={2} />
            )}
            {FOCUS_AREAS[area].label}
          </button>
        );
      })}
    </div>
  );
}
