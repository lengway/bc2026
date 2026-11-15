import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/app/_components/auth-form";
import { ResetPasswordForm } from "@/app/_components/account-entry-forms";
import { LoadingState } from "@/app/_components/providers";

type Search = Promise<{ token?: string | string[] }>;

async function Content({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  return (
    <ResetPasswordForm
      token={typeof params.token === "string" ? params.token : ""}
    />
  );
}

export const metadata: Metadata = { title: "Reset Password" };

export default function Page({ searchParams }: { searchParams: Search }) {
  return (
    <AuthCard title="Reset your password">
      <Suspense fallback={<LoadingState />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}
