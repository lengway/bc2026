import { safeNextPath } from "@/app/_lib/auth/redirect";
import { LoginForm } from "@/app/(frontend)/login/login-form";
import { ClientData } from "@/app/_components/providers";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <section className="stack form">
      <p className="eyebrow">Welcome back</p>
      <h1>Your next move starts here.</h1>
      <p className="muted">
        Enter your email and we&apos;ll send you a sign-in link. No password to
        remember.
      </p>
      <ClientData>
        <LoginForm
          next={safeNextPath(params.next ?? null)}
          invalidLink={Boolean(params.error)}
        />
      </ClientData>
    </section>
  );
}
