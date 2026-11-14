"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/ui/primitives/button";
import { inputClass, labelClass } from "@/app/_components/product";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/app/_lib/api";
import { z } from "zod";
import { SessionView } from "@/contracts";
import { ApiError, apiClient } from "@/app/_lib/api-client";
import { mocksEnabled } from "@/app/_lib/environment";
const GuestAccessOptions = z.object({ guestAccessEnabled: z.boolean() });

export function LoginForm({
  next,
  invalidLink,
}: {
  next: string;
  invalidLink: boolean;
}) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [guestPending, setGuestPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(
    invalidLink
      ? "That link has expired or was already used. Request a new link below."
      : "",
  );
  const router = useRouter();
  const client = useQueryClient();
  const authOptions = useQuery({
    queryKey: ["auth", "options"],
    queryFn: ({ signal }) =>
      apiClient("/api/auth/options", GuestAccessOptions, { signal }),
    enabled: !mocksEnabled,
    retry: false,
  });
  async function tryDemo() {
    setError("");
    setGuestPending(true);
    try {
      const session = await apiClient("/api/auth/guest", SessionView.unwrap(), {
        method: "POST",
        body: {},
      });
      client.setQueryData(["session"], session);
      router.replace("/dashboard");
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : "Couldn't open the demo. Please try again.",
      );
    } finally {
      setGuestPending(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await api.magicLink(email.trim());
      setSent(true);
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : "Couldn't send the link. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }
  async function previewSignIn() {
    setPending(true);
    setError("");
    try {
      // Simulate following the email. A real magic link is consumed entirely by the backend.
      await fetch("/api/auth/verify?token=preview-link", {
        credentials: "same-origin",
        redirect: "manual",
      });
      const session = await api.session();
      if (!session) throw new Error("No preview session");
      client.setQueryData(["session"], session);
      router.replace(next);
    } catch {
      setError("That preview link could not be opened. Request a new link.");
    } finally {
      setPending(false);
    }
  }
  if (sent)
    return (
      <div className="grid gap-4 rounded-lg border bg-surface p-5 text-sm">
        <h2 className="text-lg font-medium">Check your inbox</h2>
        <p role="status">
          {mocksEnabled
            ? "This preview simulates email delivery. No email was sent."
            : `If delivery is available, a sign-in link is on its way to ${email}.`}
        </p>
        {mocksEnabled && (
          <Button disabled={pending} onClick={() => void previewSignIn()}>
            Open preview sign-in link
          </Button>
        )}
        {error && <p role="alert">{error}</p>}
        <Button variant="outline" onClick={() => setSent(false)}>
          Request another link
        </Button>
      </div>
    );
  return (
    <form onSubmit={submit} className="grid gap-5">
      <div>
        <label className={labelClass} htmlFor="email">
          Work or personal email
        </label>
        <input
          className={inputClass}
          id="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </div>
      {error && <p role="alert">{error}</p>}
      <Button disabled={pending || guestPending}>
        {pending ? "Sending link…" : "Send sign-in link"}
      </Button>
      {authOptions.data?.guestAccessEnabled && (
        <Button
          type="button"
          variant="outline"
          disabled={pending || guestPending}
          onClick={() => void tryDemo()}
        >
          {guestPending ? "Opening demo…" : "Try the demo as a guest"}
        </Button>
      )}
    </form>
  );
}
