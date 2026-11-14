<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend continuation

- VPS SSH user `deploy` has forced-command access only: `deploy`, `status`, `logs`, `follow`, `restart`, `history`. Do not send ordinary shell commands through that account or guess usernames; fail2ban is enabled. Do not store credentials in the repository.

- Scope update (2026-11-14): the user explicitly authorized all three items in `docs/reference/review-redesign.md`, including backend scoring diagnosis/fix, review replay redesign, and Copilot Enter behavior. Work on `fix/review-redesign` from main (updated through `9e4462f`) and open a PR. See `docs/superpowers/plans/2026-11-14-review-redesign.md` for the actual recorded-case diagnosis and remaining live check. This overrides the earlier frontend-only boundary for this task. Recorded-case reproduction and live verification require working VPS access; never substitute synthetic data for a claimed real-case result.

- Work on `fe/frontend`, frontend epics F1–F6 only. Read `docs/FRONTEND.md` for current status and unresolved team contracts.
- The user supplied newer specifications on 2026-11-14: `docs/reference/CONTEXT.md` and `docs/reference/PROMPT_FRONTEND.md`. For frontend work these supersede the older root CONTEXT and design handoff where they conflict.
- On 2026-11-14 the user authorized finishing all frontend on the existing Claude design. Reuse Ledger tokens/fonts/primitives; adapt `src/ui`, `src/screens` and public `src/contracts` as needed for the updated spec. Do not implement backend/DB/worker/deployment. See the F2–F6 plan for remaining API-contract dependencies.
- Product routes live under `src/app/(frontend)`; designer galleries use a separate root layout in `src/app/(design)`. Shared data hooks and API helpers stay in `src/app/_hooks` and `_lib`.
- Use npm and the shared package-lock. Required checks: `npm run check`, `npm run build`, `npm run test:e2e`, `npm run format:check`.
- The user prefers one agent and proportionate Superpowers workflows. Reuse existing decisions; do not restart brainstorming for routine fixes.
