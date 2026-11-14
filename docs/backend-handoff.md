# Backend integration notes for the frontend teammate

The frontend remains owned by the teammate. Shared Zod schemas and inferred TypeScript types are in `src/contracts/index.ts`; realistic examples are in `src/mocks/fixtures`. The original product/route specification remains `docs/spec/CONTEXT.md`.

Status: T0–T5 services and all specified HTTP routes are implemented. Production build and local HTTP startup have been checked. Live OpenAI passage, email delivery, Stripe delivery and VPS deployment remain separate checks; OpenAI currently returns credit_balance_exhausted.

## Requests and retries

- Use same-origin `/api` requests with server cookies. The browser sends `Origin` for mutations; the backend requires it to match `APP_URL`. Session tokens are HttpOnly and are never returned as JSON or stored by frontend code.
- Generate one UUID `clientMsgId` per action. A retry of that action must reuse its ID and exact payload. A new message uses a new ID. An unfinished operation can return HTTP 409 with the existing `VALIDATION` error code; preserve the original action when offering retry.
- `POST /cases` returns `{caseId,status:'generating'}` even when the onboarding pool has prepared the case immediately. Load `GET /cases/:id` afterward. Its generating/failed variants contain only `id` and `status`.
- A ready/active case includes `startedAt`. Use server start time and `brief.timeLimitSec` to restore the timer after reload; the server enforces expiry.
- `submitted` is internal. Public case status is `evaluating` until the review is available.

## Events and observations

- `/events?afterSeq=N` and SSE `/stream?afterSeq=N` use the same safe event projection. Store `lastSeq` from polling; SSE emits `case_event` messages whose event ID is the sequence. On stream failure, polling can expose HTTP auth/ownership errors that EventSource does not expose directly.
- Reload the case view after a completed move or twist to fetch newly available documents. A document ID in event metadata is a reference; its content comes from the authorized case response.
- Create `draftId` as a UUID when opening a fresh answer editor, before the first edit or interaction window. A sent answer closes that draft. The next answer gets another ID.
- Keep stable event IDs, per-draft sequence numbers and batch IDs on retry. Flush observed edits before submitting a message where possible. Missing telemetry still permits the message; it lowers observation coverage, not the skill grade.
- A copilot insertion references the actual prior `copilot_reply` event ID. An external paste uses `sourceEventId:null`; it is not labelled as AI text.
- Collect only the agreed workspace data after the notice. Pointer sampling is at most 10 Hz, aggregated into windows of up to 10 seconds. Do not send raw coordinates or global keyboard/clipboard data. Stop collection when the case ends.
- `processObservations` belongs only to the owner review. Never render it in a public certificate or its metadata. Public certificate schemas strip it.

## Approved guest-access addition

The user chose `GUEST_ACCESS_ENABLED` on the server instead of an admin screen. `GET /api/auth/options` exposes whether guest entry is enabled; `POST /api/auth/guest` establishes a separate temporary session for each visitor and returns the session view. Re-entering with an existing valid cookie reuses that session.

`SessionView.user.isGuest` identifies guest sessions. The display name is `Demo Guest`; sessions expire after 24 hours. Disabling the server flag closes guest access, including existing guest sessions. Guest results carry `CertificateLimited.isDemo` (also present on full certificates). Show that demo designation; `verified` continues to mean only a recorded simulation. Guest checkout is unavailable; paid access uses an email account.

No frontend implementation was modified for these changes. The entry control and demo indicator are frontend work.

## Scores and certificates

- Render null scores as unavailable, alongside coverage and limitations. Do not convert null to zero.
- Label points are fixed; the server returns evidence and the arithmetic behind accuracy. AI-use skill and observed assistance are separate from accuracy.
- `aiDependency` is a legacy text-similarity field. It does not mean an AI probability or proven authorship.
- Certificate depth depends on the case owner's subscription. Detect the full shape using the `evaluation` property; the limited shape intentionally excludes transcript and move reviews.
- `GET /api/cases/:id/review` additionally returns `certificateSlug`. Use it to request `/api/certificates/:slug` and build the share URL. It is optional in the shared schema for compatibility with earlier fixtures, but the real successful owner-review response supplies it. A foreign owner receives 404. This closes the original API table's missing discovery step.
- Evidence uses event/document IDs and exact quotes. Link only to data actually available in the current owner review or public certificate; otherwise show the quote without a private-data link.

## Running together

Run the web app and worker against the same migrated PostgreSQL database. Use the same origin for frontend/API, matching `APP_URL`; a frontend on another port needs a same-origin development proxy, not direct cross-origin cookie calls. No backend secret belongs in a `NEXT_PUBLIC_*` variable.

Auth uses `/api/auth/options`, `/guest`, `/magic-link`, `/verify`, `/session`, `/logout`. Free quota denial is HTTP 403 with `error.code=PAYWALL`; rate limits use HTTP 429; pending operations/reviews use 409. Distinguish these codes rather than showing every response as a network error. Do not tight-loop retry LLM failures. Final grades/certificates require the evaluation worker; an HTTP submit alone does not compute them.
