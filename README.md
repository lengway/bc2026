# Work practice · frontend

Frontend-only implementation for [lengway/bc2026](https://github.com/lengway/bc2026), on the dedicated `fe/frontend` branch. Product name is not yet selected. The team design system is preserved in `src/ui`, `src/screens` and `src/app/globals.css`. The updated specifications are saved in `docs/reference`.

## Run locally

Use Node 24 and npm (Node >=22.12 supported). npm matches the shared design repository.

```sh
npm ci
# Copy .env.example to .env.local (PowerShell: Copy-Item .env.example .env.local)
npm run dev
```

Open <http://127.0.0.1:3000>. `NEXT_PUBLIC_API_MOCKS=1` explicitly enables the labeled preview. Enter an email on `/login`, request a link, then use **Open preview sign-in link**. No email is sent. The preview simulates the API session flow using a non-secret sessionStorage marker; it does not implement real cookie security. Fictional cases persist within the browser tab. No backend or credentials are required.

## Checks

```sh
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

Browser tests start a separate mock preview on port 3100. `/design`, `/design/landing` and `/design/review` preserve the designer previews; these currently use their original, older fixture contracts. CI and deployment remain backend-owned; these scripts are ready for the shared workflow. Next's standalone output is enabled for the planned VPS integration. A standalone deployment must also include `public` and `.next/static`; packaging and VPS deployment remain backend-owned.

## Architecture

- `src/app` owns routes, authentication integration, data containers and temporary presentation. `src/ui` and `src/screens` belong to design. Product routes are grouped under `src/app/(frontend)`; `/design` lives under `src/app/(design)` with its original styling and fonts in a separate root layout.
- `src/app/_lib/contracts.ts` and `schemas/` provide provisional Zod schemas derived from the updated CONTEXT. The newly arrived `src/contracts` from design still describes the older scoring/events model. Replace this boundary only after those shared exports adopt the updated spec.
- `api-client.ts` validates JSON responses, normalizes errors, forwards same-origin cookies, and supports cancellation/timeouts. `api.ts` declares endpoint calls. `server-api.ts` explicitly forwards cookie and mutation Origin from the trusted `APP_URL`.
- `src/app/_hooks/case-hooks.ts` owns Query state, mutations and optimistic messages. HTTP/SSE races reconcile by event ID, server sequence and clientMsgId; retry preserves draftId and clientMsgId.
- `src/workspaces/chat/realtime.ts` loads event history, then opens native SSE from lastSeq. It probes `/events` after stream errors, stops on 401/404, and uses backoff plus 2-second fallback polling for temporary failures. Unmount closes the connection and aborts reads.
- `src/mocks` supplies MSW handlers and fictional scenarios. Browser preview uses polling; SSE controller behavior is tested separately. Actual VPS SSE remains an integration check.
- `Providers` starts browser-only mocks before data consumers mount and handles PAYWALL centrally. Protected route proxy/layout and a client session gate check the backend session.

Frontend work adds no API routes, business modules, database changes, workers, deployment scripts or Supabase SDKs.

## Connect to the backend

Set `NEXT_PUBLIC_API_MOCKS=0` and `APP_URL` to the trusted application origin, then rebuild. The backend must expose same-origin `/api` endpoints from CONTEXT §11. Login requests `/api/auth/magic-link`; the emailed `/api/auth/verify` link is consumed by the backend, which sets the HttpOnly cookie. The frontend reads `/api/auth/session` and posts `/api/auth/logout`. No browser auth token or extra secret header is used. Real email delivery, cookie flags, ownership checks and CSRF enforcement require the backend.

MSW checks POST Origin against the request origin. Because Service Worker interception may occur before the browser adds Origin, the browser-only mock initializer supplies its known page origin as a fallback. Explicit foreign Origin still returns 403; real requests and server checks do not use this mock fallback.

Only public event metadata is accepted. Generating/failed cases expose just id/status. Null scores render **Not enough evidence**. The public certificate projection excludes owner process observations and raw editor data; it describes a **Recorded simulation**, with no authorship or identity claim.

## Epic status

See [scope, decisions and progress](docs/FRONTEND.md) and [F1 implementation plan](docs/superpowers/plans/2026-11-14-f1-foundation.md). F1 is complete and verified (73 tests, 6 browser scenarios, production build). It includes a small conversation preview to exercise the foundation. Onboarding, full scoring guide, timer/autosubmit, editor activity collection, adaptive sheets, detailed review/certificates and final design belong to F2–F6. EditorBatch schemas and mock acknowledgements exist; the preview does not collect editor/pointer telemetry yet.

## Documentation checked

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- Bundled Next.js guides in `node_modules/next/dist/docs`
- [MSW browser initialization](https://mswjs.io/api/setup-worker/start) (v3 uses `onUnhandledFrame`)
- [TanStack Query server rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)

Dependencies are pinned in the lockfile. ESLint 9 and TypeScript 6 are retained for compatibility with the current Next ESLint plugins; update them together when supported peer ranges allow it.
