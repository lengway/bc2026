"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  CreditCard,
  LogOut,
  Monitor,
  Settings2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { DropdownMenu } from "radix-ui";
import { toast } from "sonner";
import type { SessionUser } from "@/contracts";
import { accountApi } from "@/app/_lib/account-api";
import { api } from "@/app/_lib/api";
import { ApiError } from "@/app/_lib/api-client";
import { cn } from "@/ui/lib/utils";
import { Button } from "@/ui/primitives/button";

const items = [
  { href: "/settings/learning", name: "My learning", icon: BookOpen },
  { href: "/settings/account", name: "Account", icon: Settings2 },
  { href: "/settings/billing", name: "Plan & billing", icon: CreditCard },
];
const themes = [
  { name: "System", value: "system" },
  { name: "Light", value: "light" },
  { name: "Dark", value: "dark" },
];
const menuClass =
  "z-50 min-w-40 rounded-lg border bg-popover p-1 text-popover-foreground shadow-raised";
const itemClass =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-sm outline-none data-highlighted:bg-ink-soft data-highlighted:text-ink data-disabled:cursor-not-allowed data-disabled:opacity-60";

function useVerificationEmail() {
  return useMutation({ mutationFn: accountApi.resendVerification });
}

export function VerifyEmailBanner({ user }: { user: SessionUser }) {
  const resend = useVerificationEmail();
  if (user.emailVerified || user.isGuest) return null;
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 border-b px-4 py-1 text-sm sm:px-8">
      <p>Confirm your email to publish certificates.</p>
      <Button
        variant="ghost"
        className="min-h-11 px-2 text-ink underline-offset-4 hover:underline"
        disabled={resend.isPending}
        onClick={() => resend.mutate()}
      >
        {resend.isPending ? "Sending…" : "Resend email"}
      </Button>
      {resend.isSuccess && (
        <p role="status" className="text-muted-foreground">
          Confirmation email sent.
        </p>
      )}
      {resend.isError && (
        <p role="alert" className="w-full text-destructive">
          {resend.error.message}
        </p>
      )}
    </div>
  );
}

export function ProfileMenu({
  user,
  plan,
}: {
  user: SessionUser;
  plan?: "free" | "pro";
}) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const cache = useQueryClient();
  const resend = useVerificationEmail();
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      cache.clear();
      router.replace("/login");
      router.refresh();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        cache.clear();
        router.replace("/login");
      } else toast.error(error.message);
    },
  });
  const name = user.displayName ?? user.email.split("@")[0];
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => Array.from(part)[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Profile menu"
          className="grid size-11 place-items-center rounded-lg text-ink outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-full border border-ink-border bg-ink-soft text-xs font-medium"
          >
            {initials}
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={cn(menuClass, "w-64 max-w-[calc(100vw-1rem)]")}
          align="end"
          sideOffset={6}
          collisionPadding={8}
        >
          <DropdownMenu.Label className="space-y-1 px-3 py-2.5">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{name}</span>
              {plan && (
                <span className="rounded-md border bg-surface px-1.5 py-0.5 font-mono text-xs">
                  {plan === "pro" ? "Pro" : "Free"}
                </span>
              )}
            </div>
            <p className="break-all text-xs text-muted-foreground">
              {user.email}
            </p>
            {!user.emailVerified && !user.isGuest && (
              <p className="text-xs text-muted-foreground">
                Confirm your email to publish certificates.
              </p>
            )}
          </DropdownMenu.Label>
          {!user.emailVerified && !user.isGuest && (
            <DropdownMenu.Item
              className={cn(itemClass, "text-ink")}
              disabled={resend.isPending}
              onSelect={() =>
                resend.mutate(undefined, {
                  onSuccess: () => toast.success("Confirmation email sent"),
                  onError: (error) => toast.error(error.message),
                })
              }
            >
              Resend email
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Separator className="my-1 border-t" />
          {items.map(({ href, name, icon: Icon }) => (
            <DropdownMenu.Item key={href} asChild className={itemClass}>
              <Link href={href}>
                <Icon
                  aria-hidden="true"
                  className="size-4 shrink-0"
                  strokeWidth={1.5}
                />
                {name}
              </Link>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={itemClass}>
              <Monitor
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.5}
              />
              Appearance
              <ChevronRight
                aria-hidden="true"
                className="ml-auto size-4"
                strokeWidth={1.5}
              />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                className={menuClass}
                sideOffset={4}
                collisionPadding={8}
              >
                <DropdownMenu.RadioGroup
                  value={theme ?? "system"}
                  onValueChange={setTheme}
                >
                  {themes.map(({ name, value }) => (
                    <DropdownMenu.RadioItem
                      key={value}
                      value={value}
                      className={itemClass}
                    >
                      <span className="size-4">
                        <DropdownMenu.ItemIndicator>
                          <Check
                            aria-hidden="true"
                            className="size-4"
                            strokeWidth={1.5}
                          />
                        </DropdownMenu.ItemIndicator>
                      </span>
                      {name}
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Item asChild className={itemClass}>
            <Link href="/help">
              <CircleHelp
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.5}
              />
              Help
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 border-t" />
          <DropdownMenu.Item
            className={itemClass}
            disabled={logout.isPending}
            onSelect={() => logout.mutate()}
          >
            <LogOut aria-hidden="true" className="size-4" strokeWidth={1.5} />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
