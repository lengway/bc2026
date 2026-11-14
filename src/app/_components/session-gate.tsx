"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../_lib/api";
import { LoadingState } from "./providers";
import { ErrorPanel } from "./error-panel";
export function SessionGate({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const router = useRouter();
  const path = usePathname();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => api.session(signal),
    retry: false,
    refetchInterval: 60_000,
  });
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      client.clear();
      router.replace("/login");
      router.refresh();
    },
  });
  useEffect(() => {
    if (session.data === null)
      router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [session.data, router, path]);
  if (session.isError)
    return (
      <ErrorPanel error={session.error} retry={() => void session.refetch()} />
    );
  if (session.isPending || !session.data || logout.isSuccess)
    return <LoadingState label="Checking your session…" />;
  return (
    <div className="stack">
      <div className="actions">
        <span className="muted">{session.data.user.displayName}</span>
        <button
          className="secondary"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          Sign out
        </button>
      </div>
      {logout.isError && <ErrorPanel error={logout.error} />}
      {children}
    </div>
  );
}
