# Frontend scope and progress

## Source of truth

The user supplied updated `PROMPT_FRONTEND (2).md` and `CONTEXT (2).md` on 2026-11-14. Their contents are preserved in `docs/reference/PROMPT_FRONTEND.md` and `docs/reference/CONTEXT.md`. CONTEXT takes precedence if the specifications conflict. The original Supabase/Vercel architecture is superseded by a VPS, backend HttpOnly cookie sessions and same-origin SSE.

## Agreed scope and approach

Frontend only, delivered in order by epics F1–F6. Sales/chat is active; PM/Software are future work. English UI and code. The user authorized implementation and the separate `fe/frontend` branch. The remote repository was empty at checkout. Design commit `96918f2` arrived during F1; the frontend branch is rebased onto it before publication.

Frontend owns `src/app` except `api`, `src/workspaces`, MSW handlers, data hooks and frontend tests. Backend owns API/business logic, shared contracts/fixtures, PostgreSQL, worker and deployment. Design owns `src/ui`, `src/screens` and final tokens. Temporary presentation lives in frontend containers. No backend or final design implementation is included.

We retained the specified Next.js stack and epic order. A vertical slice first was considered; the user explicitly chose epics. Superpowers planning, implementation, debugging and verification are applied proportionately, with one agent as requested. No new product direction is implied by a technical migration to the updated spec.

## Epic acceptance and status

| Epic | Deliverable                                                                    | Acceptance                                                                                   | Status          |
| ---- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------- |
| F1   | Foundation, auth integration, validated API client, hooks, mocks, route shells | Types/lint/tests/build/browser checks; mock preview without credentials                      | Complete        |
| F2   | Onboarding, generation, brief                                                  | Editable profile, timed progress and retry, complete scoring guide before start              | Next            |
| F3   | Chat workspace                                                                 | Documents/Copilot, timer/endings, recovery, editor and interaction aggregates, mobile sheets | Planned         |
| F4   | Review, public certificate, dashboard, path                                    | Evidence navigation, server score breakdown, honest nullable metrics, safe public SSR        | Planned         |
| F5   | Payments and real integrations                                                 | Backend APIs/VPS and design screens integrated; checkout tested                              | Depends on team |
| F6   | Polish                                                                         | Required E2E, accessibility and performance targets verified                                 | Planned         |

## F1 decisions

- The separate clone and branch provide isolation. Incoming main commit `96918f2` is retained as the base; design screens, shared schemas and theme tokens are preserved.
- `src/app/_lib/contracts.ts` plus `schemas/` are explicitly provisional frontend schemas. Mock scenarios live in `src/mocks/scenarios`, leaving backend-owned shared contracts and fixtures untouched.
- All API JSON is parsed at the boundary; mutations never retry automatically. PAYWALL opens one accessible dialog. Failed sends retain text and retry identity.
- RSC renders public content and private route shells. Real private SSR hydration waits for backend integration. Server calls forward the cookie; mutations also set trusted Origin.
- `/login` requests a magic link. `/api/auth/verify` belongs entirely to backend; there is no frontend callback or auth SDK. Proxy/layout/session gate check the session. The API must independently enforce auth/ownership.
- Native SSE follows initial history, uses the server lastSeq including private gaps, and parses only PublicEventMeta. 401/404 terminate the subscription; temporary errors trigger backoff/polling. Browser mocks use polling and cannot validate the production SSE transport.
- Generating/failed responses have no brief. Nullable scoring is preserved, and public schemas strip owner-only observations. No client formula computes an actual user score; mock results are clearly fictional fixtures.
- EditorBatch/InteractionWindow schemas and idempotent mock acknowledgements prepare F3. The F1 preview collects no editor/pointer telemetry. Its notice explicitly says so.
- The mock session marker is not an auth token. The browser MSW Origin fallback models browser-added headers only in mock mode; foreign explicit Origin remains rejected.

## Integration decisions still needed

1. Update the older shared `src/contracts` from design to the latest CONTEXT, then replace provisional schemas/scenarios with those exports/fixtures, including the exact interval-summary shape inside InteractionWindow (provisionally count/minMs/maxMs/meanMs).
2. Review lacks a specified certificate slug/availability field. The optional `certificateSlug` preview extension needs agreement before F4.
3. F2 profile correction needs a persisted API contract (the current intake input has only text/field/level). Also agree entitlements, display-name edits and checkout interval if required by design.
4. Confirm WorkspacePlugin and presentation screen props with design. DESIGN_HANDOFF predates this spec: its no-insert Copilot rule, legacy AI-dependency labels, generic Event.meta and certificate claims must be reconciled before F3/F4 integration; the updated user files take precedence.
5. Validate email link redirects, cookie expiration/revocation, server Origin checks, safe public projections, SSE replay/reconnect and checkout on the real same-origin API/VPS.

Previously open questions about startedAt, generating shape, public metadata, clientMsgId/draftId and event history are resolved by the updated specification.

## Shared-repository integration

- npm and its existing package-lock are retained; package dependencies are combined. One Vitest configuration runs both frontend and designer tests.
- Separate root layouts isolate temporary frontend styles from the unchanged designer theme and `/design` galleries. Product URLs are unchanged.
- Next Cache Components remains disabled for F1 private cookie/session routes; enabling it requires an explicit caching design. The designer galleries do not depend on it.
- The Next starter `/` is replaced by the F1 landing. Designer landing/review remain previewable at their original URLs until their scoring contracts and wording are updated.

## Verification record — 2026-11-14

- `npm run check`: lint and strict types pass; **73 tests across 14 files pass** (38 frontend, 35 existing design).
- `npm run test:e2e`: **6 Chromium scenarios pass**: API preview sign-in, conversation/reload/twist/Copilot/submit, paywall focus restoration, mobile layout/axe, public certificate projection, logout, and layout isolation with the design gallery (the conversation scenario combines several actions).
- Mobile dashboard axe check: zero serious/critical violations. Full multi-screen accessibility/performance audit remains F6.
- `npm run build`: standalone production build passes with mocks disabled; all product and gallery routes compile.
- Standalone server smoke: landing/login/design return 200, unknown route 404; unauthenticated dashboard/case return 307 to login. Real mode has no preview banner. This verifies route guards with no backend, not a live cookie session.
- Desktop workspace, mobile dashboard and design-gallery screenshots inspected. Copilot ordering and UTF-8 separators confirmed after fixes.
- `npm audit --omit=dev`: zero reported vulnerabilities. Full audit reports 12 low/moderate findings in development tooling; no forced major upgrades were applied.
- Self-review covered contract sanitization, null scoring, session/CSRF boundaries, retry identity, SSE cleanup and coexistence with main. Design-owned `src/ui`, `src/screens`, `src/contracts` and theme contents remain unchanged.

Real email delivery, HttpOnly cookie behavior, authenticated backend responses, SSE replay on VPS, Stripe and final screen integration remain unverified until F5. No F3 editor/pointer collection or client-side scoring is active.

## Next step

F1 is complete; delivery branch is `fe/frontend`, based on main design commit `96918f2`. Continue F2: field/level and optional intake, profile confirmation/correction, timed preparation with retry, and the full brief/scoring guide. Persist corrected profile through an agreed backend contract rather than inventing an endpoint. See the integration decisions above before changing shared schemas or attaching designer screens to live data.
