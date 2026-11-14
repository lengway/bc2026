"use client";
import Link from "next/link";
import { useState } from "react";
import { useCheckout } from "@/app/_hooks/case-hooks";
import { mocksEnabled } from "@/app/_lib/environment";
import { ErrorPanel } from "@/app/_components/error-panel";
export function PricingPreview() {
  const checkout = useCheckout();
  const [error, setError] = useState("");
  return (
    <section className="stack">
      <p className="eyebrow">Invest in your next move</p>
      <h1>Practice at your pace.</h1>
      <div className="grid">
        <article className="panel stack">
          <h2>Free</h2>
          <p className="metric">$0</p>
          <p>
            One onboarding case, one daily case per week, a limited certificate,
            and basic progress.
          </p>
          <Link className="button secondary" href="/login?next=/onboarding">
            Start practicing
          </Link>
        </article>
        <article className="panel stack">
          <h2>Pro</h2>
          <p className="metric">
            $19<span style={{ fontSize: "1rem" }}> / month</span>
          </p>
          <p className="muted">Or $149 billed yearly</p>
          <p>
            Unlimited daily cases, weekly challenges, full certificates, and
            your complete skill path.
          </p>
          <button
            disabled={checkout.isPending}
            onClick={() => {
              setError("");
              checkout.mutate(undefined, {
                onSuccess: (result) => {
                  const url = new URL(result.url);
                  const allowed =
                    url.protocol === "https:" &&
                    url.hostname === "checkout.stripe.com";
                  const preview =
                    mocksEnabled &&
                    url.origin === window.location.origin &&
                    url.pathname === "/billing/success";
                  if (!allowed && !preview) {
                    setError("We couldn't open checkout. Please try again.");
                    return;
                  }
                  window.location.assign(url.href);
                },
              });
            }}
          >
            {checkout.isPending
              ? "Opening checkout…"
              : mocksEnabled
                ? "Preview checkout"
                : "Continue to checkout"}
          </button>
          {checkout.isError && <ErrorPanel error={checkout.error} />}
          {error && <p role="alert">{error}</p>}
        </article>
      </div>
      {mocksEnabled && (
        <p className="muted">
          Preview checkout does not collect payment or change a subscription.
        </p>
      )}
    </section>
  );
}
