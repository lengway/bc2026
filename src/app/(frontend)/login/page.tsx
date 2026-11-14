import { safeNextPath } from "@/app/_lib/auth/redirect";
import { LoginForm } from "./login-form";
import { ClientData } from "@/app/_components/providers";
import { PublicShell } from "@/app/_components/product";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <PublicShell>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-7 px-4 py-16 sm:py-24">
        <div className="space-y-4">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Your next move
          </p>
          <h1 className="font-serif text-display font-normal tracking-tight">
            A little practice.
            <br />A clearer next step.
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Sign in with a link. No password to remember.
          </p>
        </div>
        <ClientData>
          <LoginForm
            next={safeNextPath(params.next ?? null)}
            invalidLink={Boolean(params.error)}
          />
        </ClientData>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Your cases and reviews stay private. A certificate is only shared
          through its public link.
        </p>
      </main>
    </PublicShell>
  );
}
