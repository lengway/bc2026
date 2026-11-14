import Link from "next/link";
export default function OnboardingPage() {
  return (
    <section className="stack">
      <p className="eyebrow">Your first practice</p>
      <h1>A small step toward better conversations.</h1>
      <p className="muted">
        Start with a sales scenario. Read the brief, take your time, and explore
        what matters to the customer.
      </p>
      <div>
        <Link href="/dashboard" className="button">
          Explore practice
        </Link>
      </div>
    </section>
  );
}
