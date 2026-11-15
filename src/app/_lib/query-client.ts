import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError, isTransientApiError } from "./api-client";
export function makeQueryClient(onPaywall: () => void) {
  const handleError = (error: Error) => {
    if (error instanceof ApiError && error.code === "PAYWALL") onPaywall();
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        retry: (count, error) => count < 1 && isTransientApiError(error),
      },
      mutations: { retry: false },
    },
  });
}
