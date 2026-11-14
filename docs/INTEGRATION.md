# Frontend → backend integration

Backend was confirmed **not ready** by the user on 2026-11-14. The frontend implements F1–F6 using explicit MSW preview mode. No live backend, email service, Stripe account, database, worker or deployment was changed.

## Agreed boundary

Use the updated `docs/reference/CONTEXT.md` and `PROMPT_FRONTEND.md`. The original root documents and design handoff predate the current scoring/auth requirements. `src/contracts/index.ts` is the single public Zod export; the private rubric is deliberately not exported. Compatibility imports under `src/app/_lib/contracts.ts` resolve to it.

`NEXT_PUBLIC_API_MOCKS=0` plus a **rebuild** disables browser mocks. Set server-only `APP_URL` to the canonical trusted application origin. Browser API and SSE requests use same-origin cookies; server session requests explicitly forward Cookie, and server mutations set Origin from this configured value. No token is stored in browser storage. Verify HttpOnly/Secure/SameSite flags, session revocation, ownership and Origin enforcement on the actual server.

## Contracts requiring team agreement

| Boundary                    | Frontend behavior                                                                                                                                               | Backend action                                                                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth session                | `GET /api/auth/session` returns `null` or `{user:{id,email,displayName},expiresAt}`; logout POST returns `{ok:true}`; magic-link POST returns `{accepted:true}` | Confirm these shapes and magic-link verification redirect/cookie behavior.                                                                                                     |
| Document opened             | Proposed `POST /api/cases/:id/events` body `{type:"doc_open",documentId,clientMsgId}`; response `{accepted:true}`                                               | Add/confirm this write transport. Frontend isolates it in `integration-api.ts`; failure never blocks reading.                                                                  |
| Certificate link            | Optional `certificateSlug` on the review response                                                                                                               | Return the issued public slug; frontend does not derive a real URL from case ID. Without it, review explains that the link has not been issued.                                |
| Billing period              | Proposed checkout body `{billing:"monthly"                                                                                                                      | "yearly"}`                                                                                                                                                                     | Select the corresponding Stripe price server-side. Prices are $19 monthly / $149 yearly per spec. Browser accepts only HTTPS `checkout.stripe.com` redirects (plus local preview success). |
| Interaction intervals       | `{count,minMs,maxMs,meanMs}` with null measurements when no intervals are observed                                                                              | Confirm this concrete shape in `contracts/telemetry.ts`; original spec does not define the interval object.                                                                    |
| Structured document content | Five schemas in `contracts/docs.ts`: email, CRM, Slack, table, note                                                                                             | Confirm generation payloads. Unknown content falls back to escaped readable text/JSON.                                                                                         |
| Profile corrections         | Edit the original intake answer/field/level, then POST `/api/intake` again                                                                                      | Intake must persist the confirmed profile. No separate profile-write API is invented.                                                                                          |
| Billing confirmation        | Success page states that confirmation is pending; URL never grants Pro                                                                                          | No entitlement/session subscription field exists in the supplied contract. Server must enforce plan access; add a plan-status contract if the UI should display confirmed Pro. |

## Runtime requirements

- Case GET returns either minimal `{id,status:"generating"|"failed"}` or full CaseView with `startedAt`, public scoring guide, personas and only currently available docs. `startedAt` is null before start, then immutable; timer uses this timestamp and timeLimitSec. Server clock must be correct and enforce its own deadline.
- Start and submit must be idempotent. Moves and Copilot requests use stable UUID `clientMsgId` for retries. A user message also carries its UUID `draftId`. A retry must return the original result without adding another message.
- SSE `case_event` records use event `seq`, with replay by `afterSeq`; HTTP event history and SSE reconcile by ID, seq and clientMsgId. Public meta allows only typingMs, trustAfter and documentIds. Expiration/ownership errors must stop access.
- Editing batches use `{batchId,draftId,events,interactionWindows}` and an acknowledgment `{acceptedCount,lastDraftSeq,acceptedWindowCount}`. Deduplicate batchId, editor IDs/draft sequence and window IDs. Validate ownership and close drafts after accepted messages; reject late writes to evaluated cases.
- Editor ranges describe applied changes in UTF-16 offsets. SourceEventId is supplied only for observed Copy→Paste or explicit Copilot insertion. Copy alone is not insertion. Unknown source, input mode, webdriver and event trust are observations, not proof of authorship. All assessment/retained-text/similarity/automation analysis is server-owned.
- Raw editor changes are queued in RAM only. Interaction windows keep counts, intervals and aggregate normalized movement, never a trajectory. Pointer sampling is throttled; collection pauses while hidden. A bounded telemetry flush precedes send/submit; failures permit the main action and display reduced coverage.
- Review responses must preserve null metrics and independent assistance, AI-check score, four-state trap result, score audit and owner-only processObservations. The frontend displays saved calculations; it does not calculate real scores or punish input style.
- Public certificates are server-rendered through the public certificate endpoint, without forwarding owner cookies. Zod removes owner diagnostics, private event meta and raw drafts before serialization. Full transcript entries need stable event IDs for evidence links. Missing public docs remain quotations, never private API links. OG reads this same safe public projection.

## Preview limits

MSW authentication is a non-secret sessionStorage marker. Cases/messages persist within a browser tab; raw editor events do not. A reload can therefore make retained-text coverage unavailable. `/c/sample` and `/c/sample-full` are explicitly fictional SSR examples. Dynamic `preview-…` certificates use the tab-local MSW record and cannot be shared with another browser or link crawler. Real certificates and OG are SSR when mocks are disabled and the API exists.

The mocked sales conversation produces a document twist after the second move, a normal end after four moves, and a deterministic pricing-advice example (30% suggestion vs documented 10% ceiling). Mock helpers are scenario fixtures, not production scoring algorithms. Browser test-only `bc2026.preview.scenario=left` exercises early departure; `fail-next-move` exercises recoverable send errors. Preview checkout neither collects payment nor changes plans. Browser preview uses polling; SSE mechanics are covered separately by unit tests.

## First real integration run

1. Confirm the table above and deploy API/worker behind the same origin.
2. Build frontend with mocks disabled and canonical APP_URL. Check public SSR/OG and unauthenticated redirects.
3. Use a real emailed link; verify cookie flags, one-use token behavior, logout and revocation across open tabs.
4. Run onboarding → generation → acknowledged brief → moves/Copilot/twist → submit → owner review → both certificate access levels. Check server editor receipts, evidence IDs, null/partial coverage and absence of private data in HTML/OG.
5. Disconnect/reconnect SSE, expire a session, retry a move, close a draft and pass the deadline. Check ownership, Origin rejection and rate limits.
6. Exercise Stripe test-mode monthly/yearly checkout, cancellation and webhook-confirmed plan access. The success URL must never grant access by itself.

These are external integration checks, not claims of completed backend verification.
