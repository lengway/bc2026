import Link from "next/link";
import { mocksEnabled } from "@/app/_lib/environment";
export default function BillingSuccess() {
  return (
    <section className="stack">
      <h1>
        {mocksEnabled
          ? "You’ve reached the end of the checkout preview."
          : "Thanks. We’re checking your subscription."}
      </h1>
      <p>
        {mocksEnabled
          ? "No payment was collected. Your preview account is unchanged."
          : "Your account will update once payment is confirmed."}
      </p>
      <div>
        <Link className="button" href="/dashboard">
          Back to practice
        </Link>
      </div>
    </section>
  );
}
