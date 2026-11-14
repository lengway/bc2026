"use client";

import Link from "next/link";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { GambitLogo } from "@/ui/brand";
import { Button } from "@/ui/primitives/button";
import { inputClass, labelClass } from "./product";
import { ClientData } from "./providers";

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="grid flex-1 place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          aria-label="Gambit home"
          className="mb-5 inline-flex min-h-11 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GambitLogo />
        </Link>
        <section className="grid gap-6 rounded-xl border bg-card p-5 sm:p-7">
          <header className="grid gap-2">
            <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </header>
          <ClientData>{children}</ClientData>
        </section>
      </div>
    </main>
  );
}

export const textLinkClass =
  "inline-flex min-h-11 w-fit items-center rounded-md text-sm font-medium text-ink underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring";

type TextFieldProps = ComponentProps<"input"> & {
  label: string;
  hint?: string;
  error?: string;
};
export function TextField({ label, hint, error, ...input }: TextFieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        {...input}
        id={id}
        className={inputClass}
        aria-invalid={Boolean(error)}
        aria-describedby={hint || error ? `${id}-note` : undefined}
      />
      {(hint || error) && (
        <p
          id={`${id}-note`}
          role={error ? "alert" : undefined}
          className={`mt-1.5 text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function PasswordField({
  label = "Password",
  newPassword = false,
  autoFocus,
  error,
}: {
  label?: string;
  newPassword?: boolean;
  autoFocus?: boolean;
  error?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={newPassword ? "password" : "currentPassword"}
          type={visible ? "text" : "password"}
          autoComplete={newPassword ? "new-password" : "current-password"}
          autoFocus={autoFocus}
          required
          minLength={newPassword ? 10 : 1}
          maxLength={128}
          className={`${inputClass} pr-12`}
          aria-invalid={Boolean(error)}
          aria-describedby={newPassword || error ? `${id}-note` : undefined}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-0 top-0 size-11"
          onClick={() => setVisible(!visible)}
        >
          <Icon aria-hidden="true" strokeWidth={1.5} />
        </Button>
      </div>
      {(newPassword || error) && (
        <p
          id={`${id}-note`}
          role={error ? "alert" : undefined}
          className={`mt-1.5 text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}
        >
          {error || "Use 10–128 characters."}
        </p>
      )}
    </div>
  );
}

export function FormFeedback({
  error,
  success,
}: {
  error?: Error | null;
  success?: string;
}) {
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error.message}
      </p>
    );
  if (success)
    return (
      <p role="status" className="text-sm text-ink">
        {success}
      </p>
    );
  return null;
}

export function emailInvalid(value: string) {
  return !value.trim() || value.trim().toLowerCase().endsWith(".invalid");
}
