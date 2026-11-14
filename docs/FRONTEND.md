# Frontend scope and progress

## Source of truth and scope

Updated user specs: `docs/reference/CONTEXT.md` and `docs/reference/PROMPT_FRONTEND.md`. They supersede the older root CONTEXT/design handoff. Frontend only, F1–F6; Sales/chat is active. PM/Software, backend, database, worker and deployment are outside this task. English UI/code. Dedicated branch: `fe/frontend`.

The user authorized finishing the full frontend on main’s Claude design on 2026-11-14. Main design baseline is `96918f2`, integrated before F1 commit `01db278`. Ledger tokens/fonts/primitives and existing landing/review screens are reused, with public schemas and score wording adapted to the newer spec. Superpowers was applied proportionately with one agent; no repeated product brainstorming.

## Implemented epics

| Epic | Frontend implementation                                                                                                                                                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1   | Next App Router, strict TypeScript, public Zod contracts, Query cache, validated API calls, auth gates, session/logout/magic-link UI, SSE reconciliation/fallback, explicit MSW preview.                                                                   |
| F2   | Field/level, optional intake, correction/reparse confirmation, preparation stages/60-second timeout/retry, full brief, public scoring guide and recording notice acknowledgment.                                                                           |
| F3   | Chat workspace, document formats and twists, independent desktop panels/mobile sheets, server-start deadline, confirmed submit and autosubmit, stable retry IDs, Copilot copy/insert, IME-safe sending, scoped editor and aggregate interaction recording. |
| F4   | Detailed review, trust/move navigation, evidence dialog, separate assistance and AI checks, score audit, owner observations; safe SSR limited/full certificates, public transcript, share actions and generated OG; dashboard/path/history/XP/streak.      |
| F5   | Ledger integration across routes, monthly/yearly pricing, centralized paywall/focus restoration, Stripe URL validation, honest success/cancel states. Real backend integration remains unavailable.                                                        |
| F6   | Recorder/provenance/null scoring/privacy/component tests, browser flows, accessibility checks, responsive inspection, production and performance verification. Final counts recorded below.                                                                |

## Architecture and decisions

- Product name, approved by the user on 2026-11-14: **Gambit**. The name is applied to the landing, app navigation, certificate issuer, page titles, OG image and designer previews. It replaces the temporary Work practice name. Scrim was a shortlisted alternative; Gambit is the final choice.
- One public schema source in `src/contracts`; provisional duplicate schemas now re-export it. Private rubric stays outside the public barrel. Designer fixtures/gallery also use the updated contract.
- Product routes live under `src/app/(frontend)`; design galleries use the independent `(design)` layout. Both use Ledger. Temporary F1 styles are removed.
- Real API remains same-origin with HttpOnly server sessions and native SSE. Mocks require `NEXT_PUBLIC_API_MOCKS=1`. No Supabase or browser auth token.
- Chat components only collect notified editor changes and aggregate workspace activity. Bounded flush/retry never blocks a message indefinitely. Missing observations remain null/partial and cannot lower a client-side score. No real score computation is implemented in the frontend.
- Public certificate projection removes processObservations and raw editor data before rendering/serialization. Recorded simulation describes scope; it does not establish identity, unaided authorship or job performance.
- Missing integration details and exact proposed payloads are in `INTEGRATION.md`: auth session shape, document-open write, certificateSlug, checkout billing period, interval object, document shapes and plan confirmation. Intake correction uses the original endpoint.
- User explicitly confirmed backend is not ready. No live API, VPS, real magic link/cookie session, Stripe payment or webhook is represented as tested.

## Verification record — 2026-11-14

- `npm run check`: lint and strict types pass; **97 unit/component tests in 20 files** pass.
- `npm run test:e2e`: **11 Chromium scenarios** pass. Coverage includes full onboarding→twist→review→certificate, unknown-source paste, Copilot insertion corrected against a document, evidence navigation, mobile panels/focus, paywall, deadline autosubmit, early departure, reload coverage loss, safe public SSR/OG, checkout and logout. An extra scenario verifies failed-message recovery after in-app navigation without duplicates.
- Axe: **zero serious/critical violations** on landing, workspace, review, certificate and mobile workspace/review. Desktop/mobile screenshots were inspected.
- `npm run build`: standalone production build passes with mocks disabled. Production smoke verifies 10 route/OG responses, unauthenticated redirects, no preview banner, no owner-only fields in public certificate HTML, and **zero browser errors with reduced motion enabled**. Fixed an SSR/hydration mismatch in the inherited animated score/certificate elements.
- Lighthouse **13.6.0**, local standalone production server, mobile emulation: **Performance 100 / Accessibility 100**. FCP/LCP 0.915 s, TBT 68.5 ms, CLS 0.000515, Speed Index 0.915 s. This is a local lab result, not deployed VPS or real-user performance. Trace/network report captured; minor unused JS/polyfill and 140 ms CSS opportunities did not prevent meeting the >=90 target.
- `npm run format:check` and `git diff --check` pass. Final branch review covered public/private contract separation, SSR projection, timer/outcome states, retries/cache invalidation, observation lifetime, keyboard and mobile behavior, and scope boundaries.

Real authenticated API, email delivery, cookie security, VPS SSE and Stripe/webhook integration remain unverified because the backend is not ready. No backend or deployment implementation was added.

## Next step

Frontend F1–F6 is complete on the delivery branch. When backend becomes available, follow `INTEGRATION.md` to agree the remaining contracts and run real integration checks. Do not start PM/Software or backend work without a new scope decision.
