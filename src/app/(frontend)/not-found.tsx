import Link from "next/link";
import { PublicShell } from "@/app/_components/product";
import { Button } from "@/ui/primitives/button";
export default function NotFound() {
  return (
    <PublicShell>
      <main className="mx-auto grid max-w-xl gap-5 px-4 py-24">
        <p className="font-mono text-xs text-muted-foreground">404</p>
        <h1 className="text-3xl font-medium tracking-tight">
          We could not find that page
        </h1>
        <p className="text-muted-foreground">
          Check the link or return to Gambit’s home page.
        </p>
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </main>
    </PublicShell>
  );
}
