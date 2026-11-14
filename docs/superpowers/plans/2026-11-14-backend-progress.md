# Backend progress — plan: docs/superpowers/plans/2026-11-14-backend.md

## Current state

- Execution authorized 2026-11-14. T0 and T1 implemented and reviewed; T2 is next.
- Specifications verified unchanged: CONTEXT SHA256 b5b1f4a8841ec1162acaac3d7eeea996428fbdd4004300fd61330df9c49ae1f1; backend prompt SHA256 119289e00d5ff8dc463073fccd928092ae352b5071d31c0eb10920ce1320c54e.
- Remote lengway/bc2026 is empty and private; local be/backend contains documentation commit 00d87ec. User owns all pushes/PRs.
- User confirms VPS, LLM and SMTP available; OpenAI provider. Credentials are not yet present in the workspace.
- Node/pnpm available; PostgreSQL installation found; Docker not found in PATH. Use an isolated local PostgreSQL cluster for integration checks when possible.
- Shared root build/package configuration is required for the backend-only starter. Frontend implementation remains untouched.

## Decisions and coordination

- User approved server-flag guest access for jury, with separate guest sessions (2026-11-14). See ../specs/2026-11-14-guest-access-design.md. Integrate auth/config in T1, certificate demo indicator in T4, routes/billing restriction in T5. No admin UI and no frontend changes.

- Keep the current local branch/workspace; no need for an additional worktree in an otherwise empty repository.
- Complete T0–T5 sequentially. Delegate only substantial isolated module work or independent review; do not create agents for routine commands.
- Test external integrations via explicit test adapters until real environment is configured; no claim of live verification from mocks.
- New implementation clarifications must stay within the approved specification and be recorded here.
- Toolchain compatibility: Next 16.4.6 lint plugins reject ESLint 10 and TypeScript 7 peers. Pinned ESLint 9.39.5 and TypeScript 5.9.3, @types/node 24; `pnpm peers check` is clean. ESLint 9 emits an upstream support/deprecation notice; retain compatible tooling for this implementation and reassess upgrades after plugin support. Approved only esbuild's required install script, recorded in pnpm-workspace.yaml.
- Added package type=module to avoid ESM-config interoperability warnings; no frontend code added.
- Isolated PostgreSQL 17.11 cluster initialized under .tmp/postgres-test, listening on 127.0.0.1:53650. Credentials live only in ignored .env.test.local; connection verified as bc_test to postgres. Do not touch other installed PostgreSQL clusters. Windows Start-Process -Wait waits descendants; use the returned pg_ctl Process.WaitForExit instead. Stop only this cluster after tests.
- T0 implementation assigned to /root/contracts_t0 (Sol Ultra), ownership src/contracts and src/mocks/fixtures only. Root owns toolchain/config/docs. Runner verified working before behavioral tests; schemas/fixtures pending review.

## Stage evidence

T0: contracts and realistic Dana fixtures complete. 13 contract tests + 4 module-boundary tests pass; typecheck/lint pass. Public projections strip private rubric/persona/meta/process fields. Relative module imports are checked as well as aliases. Root inspected contracts, fixtures and assertions. See t0-contracts-report.md for shapes.
T1: PostgreSQL schema/migrations, private event/editor journal, durable fenced jobs, identity/SMTP adapter, guest sessions, OpenAI gateway, seven prompts, Sales pack with 12 archetypes/3 demos, worker runner, deployment files and CI implemented. Fresh full suite 67/67, lint and typecheck exit 0. Identity and events/jobs run against real isolated PostgreSQL; LLM retry records persisted there. External OpenAI/SMTP/Stripe remain unverified because .env values are absent. Docker not installed locally; Compose not run. Fixed pg pool close/socket shutdown race and rotated isolated disposable test credential after a driver error exposed it in test output. No production credential was involved. Worker handlers/main wiring follows in T2/T4/T5.
T2: pending.
T3: pending.
T4: pending.
T5: pending.
