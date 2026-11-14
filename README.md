# Skills Simulation

Backend implementation for the BusinessCup 2026 Sales simulation. The product specification is in [CONTEXT.md](docs/spec/CONTEXT.md); backend tasks are in [PROMPT_BACKEND.md](docs/spec/PROMPT_BACKEND.md).

## Current status

T0–T5 backend code is implemented: contracts, auth/guest access, generation, simulation, evidence-based review, certificates, progress, Stripe test billing, HTTP/SSE and worker. See the [execution ledger](docs/superpowers/plans/2026-11-14-backend-progress.md) for verification and remaining external checks. No live deployment is claimed.

This branch combines the backend with the teammate's landing, design gallery and review components from `main`. Their layouts and styling are retained; bindings and gallery fixtures use the shared backend contracts. The full product flow on `fe/frontend` is a separate branch and has not been merged here. See [DESIGN_HANDOFF.md](DESIGN_HANDOFF.md) for the design surface and [backend-handoff.md](docs/backend-handoff.md) for the API.

## Local preparation

Use Node.js 22 or newer and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
```

Set the local environment using `.env.example`. `LLM_MODEL=gpt-6.1-sol` handles generation/rubrics, `LLM_MODEL_DIALOGUE=gpt-6.1-terra` handles intake/personas/copilot/twists, and `LLM_MODEL_EVALUATION=gpt-6.1-sol` handles the final review. Optional role values fall back to `LLM_MODEL`. Keep database, OpenAI, SMTP and Stripe credentials in `.env` or deployment secrets, never in Git or browser configuration.

```sh
pnpm test
pnpm test:backend
pnpm test:frontend
pnpm typecheck
pnpm lint
pnpm build
```

`pnpm db:migrate` applies SQL migrations using `DATABASE_URL`. Tests require `TEST_DATABASE_URL` in the environment or ignored `.env.test.local`; that account needs permission to create disposable databases. Tests create and drop only randomly named `bc_test_*` databases, never the database named in your connection string. Tests fail explicitly when PostgreSQL is unavailable.

`pnpm test` runs both projects: server tests in Node.js and UI tests in jsdom with the design branch's React setup. The focused commands run each project separately. pnpm is the CI/VPS package manager; `package-lock.json` is also synchronized for teammates using npm. Keep both lockfiles synchronized when changing dependencies.

Run `pnpm dev` and `pnpm worker` in separate terminals after migrating. For a production build use `pnpm build` then `pnpm start`, keeping the worker running separately. `/`, `/design`, `/design/landing` and `/design/review` serve the existing design work. Cache Components is disabled because the backend route handlers explicitly use request-time execution; the design's Tailwind/Turbopack configuration is preserved.

Paid checks are opt-in: `LLM_LIVE=1 pnpm test:live` (PowerShell: set `$env:LLM_LIVE='1'`, then run the command). It uses a disposable PostgreSQL database and real OpenAI, with email/payment network calls disabled. The runner reserves a conservative cost estimate before each request, stops at $1 per run or $12 cumulative reserved in ignored `.tmp/llm-live-spend.json`, and serializes runs through a lock. Do not delete that ledger to bypass the limit. This is a local smoke-runner guard, not an account-wide or production spending limit. Keep $3 of the approved $15 for the pitch. Verify actual usage in the provider dashboard, especially after requests with no reported usage. The sanitized synthetic LLM journal is saved to ignored `.tmp/live-smoke-llm-journal.json` before the disposable database is removed, including failed runs.

Current external check (2026-11-14): the replacement key completed one real OpenAI service flow on disposable PostgreSQL: intake, original case/rubric, two persona replies, copilot, evaluation and one guest certificate. Seven requests succeeded on their first attempt, with estimated usage cost $0.1128. Case/rubric generation took about 91 seconds and evaluation 33 seconds. This verifies the integration on one synthetic scenario, not general grading reliability. SMTP fields, real Stripe delivery and VPS deployment still require configuration/checks.

After migrations, `pnpm seed:onboarding` uses the configured OpenAI model to prepare nine onboarding templates: one per level in each of the three Sales subfields. This command makes real provider calls. It skips existing templates on retry. Each user receives separate case/persona records; repeated practice generates a fresh scenario after that user's matching template has been used.

See [VPS deployment and backup instructions](deploy/README.md). Docker Compose starts migration, web, worker, PostgreSQL and Caddy. OpenAI/SMTP/Stripe integrations need real local configuration; mocks verify service behavior only. Set `GUEST_ACCESS_ENABLED=true` to enable the approved jury flow; details and frontend additions are in the [guest-access addendum](docs/superpowers/specs/2026-11-14-guest-access-design.md).

## Architecture

1. Next.js route handlers validate requests and call modules through `index.ts`.
2. PostgreSQL is private to the server; repositories use parameterized queries.
3. Magic links establish server-side cookie sessions.
4. Events provide ordered, idempotent simulation history and safe SSE projections.
5. PostgreSQL jobs and a separate worker run generation and evaluation durably.
6. Only the LLM module imports the provider SDK.
7. Case performance, observed assistance and AI-advice checks are separate measures.
8. Evidence and saved scoring versions make grading inspectable.
9. Private editor/interaction data and diagnostics are excluded from public certificates.
10. Docker Compose deploys the application, worker, database and Caddy to a VPS.

All pushes and pull requests are performed by the repository owner.
