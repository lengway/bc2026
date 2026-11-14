# T1 module coordination

This is implementation coordination for the approved specification, not a product scope change. Start only after T0 is verified.

## Shared infrastructure interface

- Add backend infrastructure module `src/modules/database`. Export `SqlExecutor` (`query(sql: string, values?: readonly unknown[]): Promise<{rows: Record<string, unknown>[]; rowCount: number | null}>`) and `Database` (SqlExecutor plus `transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>`, `close(): Promise<void>`).
- Factory `createDatabase(connectionString: string): Database`. Pool is lazy; do not read env or open sockets during module import. Every repo validates result rows/JSONB with its own Zod schemas. Parameterized SQL only.
- SQL migrations live in db/migrations and are applied by an explicit runner. Tests create isolated databases with bc_test_ prefix using TEST_DATABASE_URL; never truncate or drop a database supplied by a user. CI uses its own PostgreSQL service.
- Central backend-only `src/modules/shared` exports `AppError` (ApiError code, HTTP status, safe message) and common clock helpers if needed. API serializes safe known errors; unexpected errors are logged with sanitized metadata.
- Shared facilities are technical plumbing; business modules still import each other only via index.ts.

## Service construction

- Module indexes export `createXService(deps)` and its service type; methods retain the exact names in CONTEXT. Constructors accept Database/SqlExecutor, clock and external-service adapters where needed.
- Root later composes services in `src/modules/runtime/index.ts`; individual modules must not import runtime or pull environment globally. This supports real-repository tests and avoids circular imports.
- `createEventsService({db, now?})` exposes append, listByCase, appendEditorBatch, listEditorByDraft, toPublicEvent; stored/private records are distinct from public Event. Expose repo-safe draft/read operations needed by the simulation through this module's index.
- `createJobsService({db, now?})` exposes enqueue, claim, complete, fail and renewLease. Use named job kinds case.generate and case.evaluate; unique dedupe keys, owner-checked leases, idempotent retries.
- `createLlmService({provider, recordCall, promptsDir?, now?})` exposes `run<T>(promptId, input, schema, opts?)`; opts include caseId. recordCall persists safe server-only LLM metadata via the runtime adapter. Export provider interface and MockProvider. MockProvider must be explicitly configured for tests and never silently replace real grading.
- `createCatalogService({packsDir?})` exposes getPack, pickArchetype, listFields, getDemoCase. Seed cases use public/hidden persona and Rubric from T0 server schemas; ids are remapped by case-engine on assignment.

## Ownership within T1

- Database/events/jobs implementation: assigned after T0, includes migrations and real-PostgreSQL backend test helpers. Do not change contracts without root coordination.
- LLM/catalog/prompts/field-packs implementation: separate owner. Unit tests inject provider and call recorder; root verifies persisted llm_calls in integration.
- Root: identity auth/session/profile scaffolding, runtime config, deployment/CI/scripts, shared error contract and integration/review. No frontend files.

## Validation

Each owner records RED and GREEN evidence and actual commands in its stage report. Integration uses .env.test.local or CI TEST_DATABASE_URL; never log credentials. Report only changed files, API signatures, test counts and genuine concerns. Root runs the whole suite and reviews before moving to T2.
