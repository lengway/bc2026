import { Suspense } from "react";
import { AuthCard } from "@/app/_components/auth-form";
import { SignupForm } from "@/app/_components/account-entry-forms";
import { LoadingState } from "@/app/_components/providers";
import { safeNextPath } from "@/app/_lib/auth/redirect";

type Search = Promise<{ next?: string | string[] }>;

async function Content({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  return (
    <SignupForm
      next={safeNextPath(typeof params.next === "string" ? params.next : null)}
    />
  );
}

export default function Page({ searchParams }: { searchParams: Search }) {
  return (
    <AuthCard title="Create your account">
      <Suspense fallback={<LoadingState />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}
