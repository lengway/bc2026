# Gambit

Sales simulation with Ledger frontend F1–F6 and the team’s T0–T5 backend for [lengway/bc2026](https://github.com/lengway/bc2026), on `fe/frontend`. The product uses the team’s Ledger design system. The product name is **Gambit**, selected by the user on 2026-11-14. Updated requirements are in `docs/reference`.

## Run

Use Node 24 (minimum 22.12). npm is supported locally; CI and deployment use pnpm 11.25.0. Keep both lockfiles synchronized.

```sh
npm ci
# PowerShell: Copy-Item .env.example .env
# For the browser-only preview, explicitly set NEXT_PUBLIC_API_MOCKS=1.
npm run dev
```

Open http://127.0.0.1:3000. With `NEXT_PUBLIC_API_MOCKS=1`, enter an email on `/login`, request a link, then click **Open preview sign-in link**. No email is sent. Follow onboarding, acknowledge the recording notice, practice with Dana and Copilot, submit, open the review and certificate. `/path` shows completed practice. `/c/sample` and `/c/sample-full` are fictional public examples; `/design` preserves the component gallery.

MSW runs in the browser and must finish starting before data consumers mount. Preview sessions/cases use non-secret tab-local storage. Editor changes stay in RAM; reloads can reduce observation coverage. Dynamic preview certificates cannot be shared outside that tab. Mocked scores/AI checks are illustrative fixtures, not professional assessments. Checkout does not collect money or activate a subscription.

## Verify

```sh
# Combined tests need TEST_DATABASE_URL pointing to local test PostgreSQL.
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
npm run format:check
```

Browser tests start the MSW preview on port 3100. See `docs/FRONTEND.md` for verification results and scope. CI verifies both Node/backend and jsdom/frontend tests, formatting, build, and Chromium E2E. Standalone Next output is enabled; production packaging must include `public` and `.next/static`.

## Code map

- `src/app/(frontend)`: landing/login, protected onboarding/dashboard/case/review/path, public certificates/pricing, billing return states.
- `src/ui`, `src/screens`: Ledger primitives and presentational screens. The separate `(design)` root preserves designer previews.
- `src/contracts`: updated public schemas, including assistance, scoring, telemetry and safe certificate projections. The private rubric is excluded from the public barrel.
- `src/app/_lib`: validated API, trusted server origin/cookie forwarding, safe public certificate loader, integration proposals. `_hooks` owns queries and stable optimistic mutations.
- `src/workspaces/chat`: conversation UI, SSE/HTTP replay/deduplication, server-based deadline, applied editor changes and bounded RAM-only batch delivery.
- `src/mocks`: authenticated mock handlers, deterministic scenarios and preview-only projections.

The backend merged from main supplies API routes, PostgreSQL migrations, the evaluation worker and deployment scripts. Real scoring, attribution, activity analysis, ownership and subscription enforcement remain server responsibilities. See [backend handoff](docs/backend-handoff.md) and [deployment instructions](deploy/README.md).

## Run the real application

Set `NEXT_PUBLIC_API_MOCKS=0`, set server-only `APP_URL` to the canonical application origin, and rebuild. Set DATABASE_URL and the server-only provider configuration in .env, then run `npm run db:migrate`. Start `npm run dev` and `npm run worker` in separate terminals. `npm run seed:onboarding` and `npm run test:live` call paid providers; they are not part of the ordinary test suite. Frontend sends no browser token or custom secret header. Magic-link verification/cookies, Origin checks, SSE replay and Stripe webhook access require server validation.

Read [integration contracts and real-API checklist](docs/INTEGRATION.md) before connecting. Backend source is integrated and its isolated PostgreSQL tests pass. Live OpenAI, email delivery, VPS streams and Stripe delivery remain external integration checks. The real auth API supports guest sessions when enabled server-side; a guest-entry UI is not part of this conflict-resolution change. Public certificates use SSR and generated OG in real mode; only safe public fields are serialized. Null scores remain **Not enough evidence**, and certificates say **Recorded simulation**.

See [scope and progress](docs/FRONTEND.md) and the [implementation plan](docs/superpowers/plans/2026-11-14-f2-f6-product.md) for continuation.

Backend tests create and drop randomly named `bc_test_*` databases; TEST_DATABASE_URL must use a local test account with database-creation permission. Missing PostgreSQL is a test failure, not a skipped check. `npm run test:backend` and `npm run test:frontend` run each project separately.
