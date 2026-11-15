"use client";

import { useRouter } from "next/navigation";
import type { GenerateCaseRequest, RecoverablePrep } from "@/contracts";
import { useCreateCase } from "./case-hooks";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/app/_lib/api";

export function practiceCaseHref(item: Pick<RecoverablePrep, "id" | "status">) {
  const review = item.status === "evaluated" || item.status === "evaluating";
  return `/${review ? "review" : "case"}/${item.id}`;
}

export function useRecoverablePrep() {
  return useQuery({
    queryKey: ["recoverable-prep"],
    queryFn: ({ signal }) => api.recoverablePrep(signal),
    staleTime: 30_000,
  });
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
