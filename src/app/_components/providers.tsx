"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import dynamic from "next/dynamic";
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
  const [paywall, setPaywall] = useState(false);
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null);
  const [client] = useState(() =>
    makeQueryClient(() => {
      if (document.activeElement instanceof HTMLElement)
        setReturnFocus(document.activeElement);
      setPaywall(true);
    }),
  );
  return (
    <QueryClientProvider client={client}>
      <PreviewContext.Provider value={preview}>
        {mocksEnabled && <PreviewBootstrap onStateChange={setPreview} />}
        {children}
        <Dialog.Root open={paywall} onOpenChange={setPaywall}>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" />
            <Dialog.Content
              className="dialog-content"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                returnFocus?.focus();
              }}
            >
              <Dialog.Title>More room to practice</Dialog.Title>
              <Dialog.Description>
                Weekly cases and full certificates are included in Pro. Your
                free practice and results stay available.
              </Dialog.Description>
              <p>
                <strong>$19 / month</strong> or $149 / year
              </p>
              <div className="actions">
                <Dialog.Close asChild>
                  <Link className="button" href="/pricing">
                    Compare plans
                  </Link>
                </Dialog.Close>
                <Dialog.Close className="button secondary">
                  Keep practicing free
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </PreviewContext.Provider>
    </QueryClientProvider>
  );
}
export function ClientData({ children }: { children: ReactNode }) {
  const preview = useContext(PreviewContext);
  if (preview.failed)
    return (
      <section role="alert" className="panel">
        <h2>We couldn&apos;t open the preview</h2>
        <p>Please reload to try again.</p>
        <button onClick={() => window.location.reload()}>Reload</button>
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
    <div role="status" className="panel loading">
      <p>{label}</p>
      <div className="skeleton" />
      <div className="skeleton short" />
    </div>
  );
}
