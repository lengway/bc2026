import Link from "next/link";
export default function BillingCancel() {
  return (
    <section className="stack">
      <h1>Your plan is unchanged.</h1>
      <p>You can keep practicing or come back to Pro later.</p>
      <div>
        <Link className="button" href="/dashboard">
          Back to practice
        </Link>
      </div>
    </section>
  );
}
