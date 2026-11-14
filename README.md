# Skills Simulation — backend

Backend implementation for the BusinessCup 2026 Sales simulation. The product specification is in [CONTEXT.md](docs/spec/CONTEXT.md); backend tasks are in [PROMPT_BACKEND.md](docs/spec/PROMPT_BACKEND.md).

## Current status

Implementation is in progress, starting with T0 contracts and fixtures. See the [execution ledger](docs/superpowers/plans/2026-11-14-backend-progress.md) for verified stage results. No live deployment is claimed.

The frontend is developed separately by a teammate. This branch owns backend modules, API routes, contracts, fixture data, PostgreSQL migrations, worker and deployment configuration. It does not implement frontend screens.

## Local preparation

Use Node.js 22 or newer and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
```

Set the local environment using `.env.example`. Production uses OpenAI; `LLM_MODEL` must be an API model available to your account. Keep database, OpenAI, SMTP and Stripe credentials in `.env` or deployment secrets, never in Git or browser configuration.

```sh
pnpm test
pnpm typecheck
pnpm lint
```

Run/deploy and integration-test instructions will be completed with their corresponding implementation stages.

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
