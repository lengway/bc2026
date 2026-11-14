# Review scoring and replay implementation plan

**Goal:** Restore evidence-backed move scoring, make the review read as a conversation replay, and support Enter in Copilot.

**Architecture:** Keep Next/React/Ledger and the existing evaluation pipeline. Validate semantic scoring proposals before they leave the bounded LLM repair loop; preserve evidence, ownership and chronology checks. Deliver a safe transcript with the owner review, and use one selected move for every replay control.

**Spec:** `docs/reference/review-redesign.md`, explicitly adopted in full by the user. The supplied desktop/mobile layout is the approved direction; no new product or design-system exploration is needed.

## Scope and decisions

- Branch `fix/review-redesign`, baseline main `7ba4315`, advanced to `9e4462f` with the new brand/theme; prior frontend-only restriction is superseded for these three tasks.
- Retain current versions/dependencies and Ledger tokens, English copy, responsive/accessibility behavior.
- Prefer precise bounded repair of invalid model proposals over silently assigning points without evidence. Explanatory fallback text is not a diagnostic cause.
- Do not expose hidden persona, rubric, future events or owner observations in public responses. Review transcript uses the safe certificate event projection.
- Existing technical records stay available server-side; the normal review hides diagnostics and shows only a short collapsed explanation.
- No unrelated billing, guest-entry, deployment or CI changes. Prepare and verify code before any live rollout. Never overwrite production evaluation/certificates merely to make a test pass.

## 1. Scoring diagnosis and repair

- [x] Obtain the recorded Marisol/Prairie Bend case, rubric, relevant events and `eval.moves` response with read-only VPS access. Trace the recorded statuses and evidence; keep raw account data outside Git.
- [x] Add failing evaluation/LLM tests for semantic rejection and repair, missing/unknown criteria, forged or future evidence, omitted/duplicate moves, and intentionally unassessed greetings.
- [x] Implement shared validation diagnostics and a case-specific schema used by the existing bounded LLM repair loop; clarify exact IDs, quote sources and output examples in a versioned prompt.
- [x] Add a real recorded-case regression when available; distinguish it from any synthetic five-move fixture. Counterfactual test verifies four substantive moves using the recorded evidence; actual new provider output remains a separate live check.
- [x] Add safe transcript to ReviewResponse and owner data projection; test ownership, evaluation-state gate and exclusion of private fields.

## 2. Review replay

- [x] Tests first: first/previous/next/last boundaries; synchronized list/chart/keyboard selection; ignore editing/modifier key events; correct key-move default; zero-assessed fallback; no JSON/diagnostic blocks.
- [x] Refactor `src/screens/review/review-screen.tsx` into compact summary, desktop dialogue/detail/list, mobile inline expandable detail and Sheet, and bottom trust curve. Keep presentational props only.
- [x] Add focused `review-replay.tsx` if needed for conversation and navigation; use safe transcript IDs/sequence, user/persona messages and twist notices. Dim future messages; scroll selected message with reduced-motion support.
- [x] Add optional `showUserText`/evidence-display controls to MoveDetail so replay does not duplicate the learner's message or surface technical fallback text.
- [x] Update owner container, certificate full-review props, gallery and MSW fixtures. Show concise AI/trap values only when available, and a short truthful How this was scored disclosure.
- [x] Adjust browser assertions to the new review and latest main onboarding; verify desktop/mobile and accessibility.

## 3. Copilot Enter

- [x] Regression tests: Enter sends exactly once; Shift+Enter allows newline; empty/disabled/IME do not submit. Preserve editor recorder behavior.
- [x] Add the textarea handler using form submission and composition guards; retain all existing retry behavior.

## 4. Verification and delivery

- [x] Run lint, typecheck, full Vitest with isolated PostgreSQL, production build with mocks disabled, formatting and E2E.
- [x] Review the complete diff for transcript privacy, empty/null states, keyboard focus, scroll behavior, narrow screens and bounded repair cost.
- [x] Update progress/remaining external checks, push branch and open PR to main with exact verification evidence.
- [ ] Verify the actual deployed Marisol case only after access/rollout is available; state that limitation honestly if blocked.

## Progress

- Integrated main through `9e4462f` (onboarding and brand/theme). Source changes for all three requested items are implemented.
- Read the actual Marisol/Prairie Bend `eval.moves` v2 call and immutable snapshot through one successful root session using read-only database queries. Raw export remains outside Git. All five proposals already had `insufficient_evidence`; all cited evidence validates. Four substantive moves had rubric IDs and were withheld because they copied prior Copilot suggestions. The v2 prompt explicitly disallowed copying without added substance. The UI fallback strings were not the root cause.
- Prompt v3 explicitly assesses permitted copied advice by content, without an originality requirement. Dependency stays separate. Bounded semantic repair also handles malformed assessed proposals without weakening evidence checks.
- Added a minimized/anonymized recorded regression, clearly synthetic net-60 fixture, safe owner transcript, responsive replay, and Enter/Shift+Enter/IME handling. Recorded-case manual reclassification is labeled as a counterfactual, never as live model output.
- Review caught and fixed missing Sheet focus return, small touch targets and stale keyboard blocking after resize. Browser testing found insufficient future-message contrast; replaced opacity with accessible neutral colors. Axe checks pass in light/dark and desktop/mobile layouts; screenshots were inspected.
- `pnpm lint`, `pnpm typecheck`, and all 321 Vitest tests passed with isolated local PostgreSQL. Production build with mocks disabled and format check pass. Browser suite: 10 scenarios passed in the full rerun; after updating the new onboarding preview expectation, the remaining onboarding scenario and new theme/mobile scenario passed in a targeted run (12 distinct passing scenarios). Formatting-only changes to files newly integrated from main restore the repository-wide format gate.
- SSH `deploy` is a restricted command interface, accepting only `deploy`, `status`, `logs`, `follow`, `restart`, `history` (`logs` requires a service such as `web` or `worker`). Do not send shell commands or guess users: fail2ban is enabled. The first root password login succeeded; two subsequent logins (the last explicitly requested by the user) were rejected, so attempts stopped. No deployment, restart, production score changes or paid model calls occurred.
- Live acceptance update: SSH as `kasym` with the existing `gambit-vps` key works, with passwordless sudo. The server now accepts keys only; password authentication is intentionally disabled. Do not restore it or guess other usernames.
- Ran the exact PR v3 scorer in an isolated temporary process inside the worker container against the original recorded input. The database connection used `BEGIN READ ONLY` and closed before the provider call; no review/certificate/LLM-log records were written. Actual `gpt-6.1-sol` response passed validation on the first attempt: **4/5 assessed, Accuracy 85%, labels Best/Good/Good/Good; Hello! excluded**. Raw response is saved privately outside Git. This is a real provider result, distinct from the manual counterfactual fixture.
- Delivery: [PR #6](https://github.com/lengway/bc2026/pull/6). The user explicitly asked to push now and postpone remaining work. Do not merge or deploy until work is resumed. Remaining acceptance is rollout and checking the served review, not the live scorer replay.
- Temporary verification files remain under `/tmp/gambit-review-check-42d3fb3` in the worker container, with the input archive also in host `/tmp`; clean them up when continuing. They do not change application source or running worker configuration.
