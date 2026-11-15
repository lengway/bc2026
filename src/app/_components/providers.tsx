"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Skeleton } from "@/ui/primitives/skeleton";
import { Button } from "@/ui/primitives/button";
import { makeQueryClient } from "../_lib/query-client";
import { mocksEnabled } from "../_lib/environment";
const PreviewContext = createContext({ ready: !mocksEnabled, failed: false });
const PreviewBootstrap = dynamic(() => import("@/mocks/bootstrap"), {
  ssr: false,
});

export function Providers({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState({
    ready: !mocksEnabled,
    failed: false,
  });
  const [focusHistory] = useState<{ last: HTMLElement | null }>(() => ({
    last: null,
  }));
  useEffect(() => {
    const remember = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target !== document.body)
        focusHistory.last = event.target;
    };
    document.addEventListener("focusin", remember);
    return () => document.removeEventListener("focusin", remember);
  }, [focusHistory]);
  const [paywall, setPaywall] = useState(false);
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null);
  const [client] = useState(() =>
    makeQueryClient(() => {
      if (
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== document.body
      )
        setReturnFocus(document.activeElement);
      else setReturnFocus(focusHistory.last);
      setPaywall(true);
    }),
  );
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={client}>
        <PreviewContext.Provider value={preview}>
          {mocksEnabled && <PreviewBootstrap onStateChange={setPreview} />}
          {children}
          <Dialog.Root open={paywall} onOpenChange={setPaywall}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
              <Dialog.Content
                className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-5 rounded-xl border bg-background p-6 shadow-raised"
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  returnFocus?.focus();
                }}
              >
                <Dialog.Title className="text-xl font-medium tracking-tight">
                  More room to practice
                </Dialog.Title>
                <Dialog.Description className="text-sm leading-relaxed text-muted-foreground">
                  Weekly cases and key moves on skill certificates are included
                  in Pro. Your free practice and results stay available.
                </Dialog.Description>
                <p>
                  <strong>$19 / month</strong> or $149 / year
                </p>
                <div className="flex flex-wrap gap-3">
                  <Dialog.Close asChild>
                    <Link
                      className="inline-flex h-11 items-center rounded-md bg-ink px-4 text-sm font-medium text-primary-foreground"
                      href="/pricing"
                    >
                      Compare plans
                    </Link>
                  </Dialog.Close>
                  <Dialog.Close className="inline-flex h-11 items-center rounded-md border px-4 text-sm font-medium">
                    Keep practicing free
                  </Dialog.Close>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </PreviewContext.Provider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
export function usePreviewStatus() {
  return useContext(PreviewContext);
}
export function ClientData({ children }: { children: ReactNode }) {
  const preview = usePreviewStatus();
  if (preview.failed)
    return (
      <section
        role="alert"
        className="mx-auto my-10 grid max-w-lg gap-4 rounded-xl border p-6"
      >
        <h2>We couldn&apos;t open the preview</h2>
        <p>Please reload to try again.</p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </section>
    );
  if (!preview.ready) return <LoadingState />;
  return children;
}
export function LoadingState({
  label = "Loading your workspace…",
}: {
  label?: string;
}) {
  return (
    <div role="status" className="mx-auto my-8 w-full max-w-5xl space-y-4 px-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-6 w-1/2" />
    </div>
  );
}
