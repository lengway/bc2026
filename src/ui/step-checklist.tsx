import { Check, LoaderCircle } from "lucide-react";
import { cn } from "@/ui/lib/utils";

export type ChecklistStep = {
  id: string;
  label: string;
  status: "pending" | "active" | "done";
  /** Optional second line, e.g. what is being generated. */
  detail?: string;
};

type StepChecklistProps = {
  steps: ReadonlyArray<ChecklistStep>;
  className?: string;
};

/** Calm progress for long waits ("Preparing your case"). No full-screen spinner. */
export function StepChecklist({ steps, className }: StepChecklistProps) {
  return (
    <ol
      aria-label="Progress"
      className={cn("m-0 flex list-none flex-col gap-4 p-0", className)}
    >
      {steps.map((step) => (
        <li
          key={step.id}
          aria-current={step.status === "active" ? "step" : undefined}
          data-status={step.status}
          className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-3"
        >
          <span
            aria-hidden="true"
            className={cn(
              "mt-0.5 inline-flex size-5 items-center justify-center rounded-md border",
              step.status === "done" && "border-ink bg-ink text-primary-foreground",
              step.status === "active" && "border-ink-border bg-ink-soft text-ink",
              step.status === "pending" && "border-border bg-surface",
            )}
          >
            {step.status === "done" ? <Check className="size-3" strokeWidth={2} /> : null}
            {step.status === "active" ? (
              <LoaderCircle className="size-3 animate-spin-slow" strokeWidth={2} />
            ) : null}
          </span>
          <span className="flex flex-col gap-0.5">
            <span
              className={cn(
                "text-sm transition-colors duration-200 ease-out",
                step.status === "pending" && "text-muted-foreground",
                step.status === "active" && "font-medium",
              )}
            >
              {step.label}
              <span className="sr-only">
                {step.status === "done"
                  ? " (done)"
                  : step.status === "active"
                    ? " (in progress)"
                    : " (waiting)"}
              </span>
            </span>
            {step.detail && step.status !== "pending" ? (
              <span className="text-xs text-muted-foreground">{step.detail}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}
