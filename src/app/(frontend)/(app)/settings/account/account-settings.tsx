"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SessionUser, SessionView } from "@/contracts";
import { accountApi } from "@/app/_lib/account-api";
import { api } from "@/app/_lib/api";
import {
  FormFeedback,
  PasswordField,
  TextField,
  emailInvalid,
} from "@/app/_components/auth-form";
import { ErrorPanel } from "@/app/_components/error-panel";
import { Button } from "@/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/primitives/dialog";
import { SettingsLoading, SettingsSection } from "../settings-section";

const accountKey = ["account"];
const sessionKey = ["session"];

export function AccountSettings() {
  const session = useQuery({
    queryKey: sessionKey,
    queryFn: ({ signal }) => api.session(signal),
  });
  const query = useQuery({
    queryKey: accountKey,
    queryFn: ({ signal }) => accountApi.account(signal),
    enabled: !!session.data && !session.data.user.isGuest,
  });
  if (session.isError)
    return (
      <ErrorPanel error={session.error} retry={() => void session.refetch()} />
    );
  if (session.data?.user.isGuest)
    return (
      <SettingsSection
        title="Guest account"
        description="Sign in or create an account to manage your identity and sessions."
      >
        <Button asChild className="w-fit">
          <Link href="/signup?next=/settings/account">Create account</Link>
        </Button>
      </SettingsSection>
    );
  if (query.isPending)
    return <SettingsLoading label="Loading account details…" />;
  if (query.isError)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  return <AccountForms key={query.data.id} user={query.data} />;
}

function field(data: FormData, key: string) {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
}

function AccountForms({ user }: { user: SessionUser }) {
  const router = useRouter();
  const cache = useQueryClient();
  const [displayName, setDisplayName] = useState(user.displayName ?? "");
  const [invalidName, setInvalidName] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [invalidEmail, setInvalidEmail] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const exit = () => {
    cache.clear();
    router.replace("/login?account=1");
    router.refresh();
  };
  const changeName = useMutation({
    mutationFn: () => accountApi.update({ displayName: displayName.trim() }),
    onSuccess: (updated) => {
      setDisplayName(updated.displayName ?? "");
      cache.setQueryData(accountKey, updated);
      cache.setQueryData<SessionView>(sessionKey, (session) =>
        session ? { ...session, user: updated } : session,
      );
      void cache.invalidateQueries({ queryKey: ["review"] });
      void cache.invalidateQueries({ queryKey: ["owner-certificates"] });
    },
  });
  const changeEmail = useMutation({
    mutationFn: (currentPassword?: string) =>
      accountApi.changeEmail({ email: newEmail.trim(), currentPassword }),
    onSuccess: () => setNewEmail(""),
  });
  const changePassword = useMutation({
    mutationFn: (data: { password: string; currentPassword?: string }) =>
      accountApi.changePassword(data),
    onSuccess: () => {
      cache.setQueryData(accountKey, { ...user, hasPassword: true });
      void cache.invalidateQueries({ queryKey: sessionKey });
    },
  });
  const logout = useMutation({
    mutationFn: accountApi.logoutAll,
    onSuccess: exit,
  });
  const remove = useMutation({
    mutationFn: (currentPassword?: string) =>
      accountApi.remove({ confirm: "DELETE", currentPassword }),
    onSuccess: exit,
  });
  const customForm =
    (action: (data: FormData) => void) =>
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      action(new FormData(event.currentTarget));
    };
  const currentPassword = (data: FormData) =>
    user.hasPassword ? field(data, "currentPassword") : undefined;
  const addressMatches =
    confirmation.trim().toLowerCase() === user.email.toLowerCase();

  return (
    <div className="grid gap-5">
      <SettingsSection title="Name">
        <form
          className="grid max-w-md gap-4"
          onSubmit={customForm(() => {
            if (!displayName.trim()) {
              setInvalidName(true);
              return;
            }
            changeName.mutate();
          })}
        >
          <TextField
            label="Full name"
            hint="This name appears on your certificates."
            name="displayName"
            autoComplete="name"
            maxLength={100}
            required
            value={displayName}
            error={invalidName ? "Enter your full name." : undefined}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setInvalidName(false);
            }}
          />
          <FormFeedback
            error={changeName.error}
            success={changeName.isSuccess ? "Name updated." : undefined}
          />
          <Button className="min-h-11 w-fit" disabled={changeName.isPending}>
            Save name
          </Button>
        </form>
      </SettingsSection>
      <SettingsSection
        title="Email address"
        description="Your current address stays active until you confirm the new one."
      >
        <p className="break-all text-sm">
          {user.email}{" "}
          <span className="ml-1 text-muted-foreground">
            · {user.emailVerified ? "Confirmed" : "Unconfirmed"}
          </span>
        </p>
        <form
          className="grid max-w-md gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (
              emailInvalid(newEmail) ||
              newEmail.trim().toLowerCase() === user.email.toLowerCase()
            ) {
              setInvalidEmail(true);
              return;
            }
            const form = event.currentTarget;
            changeEmail.mutate(currentPassword(new FormData(form)), {
              onSuccess: () => form.reset(),
            });
          }}
        >
          <TextField
            label="New email address"
            name="newEmail"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            value={newEmail}
            error={
              invalidEmail
                ? "Enter a different, deliverable email address."
                : undefined
            }
            onChange={(event) => {
              setNewEmail(event.target.value);
              setInvalidEmail(false);
            }}
          />
          {user.hasPassword && <PasswordField label="Current password" />}
          <FormFeedback
            error={changeEmail.error}
            success={
              changeEmail.isSuccess
                ? "Check the new address for a confirmation link."
                : undefined
            }
          />
          <Button className="min-h-11 w-fit" disabled={changeEmail.isPending}>
            Send confirmation
          </Button>
        </form>
      </SettingsSection>
      <SettingsSection
        title="Password"
        description={
          user.hasPassword
            ? "Changing your password signs out your other devices."
            : "Add a password to sign in without an email link."
        }
      >
        <form
          className="grid max-w-md gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            changePassword.mutate(
              {
                password: field(data, "password"),
                currentPassword: currentPassword(data),
              },
              { onSuccess: () => form.reset() },
            );
          }}
        >
          {user.hasPassword && <PasswordField label="Current password" />}
          <PasswordField label="New password" newPassword />
          <FormFeedback
            error={changePassword.error}
            success={changePassword.isSuccess ? "Password updated." : undefined}
          />
          <Button
            className="min-h-11 w-fit"
            disabled={changePassword.isPending}
          >
            {user.hasPassword ? "Change password" : "Set password"}
          </Button>
        </form>
      </SettingsSection>
      <SettingsSection
        title="Sessions"
        description="Sign out of Gambit on this device and everywhere else."
      >
        <FormFeedback error={logout.error} />
        <Button
          variant="outline"
          className="min-h-11 w-fit"
          type="button"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          Sign out of all devices
        </Button>
      </SettingsSection>
      <SettingsSection
        title="Danger zone"
        description="Deleting your account permanently removes access to your cases, reviews, and certificates. Public links stop working."
      >
        <Dialog
          open={deleteOpen}
          onOpenChange={(value) => {
            if (remove.isPending) return;
            setDeleteOpen(value);
            if (!value) {
              setConfirmation("");
              remove.reset();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="destructive" className="min-h-11 w-fit">
              Delete account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                Type {user.email} to permanently delete your cases, reviews, and
                certificates.
              </DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4"
              onSubmit={customForm((data) => {
                if (addressMatches) remove.mutate(currentPassword(data));
              })}
            >
              <TextField
                label="Confirm your email"
                name="confirm"
                type="email"
                autoComplete="off"
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
              {user.hasPassword && <PasswordField label="Current password" />}
              <FormFeedback error={remove.error} />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={remove.isPending}
                  onClick={() => {
                    setDeleteOpen(false);
                    setConfirmation("");
                    remove.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="min-h-11"
                  disabled={remove.isPending || !addressMatches}
                >
                  {remove.isPending
                    ? "Deleting…"
                    : "Permanently delete account"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </SettingsSection>
    </div>
  );
}
