<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Frontend continuation

- Work on `fe/frontend`, frontend epics F1–F6 only. Read `docs/FRONTEND.md` for current status and unresolved team contracts.
- The user supplied newer specifications on 2026-11-14: `docs/reference/CONTEXT.md` and `docs/reference/PROMPT_FRONTEND.md`. For frontend work these supersede the older root CONTEXT and design handoff where they conflict.
- Preserve `src/ui`, `src/screens`, `src/contracts` and design tokens. Shared schemas currently need team agreement to adopt the newer auth/events/scoring/telemetry shapes; the frontend boundary is provisional.
- Product routes live under `src/app/(frontend)`; designer galleries use a separate root layout in `src/app/(design)`. Shared data hooks and API helpers stay in `src/app/_hooks` and `_lib`.
- Use npm and the shared package-lock. Required checks: `npm run check`, `npm run build`, `npm run test:e2e`, `npm run format:check`.
- The user prefers one agent and proportionate Superpowers workflows. Reuse existing decisions; do not restart brainstorming for routine fixes.
