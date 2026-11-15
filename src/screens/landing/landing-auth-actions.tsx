"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/ui/primitives/button";

type Props = { signInHref: string; startHref: string };

/** The landing page is static; this island swaps Sign in for the app link when a session exists. */
export function LandingAuthActions({ signInHref, startHref }: Props) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((session: { user?: unknown } | null) =>
        setSignedIn(Boolean(session?.user)),
      )
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  if (signedIn)
    return (
      <Button asChild size="lg">
        <Link href="/dashboard">Open dashboard</Link>
      </Button>
    );
  return (
    <>
      <Button asChild variant="ghost" size="lg">
        <Link href={signInHref}>Sign in</Link>
      </Button>
      <Button asChild variant="outline" size="lg">
        <Link href={startHref}>Start a case</Link>
      </Button>
    </>
  );
}
