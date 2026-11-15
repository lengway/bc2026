"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { SessionView } from "@/contracts";
import { accountApi } from "@/app/_lib/account-api";
import { api } from "@/app/_lib/api";
import { ApiError, apiClient } from "@/app/_lib/api-client";
import { safeNextPath } from "@/app/_lib/auth/redirect";
import { mocksEnabled } from "@/app/_lib/environment";
import { Button } from "@/ui/primitives/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/primitives/tabs";
import {
  emailInvalid,
  FormFeedback,
  PasswordField,
  TextField,
  textLinkClass,
} from "@/app/_components/auth-form";

const GuestAccessOptions = z.object({
  guestAccessEnabled: z.boolean(),
  guestAutoEnabled: z.boolean().default(false),
});

export function LoginForm({
  next,
  invalidLink,
  accountSignIn = false,
}: {
  next: string;
  invalidLink: boolean;
  /** `?account=1`: show the normal form even when guest demo sign-in is automatic. */
  accountSignIn?: boolean;
}) {
  const [mode, setMode] = useState(invalidLink ? "link" : "password");
  const [email, setEmail] = useState("");
  const [invalidEmail, setInvalidEmail] = useState(false);
  const router = useRouter();
  const client = useQueryClient();
  const authOptions = useQuery({
    queryKey: ["auth", "options"],
    queryFn: ({ signal }) =>
      apiClient("/api/auth/options", GuestAccessOptions, { signal }),
    enabled: !mocksEnabled,
    retry: false,
  });
  const finish = (session: NonNullable<SessionView>, destination: string) => {
    client.clear();
    client.setQueryData(["session"], session);
    router.replace(safeNextPath(destination));
    router.refresh();
  };
  const password = useMutation({
    mutationFn: (password: string) =>
      accountApi.login({ email, password, next }),
    onSuccess: (result) => finish(result.session, result.next),
  });
  const link = useMutation({
    mutationFn: () => api.magicLink(email.trim(), next),
  });
  const guest = useMutation({
    mutationFn: () =>
      apiClient("/api/auth/guest", SessionView.unwrap(), {
        method: "POST",
        body: {},
      }),
    onSuccess: (session) => finish(session, next || "/dashboard"),
  });
  const autoGuest =
    !accountSignIn &&
    !invalidLink &&
    authOptions.data?.guestAutoEnabled === true &&
    !guest.isError;
  const startedAutoGuest = useRef(false);
  useEffect(() => {
    if (!autoGuest || startedAutoGuest.current) return;
    startedAutoGuest.current = true;
    guest.mutate();
  }, [autoGuest, guest]);
  const preview = useMutation({
    mutationFn: async () => {
      // Email delivery is simulated only by the browser preview.
      await fetch("/api/auth/verify?token=preview-link", {
        redirect: "manual",
        credentials: "same-origin",
      });
      const session = await api.session();
      if (!session)
        throw new ApiError(
          "UNAUTHORIZED",
          "That preview link could not be opened. Request a new link.",
        );
      return session;
    },
    onSuccess: (session) => finish(session, next),
  });
  const pending =
    password.isPending ||
    link.isPending ||
    guest.isPending ||
    preview.isPending;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emailInvalid(email)) {
      setInvalidEmail(true);
      return;
    }
    if (mode === "link") link.mutate();
    else
      password.mutate(
        String(new FormData(event.currentTarget).get("currentPassword")),
      );
  }
  const emailField = (
    <TextField
      label="Email"
      type="email"
      autoComplete={mode === "password" ? "username" : "email"}
      autoFocus
      required
      maxLength={254}
      value={email}
      onChange={(event) => {
        setEmail(event.target.value);
        setInvalidEmail(false);
      }}
      error={invalidEmail ? "Enter a deliverable email address." : undefined}
    />
  );
  if (autoGuest)
    return (
      <div className="grid gap-4 text-sm text-muted-foreground">
        <p role="status">Opening the Gambit demo…</p>
        <Link
          className={textLinkClass}
          href={{ pathname: "/login", query: { next, account: "1" } }}
        >
          Sign in with your account instead
        </Link>
      </div>
    );
  return (
    <>
      <Tabs
        value={mode}
        onValueChange={(value) => {
          setMode(value);
          password.reset();
          link.reset();
        }}
      >
        <TabsList className="mb-3 min-h-12 w-full" aria-label="Sign-in method">
          <TabsTrigger disabled={pending} value="password">
            Password
          </TabsTrigger>
          <TabsTrigger disabled={pending} value="link">
            Email link
          </TabsTrigger>
        </TabsList>
        <TabsContent value="password">
          <form onSubmit={submit} className="grid gap-4">
            {mode === "password" && emailField}
            <PasswordField
              error={
                password.error instanceof ApiError &&
                password.error.status === 401
                  ? password.error.message
                  : undefined
              }
            />
            <FormFeedback
              error={
                password.error instanceof ApiError &&
                password.error.status === 401
                  ? null
                  : password.error
              }
            />
            <Button className="min-h-11" disabled={pending}>
              {password.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </TabsContent>
        <TabsContent value="link">
          {link.isSuccess ? (
            <div className="grid gap-4 text-sm">
              <h2 className="text-lg font-medium">Check your inbox</h2>
              <p role="status">
                {mocksEnabled
                  ? "Email delivery is simulated in this preview."
                  : "If an account exists, we sent an email."}
              </p>
              {mocksEnabled && (
                <Button
                  className="min-h-11"
                  disabled={pending}
                  onClick={() => preview.mutate()}
                >
                  Open preview sign-in link
                </Button>
              )}
              <FormFeedback error={preview.error} />
              <Button
                variant="outline"
                className="min-h-11"
                disabled={pending}
                onClick={() => link.reset()}
              >
                Request another link
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-4">
              {mode === "link" && emailField}
              {invalidLink && (
                <p role="status" className="text-sm text-muted-foreground">
                  That link has expired or was already used. Request a new link
                  below.
                </p>
              )}
              <FormFeedback error={link.error} />
              <Button className="min-h-11" disabled={pending}>
                {link.isPending ? "Sending link…" : "Send sign-in link"}
              </Button>
            </form>
          )}
        </TabsContent>
      </Tabs>
      <div className="flex flex-wrap justify-between gap-x-4">
        <Link
          className={textLinkClass}
          href={{ pathname: "/signup", query: { next } }}
        >
          Create account
        </Link>
        <Link className={textLinkClass} href="/forgot-password">
          Forgot password
        </Link>
      </div>
      {authOptions.data?.guestAccessEnabled && (
        <div className="grid gap-2">
          <FormFeedback error={guest.error} />
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={() => guest.mutate()}
          >
            {guest.isPending ? "Opening demo…" : "Try the demo as a guest"}
          </Button>
        </div>
      )}
    </>
  );
}
