import Link from "next/link";
import { mocksEnabled } from "@/app/_lib/environment";
import { Button } from "@/ui/primitives/button";
export default function BillingPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-16">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Your plan
      </p>
      <h1 className="text-3xl font-medium">
        {mocksEnabled ? "Checkout preview complete" : "Checkout cancelled"}
      </h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {mocksEnabled
          ? "No payment was collected. Your preview account is unchanged."
          : "No subscription change was confirmed. You can continue practicing or choose a plan when you are ready."}
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/dashboard">Back to practice</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/pricing">View plans</Link>
        </Button>
      </div>
    </main>
  );
}
