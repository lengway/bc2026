"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/app/_lib/api";
import { ApiError } from "@/app/_lib/api-client";
import { mocksEnabled } from "@/app/_lib/environment";
export function LoginForm({
  next,
  invalidLink,
}: {
  next: string;
  invalidLink: boolean;
}) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(
    invalidLink
      ? "That link has expired or was already used. Request a new link below."
      : "",
  );
  const router = useRouter();
  const client = useQueryClient();
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
      <div className="notice stack">
        <h2>Check your inbox</h2>
        <p role="status">
          {mocksEnabled
            ? "This preview simulates email delivery. No email was sent."
            : `If delivery is available, a sign-in link is on its way to ${email}.`}
        </p>
        {mocksEnabled && (
          <button disabled={pending} onClick={() => void previewSignIn()}>
            Open preview sign-in link
          </button>
        )}
        {error && <p role="alert">{error}</p>}
        <button className="secondary" onClick={() => setSent(false)}>
          Request another link
        </button>
      </div>
    );
  return (
    <form onSubmit={submit} className="stack">
      <div>
        <label htmlFor="email">Work or personal email</label>
        <input
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
      <button disabled={pending}>
        {pending ? "Sending link…" : "Send sign-in link"}
      </button>
    </form>
  );
}
