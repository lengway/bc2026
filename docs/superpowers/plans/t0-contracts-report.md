# T0 contracts handoff

The shared entry point is `@/contracts`. Each named schema has a matching inferred TypeScript type. The private `Rubric` schema is imported from `@/contracts/rubric` and `PersonaHidden` from `@/contracts/case`. Public case views, events, evaluations and certificates use allowlist projections. The owner review uses `Evaluation`, and the full certificate uses `PublicEvaluation`.

## API schemas

| Route | Request | Response |
|---|---|---|
| `POST /api/auth/magic-link` | `MagicLinkRequest` | `MagicLinkResponse` |
| `GET /api/auth/verify` | `MagicLinkVerifyQuery` | Empty `MagicLinkVerifyResponse`, cookie and redirect |
| `GET /api/auth/session` | — | `SessionView` |
| `POST /api/auth/logout` | — | `LogoutResponse` |
| `POST /api/intake` | `IntakeRequest` | `Profile` or its alias `IntakeResponse` |
| `POST /api/cases` | `GenerateCaseRequest` | `GenerateCaseResponse` |
| `GET /api/cases/:id` | `CaseParams` | `CaseResponse` |
| `POST /api/cases/:id/start` | `CaseParams` | `StartCaseResponse` |
| `POST /api/cases/:id/move` | `CaseParams`, `MoveRequest` | `MoveResponse` |
| `POST /api/cases/:id/editor-events` | `CaseParams`, `EditorBatch` | `EditorBatchAck` |
| `GET /api/cases/:id/events` | `CaseParams`, `EventsQuery` | `EventsPage` |
| `GET /api/cases/:id/stream` | `CaseParams`, `StreamQuery`, optional `LastEventId` | `CaseEventStreamMessage` per SSE event |
| `POST /api/cases/:id/copilot` | `CaseParams`, `CopilotRequest` | `CopilotResponse` |
| `POST /api/cases/:id/submit` | `CaseParams` | `SubmitCaseResponse` |
| `GET /api/cases/:id/review` | `CaseParams` | `ReviewResponse` |
| `GET /api/certificates/:slug` | `CertificateParams` | `CertificateResponse` |
| `GET /api/me/path` | — | `SkillPath` or its alias `SkillPathResponse` |
| `POST /api/billing/checkout` | `CheckoutRequest` | `CheckoutResponse` |
| `POST /api/billing/webhook` | Raw `StripeWebhookRequest` | `StripeWebhookResponse` |

Errors use `ApiError` with the seven `ApiErrorCode` values from CONTEXT §11. The route supplies the appropriate HTTP status. `StripeWebhookRequest` represents the unmodified body used with Stripe's signature before JSON parsing.

The domain schemas cover document contents by kind, case status and public persona, intake profile/details, public events, typed telemetry, score evidence and coverage, owner and public evaluation, both certificate depths, and the skill path. Reviews enforce label points and applicability of scored checks. The stored accuracy, trap flag and legacy similarity field must agree with the accompanying audit fields.

## Fixture exports

- `caseView`, `eventsPage`, `evaluation`, `moves` and `review` form the Dana Whitfield sales scenario. The six move scores are 80, 50, 100, 20, 100 and 100. Accuracy is 75 with 450 of 600 possible points. The third move checks the copilot's erroneous quarterly billing claim against Sales Ops and corrects it. One unsupported live-integration promise loses points, and the next move corrects it.
- `certificateLimited`, `certificateFull` and `skillPath` use the same result. The full certificate has an allowlisted transcript. The limited view has the aggregates for scoring and safe assistance observations.
- `insufficientReview` and `insufficientEventsPage` form a separate trace with a nine-character greeting. It has null accuracy and AI-use score, zero copilot similarity, no presented trap, and no captured editor data.
- `editorBatches` and `editorAcks` supply a keyboard-only window, touch activity and a draft with two edits. The first edit is a paste from the learner's own notes in the fixture's scenario. The editor records its source as unknown. The next edit is an internal synthetic event. Partial capture makes retained proportion null. Unique-token Jaccard over preceding copilot replies and all six submitted messages gives 11% rounded similarity. The review records the em dash descriptively and uses null for the unavailable language check.

## Contract choices

- Checkout accepts `plan: 'monthly' | 'yearly'`. The webhook acknowledgment is `{received:true}`. The auth verification redirect and expiry mechanism belong to the auth route. Missing `displayName` and unreported intake experience can be represented by null.
- Events and editor operations start at sequence 1. The replay cursor and an empty draft acknowledgment may be 0. `MoveRequest` defaults an omitted `draftId` to null for compatibility. It preserves message whitespace for editor reconciliation.
- `EditorBatch` accepts up to 100 editor events and 20 windows. Each nonempty batch may carry edits, windows or both. No applicable pointer or timing observation can be represented by null. The interval summary fields are `sampleCount`, `minMs`, `medianMs` and `maxMs`. Runtime request limits and data ownership checks belong to the handler and service.
- Public case data only includes available documents when populated by the case service. Source existence, quote matching, appropriate evidence timing and atomic ownership checks require persisted case context. The schemas validate the wire shape and self-contained numeric relationships.

## Verification

- RED before writing contracts or fixture data. `pnpm test src/contracts` exited 1 because the requested fixtures module was absent. Vitest started and attempted to load the test.
- The first execution with the schemas and fixtures ran 12 tests. Eleven passed. The punctuation assertion expected the entire nested counter record to equal a single key. It now checks the em dash counter while allowing the fixture's other counters.
- Final `pnpm test src/contracts` passed 13 tests. `pnpm test` passed all 17 tests across two files. `pnpm typecheck` and `pnpm lint` both exited 0.
- This phase exercises contracts and fixtures. Integration with live HTTP routes, PostgreSQL and external services belongs to later phases.
