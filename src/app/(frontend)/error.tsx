"use client";
import Link from "next/link";
import { Button } from "@/ui/primitives/button";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 py-20">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Something went wrong
      </p>
      <h1 className="text-3xl font-medium">Let’s try that again.</h1>
      <p className="text-sm text-muted-foreground">
        We could not load this page. Your saved work stays available.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to practice</Link>
        </Button>
      </div>
    </main>
  );
}
