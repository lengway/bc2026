# PostgreSQL infrastructure handoff

T1 implements the approved schema in `migrations/001_initial.sql`, a lazy pool and explicit `migrate(db, directory?)` runner in `src/modules/database`. The runner serializes concurrent migration attempts, verifies applied file checksums and rolls back the entire pending migration transaction on failure. Applied migrations must not be edited after deployment.

The initial schema includes all CONTEXT §9 tables plus `rate_limits`, `editor_batches`, `progress_awards` and `billing_webhook_events`. Additional fields support guest identities (`users.is_guest`), public scoring guides, a submitted observation snapshot, operation leases, closed drafts and fenced job leases. Tests create isolated `bc_test_<random UUID>` databases using `TEST_DATABASE_URL`; the helper never drops the database supplied in the URL. Closing a pool waits for physical connection shutdown before deleting its temporary database.

## Events integration

`createEventsService({db, now?})` exports `append`, `appendWithExecutor`, `listByCase`, `listPublicByCase`, `toPublicEvent`, `appendEditorBatch`, `listEditorByDraft`, and transaction-aware draft helpers. Stored events are private; API/SSE callers use `listPublicByCase` or `toPublicEvent`. Both journal page methods return `{events,lastSeq}`; the cursor includes private entries. Callers must authenticate and authorize public journal access before invoking these server-only methods.

Appending a user message with a draft ID binds and closes the draft in the same transaction. A different message cannot reuse it. `appendEditorBatch(caseId, authenticatedUserId, batch)` verifies the owner and active server deadline. Exact accepted batch retries retain their original acknowledgement after closure or submission; new late data is rejected. Per-case limits are 30 new batches per minute and 256 KiB per batch. Windows permit up to 10,250 ms for the specified 10-second aggregation, pointer samples at 10 Hz plus one boundary sample, and bounded counters. Unsupported input is rejected as a validation error, never converted into an AI accusation or score penalty.

Editor source checks establish same-case copilot source existence and timing only. T4 must compare inserted text against the saved source before assigning known copilot provenance. Gaps, unverifiable ranges, absent telemetry and mismatched final text are observation limitations. Client timestamps, trusted flags, input modes and aggregates are untrusted browser observations; they do not establish authorship or external AI use.

T3 must save `cases.submitted_snapshot` while holding the case lock in the transaction that changes status to `submitted` and calls `jobs.enqueueWithExecutor`. The snapshot should include the accepted transcript and telemetry used by evaluation. Later evaluation reads that immutable snapshot.

## Jobs integration

`createJobsService({db, now?})` provides `enqueue(input)`, `enqueueWithExecutor(tx,input)`, `claim(owner,{leaseMs?,caseId?,kind?})`, `complete(id,owner,leaseToken)`, `completeWithExecutor(tx,id,owner,leaseToken)`, `fail(id,owner,leaseToken,errorCode,retryDelayMs?)`, and `renewLease(id,owner,leaseToken,leaseMs?)`. `claim` returns `Job|null`; lease methods return whether the current, unexpired owner/token matched. Error codes are safe uppercase classifications, not provider exception text.

Claims use `FOR UPDATE SKIP LOCKED`, unique dedupe keys and a new fencing token on every attempt. Reclaiming an expired lease increments attempts; an expired final attempt becomes failed. LLM calls run after claim commits and outside any database transaction. Publishing results and job completion must share one short transaction: call `completeWithExecutor` and abort the transaction if it returns false before applying result side effects. A rollback restores both the job lease and result state. Certificates have a unique case key; XP awards have a unique `(case_id,skill)` key for idempotent downstream publication.

## Validation recorded

Database, events and jobs tests were written against missing implementations and observed RED before implementation. Added deadline/window and guest/fenced-publication scenarios were also observed RED. Final scoped run: `pnpm test src/modules/database/database.test.ts src/modules/events/events.test.ts src/modules/jobs/jobs.test.ts` — 26 passing tests on actual PostgreSQL, no skipped test suites. Root owns the final whole-project integration check and stage report.
