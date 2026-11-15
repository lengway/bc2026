import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/app/_components/auth-form";
import { LoadingState } from "@/app/_components/providers";
import { safeNextPath } from "@/app/_lib/auth/redirect";
import { LoginForm } from "./login-form";

type Search = Promise<{
  next?: string | string[];
  error?: string;
  account?: string;
}>;

async function LoginContent({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  return (
    <LoginForm
      next={safeNextPath(typeof params.next === "string" ? params.next : null)}
      invalidLink={Boolean(params.error)}
      accountSignIn={params.account === "1"}
    />
  );
}

export const metadata: Metadata = { title: "Sign In" };

export default function LoginPage({ searchParams }: { searchParams: Search }) {
  return (
    <AuthCard title="Sign in to Gambit">
      <Suspense fallback={<LoadingState label="Loading sign-in options…" />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}
