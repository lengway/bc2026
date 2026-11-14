# F1 Frontend Foundation Implementation Plan

> Execute with Superpowers proportionately. The user authorized implementation and prefers one agent; no further execution-choice approval is required.

**Goal:** Runnable frontend foundation on `fe/frontend`: validated networking, recoverable optimistic messaging, backend cookie-session integration, SSE and browser mocks.

**Architecture:** Next.js App Router shells and auth routing, TanStack Query client state, Zod schemas. MSW simulates APIs without server routes. Temporary schemas/presentation remain in frontend-owned locations.

**Stack:** Next.js 16, React 19, strict TypeScript, Tailwind 4, shadcn configuration, TanStack Query, Zod, MSW 3, Vitest/Testing Library, Playwright.

**Requirements:** Updated `docs/reference/CONTEXT.md` and `PROMPT_FRONTEND.md`; scope/decisions in `docs/FRONTEND.md`. This plan replaces the original Supabase implementation direction following the user's updated files.

## Constraints and review focus

- Frontend only: no API/business logic, database, worker, deployment, final screens or theme tokens.
- English UI, no `any` or API payload type assertions; runtime Zod validation.
- Safe public event/certificate projections; generating has no premature brief; unknown scores remain null.
- HTTP/SSE races cannot duplicate messages or erase newer replies; failed sends preserve text and retry identity.
- Magic-link consumption and HttpOnly cookies are backend-owned. Browser mutations use normal Origin; server mutations explicitly forward Origin and cookies. Validate mock CSRF and session lifecycle.
- SSE loads history, resumes from lastSeq, stops on 401/404 and cleans up. Temporary failure permits polling/backoff, never a retry storm.
- No editor/pointer collection until F3 notice and lifecycle are implemented.
- Behavioral tests and a scoped self-review; no parallel agents or repeated checks without a new reason.

## Task 1 — Network boundary and scenarios

Files: `src/app/_lib/{api-client,api,contracts}.ts`, `schemas/`, `src/mocks/{handlers,browser}.ts`, `scenarios/sales.ts`, corresponding tests.

- [x] Test malformed JSON/shape, typed errors, hidden field stripping, scenario progression and idempotency before implementation.
- [x] Implement validated API boundary and deterministic mock endpoints.
- [x] Adopt updated SessionView, CaseResponse, EventsPage, scoring/public projections and EditorBatch/ack schemas.
- [x] Cover CSRF rejection, one-use preview magic link/logout, minimal generating response, duplicate batches and ended-case rejection.
- [x] Preserve null metrics and absence of owner diagnostics on public projections.

## Task 2 — Query state and event delivery

Files: `src/app/_hooks/*`, `src/workspaces/chat/{events,realtime}.ts`, `src/app/_components/providers.tsx`, corresponding tests.

- [x] Test optimistic failure/retry with real QueryClient and mocked HTTP.
- [x] Implement required hooks and centralized PAYWALL handling.
- [x] Add failing race regression; reconcile optimistic, SSE-first and HTTP responses without duplicates.
- [x] Replace former realtime integration with history + native SSE and 2-second fallback polling.
- [x] Cover cursor/private gaps, malformed metadata stripping, cleanup, 401/404 termination and temporary-error recovery.
- [x] Fix duplicate GET at polling/reconnect boundary; all controller tests pass.

## Task 3 — Auth, route shells and browser preview

Files: `src/proxy.ts`, `src/app/_lib/auth/*`, protected layout, login, session gate, route containers, `tests/e2e/foundation.spec.ts`.

- [x] Validate safe internal auth return paths and reject external/encoded redirects.
- [x] Replace Supabase with cookie-session API integration, server cookie/Origin forwarding and logout cache clearing.
- [x] Initialize MSW only in a browser-only dynamically loaded component before interactive consumers.
- [x] Supply all route shells plus a small conversation/submit/review preview.
- [x] Exercise the browser workflow; identify missing Origin at Service Worker interception and fix only the browser mock adapter.
- [x] Verify 37 unit/integration tests, types and lint after the mock-Origin fix.
- [x] Complete current browser acceptance: sign-in, conversation/reload/twist/Copilot/submit, paywall focus, mobile a11y, safe public certificate and logout.
- [x] Inspect desktop/mobile screenshots and production standalone build; check real-mode private route guards without a backend.
- [x] Update progress with actual results and known integration limits. Delivery target: only `fe/frontend`.

## Incoming design baseline

- [x] Inspect main commit `96918f2` and preserve team-owned design/shared schemas.
- [x] Combine dependencies using the team npm lockfile and isolate root layouts without changing product URLs.
- [x] Verify the combined tests/build and design gallery alongside F1 acceptance: 73 tests, 6 browser scenarios, successful production build.
- Delivery: finish the rebase onto main and publish `fe/frontend`; do not merge or push main.

## Handoff

F2 implements the full onboarding and brief flow. F3 owns the complete chat plugin/timer/telemetry. F4 owns detailed results/certificate SSR. F5 depends on real backend/VPS and design screens. None is complete merely because an F1 shell exists.
