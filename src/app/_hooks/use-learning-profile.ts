"use client";

import { useQuery } from "@tanstack/react-query";
import { Profile } from "@/contracts";
import { apiClient } from "@/app/_lib/api-client";

export const learningProfileKey = ["learning-profile"] as const;

export function useLearningProfile(enabled = true) {
  return useQuery({
    enabled,
    queryKey: learningProfileKey,
    queryFn: ({ signal }) =>
      apiClient("/api/intake", Profile.nullable(), { signal }),
  });
}
