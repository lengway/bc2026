"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../_lib/api";
import { LoadingState } from "./providers";
import { ErrorPanel } from "./error-panel";
import { ProductHeader } from "./product";
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
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:p-4">
        Skip to content
      </a>
      <ProductHeader
        name={session.data.user.displayName ?? session.data.user.email}
        active={path}
        onLogout={() => logout.mutate()}
        pending={logout.isPending}
      />
      {logout.isError && <ErrorPanel error={logout.error} />}
      <div id="main" className="flex flex-1 flex-col">
        {children}
      </div>
    </>
  );
}
