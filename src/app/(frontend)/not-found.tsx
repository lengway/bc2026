import Link from "next/link";
export default function NotFound() {
  return (
    <section className="stack">
      <p className="eyebrow">404</p>
      <h1>We couldn&apos;t find that page</h1>
      <p>Check the link or return to your practice.</p>
      <div>
        <Link href="/dashboard" className="button">
          Back to practice
        </Link>
      </div>
    </section>
  );
}
