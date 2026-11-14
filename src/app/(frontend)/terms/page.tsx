import Link from "next/link";
import { GambitLogo } from "@/ui/brand";
import { Surface } from "@/app/_components/product";

export default function TermsPage() {
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-5 px-4 py-12 sm:px-8">
      <Link
        href="/"
        aria-label="Gambit home"
        className="w-fit rounded-md focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GambitLogo />
      </Link>
      <Surface className="space-y-4">
        <h1 className="text-2xl font-medium tracking-tight">Terms of use</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Gambit provides practice simulations and AI-assisted feedback.
          Certificates reflect the recorded simulation. Use your own judgment
          when applying the feedback at work.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Use information you are permitted to share. Keep your account
          credentials private and share result links only with people you intend
          to grant access. Anyone who has a public link can open it while it is
          active.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          You can disable public links in Privacy &amp; data and delete your
          account in Account settings.
        </p>
      </Surface>
    </main>
  );
}
