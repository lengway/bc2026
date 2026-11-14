"use client";

import Link from "next/link";
import { useIsMutating } from "@tanstack/react-query";
import { ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/ui/primitives/button";
import { cn } from "@/ui/lib/utils";
import { createCaseMutationKey, useSkillPath } from "../_hooks/case-hooks";
import { useLearningProfile } from "../_hooks/use-learning-profile";
import {
  practiceCaseHref,
  usePreparePracticeCase,
} from "../_hooks/use-prepare-practice-case";
import { ApiError } from "../_lib/api-client";

export function StartCaseButton({
  label = "Start case",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const path = useSkillPath();
  const profile = useLearningProfile();
  const create = usePreparePracticeCase();
  const preparing = useIsMutating({ mutationKey: createCaseMutationKey }) > 0;
  const daily = path.data?.today.daily;
  const href = daily
    ? practiceCaseHref(daily)
    : profile.data === null
      ? "/onboarding"
      : undefined;
  const buttonClass = cn("min-h-11", className);

  function start() {
    if (path.isError || profile.isError) {
      toast.error("Couldn’t check which case to open.", {
        description: "Please try again in a moment.",
      });
      if (path.isError) void path.refetch();
      if (profile.isError) void profile.refetch();
      return;
    }
    create.prepare({ type: "daily" }, (error) => {
      if (!(error instanceof ApiError) || error.code !== "PAYWALL")
        toast.error(error.message);
    });
  }

  if (href) {
    const isReview =
      daily?.status === "evaluating" || daily?.status === "evaluated";
    const actionLabel = isReview
      ? "Open review"
      : daily?.status === "in_progress"
        ? "Continue case"
        : label;
    const Icon = isReview ? ArrowRight : Plus;
    return (
      <Button asChild className={buttonClass}>
        <Link href={href}>
          <Icon aria-hidden="true" strokeWidth={1.5} />
          {actionLabel}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      className={buttonClass}
      disabled={path.isPending || profile.isPending || preparing}
      onClick={start}
    >
      <Plus aria-hidden="true" strokeWidth={1.5} />
      {create.isPending ? "Preparing…" : label}
    </Button>
  );
}
