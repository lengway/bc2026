# Gambit · frontend

Frontend F1–F6 for [lengway/bc2026](https://github.com/lengway/bc2026), on `fe/frontend`. The product uses the team’s Ledger design system. The product name is **Gambit**, selected by the user on 2026-11-14. Updated requirements are in `docs/reference`.

## Run

Use Node 24 (minimum 22.12) and npm.

```sh
npm ci
# PowerShell: Copy-Item .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3000. With `NEXT_PUBLIC_API_MOCKS=1`, enter an email on `/login`, request a link, then click **Open preview sign-in link**. No email is sent. Follow onboarding, acknowledge the recording notice, practice with Dana and Copilot, submit, open the review and certificate. `/path` shows completed practice. `/c/sample` and `/c/sample-full` are fictional public examples; `/design` preserves the component gallery.

MSW runs in the browser and must finish starting before data consumers mount. Preview sessions/cases use non-secret tab-local storage. Editor changes stay in RAM; reloads can reduce observation coverage. Dynamic preview certificates cannot be shared outside that tab. Mocked scores/AI checks are illustrative fixtures, not professional assessments. Checkout does not collect money or activate a subscription.

## Verify

```sh
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

Browser tests start the MSW preview on port 3100. See `docs/FRONTEND.md` for verification results and scope. CI/VPS deployment remain backend-owned. Standalone Next output is enabled; production packaging must include `public` and `.next/static`.

## Code map

- `src/app/(frontend)`: landing/login, protected onboarding/dashboard/case/review/path, public certificates/pricing, billing return states.
- `src/ui`, `src/screens`: Ledger primitives and presentational screens. The separate `(design)` root preserves designer previews.
- `src/contracts`: updated public schemas, including assistance, scoring, telemetry and safe certificate projections. The private rubric is excluded from the public barrel.
- `src/app/_lib`: validated API, trusted server origin/cookie forwarding, safe public certificate loader, integration proposals. `_hooks` owns queries and stable optimistic mutations.
- `src/workspaces/chat`: conversation UI, SSE/HTTP replay/deduplication, server-based deadline, applied editor changes and bounded RAM-only batch delivery.
- `src/mocks`: authenticated mock handlers, deterministic scenarios and preview-only projections.

No API routes, database changes, workers or deployment scripts are implemented here. Real scoring, attribution, activity analysis, ownership and subscription enforcement are server responsibilities.

## Connect the backend

Set `NEXT_PUBLIC_API_MOCKS=0`, set server-only `APP_URL` to the canonical application origin, and rebuild. Supply the same-origin endpoints from the updated CONTEXT. Frontend sends no browser token or custom secret header. Magic-link verification/cookies, Origin checks, SSE replay and Stripe webhook access require server validation.

Read [integration contracts and real-API checklist](docs/INTEGRATION.md) before connecting. Backend is not ready, so live email delivery, authenticated sessions, VPS streams and Stripe remain unverified. Public certificates use SSR and generated OG in real mode; only safe public fields are serialized. Null scores remain **Not enough evidence**, and certificates say **Recorded simulation**.

See [scope and progress](docs/FRONTEND.md) and the [implementation plan](docs/superpowers/plans/2026-11-14-f2-f6-product.md) for continuation.
