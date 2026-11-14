import { Suspense } from "react";
import { AuthCard } from "@/app/_components/auth-form";
import { VerifyEmailForm } from "@/app/_components/account-entry-forms";
import { LoadingState } from "@/app/_components/providers";
import { safeNextPath } from "@/app/_lib/auth/redirect";

type Search = Promise<{ token?: string | string[]; next?: string | string[] }>;

async function Content({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  return (
    <VerifyEmailForm
      token={typeof params.token === "string" ? params.token : ""}
      next={safeNextPath(typeof params.next === "string" ? params.next : null)}
    />
  );
}

export default function Page({ searchParams }: { searchParams: Search }) {
  return (
    <AuthCard title="Confirm your email">
      <Suspense fallback={<LoadingState />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}
