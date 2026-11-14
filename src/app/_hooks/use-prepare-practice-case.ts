"use client";

import { useRouter } from "next/navigation";
import type { CaseView, GenerateCaseRequest } from "@/contracts";
import { useCreateCase } from "./case-hooks";

export function practiceCaseHref(item: Pick<CaseView, "id" | "status">) {
  const review = item.status === "evaluated" || item.status === "evaluating";
  return `/${review ? "review" : "case"}/${item.id}`;
}

export function usePreparePracticeCase() {
  const router = useRouter();
  const create = useCreateCase();

  function prepare(
    input: GenerateCaseRequest,
    onError?: (error: Error) => void,
  ) {
    create.mutate(input, {
      onError,
      onSuccess: ({ caseId }) => {
        const params = new URLSearchParams({ type: input.type });
        if (input.skill) params.set("skill", input.skill);
        router.push(`/case/${caseId}?${params}`);
      },
    });
  }

  return { ...create, prepare };
}
