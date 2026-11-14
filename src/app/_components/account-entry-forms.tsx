"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { VerifyEmailRequest, type RegisterRequest } from "@/contracts";
import { accountApi } from "@/app/_lib/account-api";
import { ApiError } from "@/app/_lib/api-client";
import { mocksEnabled } from "@/app/_lib/environment";
import { Button } from "@/ui/primitives/button";
import {
  FormFeedback,
  PasswordField,
  TextField,
  emailInvalid,
  textLinkClass,
} from "./auth-form";

const genericEmailResponse = "If an account exists, we sent an email.";
const badEmail = "Enter a deliverable email address.";
const previewToken = "preview-registration-confirmation-link";

export function SignupForm({ next }: { next: string }) {
  const register = useMutation({ mutationFn: accountApi.register });
  const [registration, setRegistration] = useState<RegisterRequest>();
  const [invalidEmail, setInvalidEmail] = useState(false);
  const [resending, setResending] = useState(false);
  const resend = useMutation({ mutationFn: accountApi.register });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email")).trim();
    if (emailInvalid(email)) {
      setInvalidEmail(true);
      return;
    }
    const fields = {
      email,
      password: String(data.get("password")),
      displayName: String(data.get("displayName")).trim(),
    };
    register.mutate(fields, { onSuccess: () => setRegistration(fields) });
  }
  if (registration)
    return (
      <div className="grid gap-4 text-sm">
        <h2 className="text-lg font-medium">Check your inbox</h2>
        <p role="status">{genericEmailResponse}</p>
        <p className="text-muted-foreground">
          Open the confirmation link to verify your email.
        </p>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={resend.isPending}
          onClick={() => {
            setResending(true);
            resend.mutate(registration);
          }}
        >
          {resend.isPending ? "Sending…" : "Resend email"}
        </Button>
        <FormFeedback
          error={resend.error}
          success={
            resending && resend.isSuccess ? genericEmailResponse : undefined
          }
        />
        {mocksEnabled && (
          <Button asChild>
            <Link
              href={{
                pathname: "/verify-email",
                query: { token: previewToken, next },
              }}
            >
              Open preview confirmation link
            </Link>
          </Button>
        )}
        <Link
          className={textLinkClass}
          href={{ pathname: "/login", query: { next } }}
        >
          Go to sign in
        </Link>
      </div>
    );
  return (
    <form onSubmit={submit} className="grid gap-4">
      <TextField
        label="Full name"
        name="displayName"
        autoComplete="name"
        autoFocus
        required
        maxLength={100}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        error={invalidEmail ? badEmail : undefined}
        onChange={() => setInvalidEmail(false)}
      />
      <PasswordField newPassword />
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input
          className="mt-0.5 size-4 shrink-0 accent-ink"
          type="checkbox"
          required
        />
        <span>
          I agree to the{" "}
          <Link
            className="text-ink underline underline-offset-4"
            href="/terms"
            target="_blank"
            rel="noreferrer"
          >
            Terms of use
          </Link>
          .
        </span>
      </label>
      <FormFeedback error={register.error} />
      <Button className="min-h-11" disabled={register.isPending}>
        {register.isPending ? "Creating account…" : "Create account"}
      </Button>
      <Link
        className={textLinkClass}
        href={{ pathname: "/login", query: { next } }}
      >
        Already have an account? Sign in
      </Link>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [invalidEmail, setInvalidEmail] = useState(false);
  const request = useMutation({ mutationFn: accountApi.forgotPassword });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    if (emailInvalid(email)) {
      setInvalidEmail(true);
      return;
    }
    request.mutate(email);
  }
  if (request.isSuccess)
    return (
      <div className="grid gap-3 text-sm">
        <h2 className="text-lg font-medium">Check your inbox</h2>
        <p role="status">{genericEmailResponse}</p>
        <Link className={textLinkClass} href="/login">
          Back to sign in
        </Link>
      </div>
    );
  return (
    <form onSubmit={submit} className="grid gap-4">
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        autoFocus
        required
        maxLength={254}
        error={invalidEmail ? badEmail : undefined}
        onChange={() => setInvalidEmail(false)}
      />
      <FormFeedback error={request.error} />
      <Button className="min-h-11" disabled={request.isPending}>
        {request.isPending ? "Sending…" : "Send reset link"}
      </Button>
      <Link className={textLinkClass} href="/login">
        Back to sign in
      </Link>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const reset = useMutation({
    mutationFn: (password: string) =>
      accountApi.resetPassword({ token, password }),
  });
  const unavailable =
    !VerifyEmailRequest.safeParse({ token }).success ||
    (reset.error instanceof ApiError && reset.error.status === 401);
  if (unavailable)
    return (
      <div className="grid gap-3 text-sm">
        <p role="alert">This reset link has expired or was already used.</p>
        <Link className={textLinkClass} href="/forgot-password">
          Request a new reset link
        </Link>
      </div>
    );
  if (reset.isSuccess)
    return (
      <div className="grid gap-3 text-sm">
        <p role="status">
          Your password was reset. Sign in with your new password.
        </p>
        <Link className={textLinkClass} href="/login">
          Sign in
        </Link>
      </div>
    );
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        reset.mutate(String(new FormData(event.currentTarget).get("password")));
      }}
    >
      <PasswordField label="New password" newPassword autoFocus />
      <FormFeedback error={reset.error} />
      <Button className="min-h-11" disabled={reset.isPending}>
        {reset.isPending ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}

export function VerifyEmailForm({
  token,
  next,
}: {
  token: string;
  next: string;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const verify = useMutation({
    mutationFn: () => accountApi.verifyEmail(token),
    onSuccess: () => {
      client.removeQueries();
    },
  });
  const unavailable =
    !VerifyEmailRequest.safeParse({ token }).success ||
    (verify.error instanceof ApiError && verify.error.status === 401);
  if (unavailable)
    return (
      <div className="grid gap-3 text-sm">
        <p role="alert">
          This confirmation link has expired or was already used.
        </p>
        <Link className={textLinkClass} href="/login">
          Sign in to resend confirmation
        </Link>
        <Link className={textLinkClass} href="/signup">
          Register again for a new link
        </Link>
      </div>
    );
  if (verify.isSuccess)
    return (
      <div className="grid gap-3 text-sm">
        <p role="status">Your email is confirmed.</p>
        <Button
          className="min-h-11"
          onClick={() => {
            router.replace(next);
            router.refresh();
          }}
        >
          Continue to Gambit
        </Button>
      </div>
    );
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        verify.mutate();
      }}
    >
      <p className="text-sm text-muted-foreground">
        Confirm this address to publish certificates and keep account access.
      </p>
      <FormFeedback error={verify.error} />
      <Button className="min-h-11" autoFocus disabled={verify.isPending}>
        {verify.isPending ? "Confirming…" : "Confirm email"}
      </Button>
    </form>
  );
}
