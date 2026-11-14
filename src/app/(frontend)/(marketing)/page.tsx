import Link from "next/link";
import { mocksEnabled } from "@/app/_lib/environment";
export default function HomePage() {
  return (
    <div className="stack">
      <section className="hero stack">
        <p className="eyebrow">Practice for the work that matters</p>
        <h1>
          Build confidence.
          <br />
          One real conversation at a time.
        </h1>
        <p className="muted">
          Work through a realistic sales scenario, make your own decisions, and
          learn from a move-by-move review.
        </p>
        <div className="actions">
          <Link
            href={mocksEnabled ? "/dashboard" : "/login?next=/onboarding"}
            className="button"
          >
            {mocksEnabled ? "Try the preview" : "Take your first case"}
          </Link>
          <span className="muted">Sales · About 8 minutes</span>
        </div>
      </section>
      <section className="grid" aria-label="How practice works">
        <article className="panel stack tight">
          <p className="eyebrow">01 / Practice</p>
          <h2>A situation worth thinking through</h2>
          <p className="muted">
            Read the brief, explore the documents, and talk to a client with
            their own priorities.
          </p>
        </article>
        <article className="panel stack tight">
          <p className="eyebrow">02 / Learn</p>
          <h2>Understand your next move</h2>
          <p className="muted">
            See where your decisions helped, what you missed, and what you could
            try next time.
          </p>
        </article>
      </section>
    </div>
  );
}
