"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "../_lib/api";
import { LoadingState } from "./providers";
import { ErrorPanel } from "./error-panel";
import { AuthenticatedShell } from "./authenticated-shell";

export function SessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => api.session(signal),
    retry: false,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (session.data === null) {
      const next = pathname + window.location.search + window.location.hash;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [session.data, router, pathname]);

  if (session.isError)
    return (
      <ErrorPanel error={session.error} retry={() => void session.refetch()} />
    );
  if (!session.data) return <LoadingState label="Checking your session…" />;
  return (
    <AuthenticatedShell pathname={pathname} user={session.data.user}>
      {children}
    </AuthenticatedShell>
  );
}
