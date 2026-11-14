"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <section className="panel stack" role="alert">
      <h1>Something went wrong</h1>
      <p>Your next step is still here. Try loading this page again.</p>
      <div>
        <button onClick={reset}>Try again</button>
      </div>
    </section>
  );
}
