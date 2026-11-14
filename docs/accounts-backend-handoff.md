# Accounts backend handoff

Scope: backend implementation of `docs/spec/accounts.md`. Screens, styles and client hooks stay with the frontend teammate. Only the two server guards (`src/proxy.ts`, `src/app/_lib/auth/server.ts`) were additionally authorized for the session fix.

## Session fix

Both server guards previously called the public `APP_URL` over HTTP and converted any request error into a missing session. A valid logged-in visitor was consequently redirected to `/login` when that self-request failed (proxy timeout, DNS/network or origin failure). This failure was reproduced with a real database session and an unavailable public endpoint. Guards now read the same server-side identity service directly. A storage failure produces a service error, never a fake logout or an empty cookie. Invalid/expired sessions still redirect.

Normal sessions last 30 days. Activity renews them when less than 15 days remain; the HTTP/proxy response synchronizes `Max-Age` and `Expires`. Guest sessions remain fixed at 24 hours and obey the server flag. Cookies are host-only, `Path=/`, HttpOnly, SameSite=Lax, Secure for HTTPS. A 403 PAYWALL/FORBIDDEN never revokes a session.

The exact historical VPS request was not available in the current logs. The reproduced code defect is fixed locally; deployment and a real-user production check remain separate steps.

## Common protocol

- All JSON mutations require `Content-Type: application/json` and `Origin` equal to the origin of `APP_URL`. This includes PATCH and DELETE. Stripe webhook retains signature verification instead.
- Use normal same-origin cookies; never store tokens in localStorage. Raw session/email tokens and password hashes are not returned in JSON.
- Errors retain `{ "error": { "code": "…", "message": "…" } }`. Invalid credentials: 401 UNAUTHORIZED. Invalid input: 400 VALIDATION. Rate limits: 429 RATE_LIMIT. Missing JSON content type: 415 VALIDATION. Account permission failures: 403 FORBIDDEN. Occupied email at confirmation: 409 VALIDATION.
- Generic registration/reset UI text: **If an account exists, we sent an email.** Registration always returns accepted for valid requests, including an existing account. Reset also uses a generic response for unknown addresses. Mail delivery failure returns 503 without transport internals.
- `SessionUser` has additive `emailVerified: boolean` and `hasPassword: boolean`, in addition to `id`, `email`, `displayName`, `isGuest`. Old consumers continue to parse the original fields.

## Endpoints

| Method and path                  | JSON input                            | Success                                                                       |
| -------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| POST `/api/auth/register`        | `{email,password,displayName}`        | 202 `{accepted:true}`; confirmation email                                     |
| POST `/api/auth/login`           | `{email,password,next?}`              | 200 `{session:{user,expiresAt},next}` + new session cookie                    |
| POST `/api/auth/verify-email`    | `{token}`                             | 200 `{ok:true}` + new session cookie; handles signup and changed-email proofs |
| POST `/api/auth/forgot-password` | `{email}`                             | 202 `{accepted:true}`                                                         |
| POST `/api/auth/reset-password`  | `{token,password}`                    | 200 `{ok:true}`; other sessions revoked                                       |
| POST `/api/auth/change-password` | `{currentPassword?,password}`         | 200 `{ok:true}`; other sessions revoked                                       |
| POST `/api/auth/change-email`    | `{email,currentPassword?}`            | 202 `{accepted:true}`; email remains unchanged until confirmation             |
| POST `/api/auth/logout-all`      | `{}`                                  | 200 `{ok:true}`; clears this cookie and revokes every session                 |
| GET `/api/account`               | —                                     | 200 `SessionUser`                                                             |
| PATCH `/api/account`             | `{displayName}`                       | 200 updated `SessionUser`                                                     |
| DELETE `/api/account`            | `{confirm:"DELETE",currentPassword?}` | 200 `{ok:true}`; clears cookie and erases owned records                       |
| POST `/api/auth/magic-link`      | `{email,next?}`                       | 202 `{accepted:true}`                                                         |
| GET `/api/auth/verify?token=…`   | —                                     | 303 to safe stored `next`, with session cookie                                |
| GET `/api/auth/session`          | —                                     | `{user,expiresAt}` or `null`                                                  |
| POST `/api/auth/logout`          | `{}`                                  | 200 `{ok:true}` and cleared cookie                                            |

New passwords: 10–128 characters, not trimmed. Email is trimmed and normalized to lowercase. Display name is trimmed, 1–100 characters. `next` permits local product paths (including case/review/settings and query parameters), rejects external/protocol-relative/backslash paths, and defaults to `/onboarding`.

## Frontend flows

1. Register, then either sign in with the chosen password immediately to practice, or open the confirmation email. Registration itself deliberately returns the same response for existing and new users, without logging into an existing account.
2. `/verify-email?token=…` posts to `/api/auth/verify-email`. A successful response installs a new cookie; invalidate/refetch the session query. Previous sessions and competing email tokens are revoked. Password and name activated are those bound to this confirmation, preventing takeover through earlier registration of somebody else's email.
3. `/reset-password?token=…` collects the new password and posts to reset. Then sign in. A valid existing session in that browser may be retained; every other session is revoked.
4. A password account must supply its current password for password/email changes and deletion. A passwordless magic-link account must have authenticated within the previous 15 minutes; otherwise request a fresh magic link. It can set its first password through change-password after this proof.
5. Confirming a changed email signs the confirming browser in with a fresh cookie and signs other devices out. The old email remains valid until confirmation.
6. Unverified members can complete practice and read the review, but `certificateSlug` is omitted. Show a confirm-email state. After confirmation, refetch the review: the backend issues the previously withheld certificate. Existing practice data is retained. Guest certificates remain explicitly marked demo records.
7. Deletion requires an explicit `confirm:"DELETE"`; on success clear the client query cache. Old public certificate URLs return 404. No browser/UI deletion screen was implemented in this backend task.

Magic-link proof of an unverified account clears its provisional password and revokes pre-proof sessions/tokens. This prevents an attacker from keeping access after registering somebody else's email. The actual mailbox owner can set a new password after signing in. Already verified accounts retain their password when using magic link.

## Database, mail and deployment

- Additive checksum-protected migration: `007_accounts.sql`. Old migrations are unchanged. Existing successful magic-link users are backfilled as email-verified from historical sessions; guests are not.
- Argon2id uses the pinned native `@node-rs/argon2` package (19 MiB, 2 passes, 1 lane), following [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Both npm and pnpm locks include it. Do not copy Windows `node_modules` to the Linux VPS; Compose installs dependencies there.
- Email tokens store hashes, purpose, expiry and consumed state. Signup proof also carries the pending password **hash**, never the password. Confirmation/change-email links expire in 24 hours; reset in 30 minutes; magic links in 15 minutes. Session tokens themselves are reusable until expiry/revocation.
- Mail uses existing `SMTP_*` settings and Gambit branding. Unknown/duplicate account requests also use a generic mail path rather than an immediate response. Transport/network duration cannot be guaranteed identical; error text/status and password verification paths do not reveal whether an email exists.
- Login limits: 10 attempts / 15 minutes per email+IP, with an additional 100/IP cap. Password reset: 3/email/hour and 20/IP/hour. Limits persist on failed logins. The trusted proxy must overwrite `X-Real-IP`; do not expose the application port directly.
- Deletion removes cases, operations, editor data, evaluations, certificates, progress, tokens, sessions and owned LLM records. New intake logs carry `user_id`. Legacy intake records could not reliably be attributed; migration clears their personal input/output payloads while preserving usage metadata. Application database deletion does not erase historical backups or third-party provider logs.
- Google OAuth is optional in the source request and is not included.

VPS: `31.76.87.250`, port 22, user **deploy**. Key: local `~/.ssh/id_ed25519_bc2026_vps`. This is a restricted command account, not a shell. Supported commands are `deploy [ref]`, `status`, `logs <service> [n]`, `follow <service>`, `restart <service>`, `history`. Do not probe other usernames: fail2ban is enabled. There is one shared environment; deploy replaces it for everyone.

The assistant used `status` and bounded logs only. No deployment, restart, production migration, external email, Git push or PR was performed. Coordinate the final deployment after the user pushes and the frontend teammate implements the new screens.

## Verification

- Real PostgreSQL tests cover session continuity for magic-link/password users, cookie renewal, fixed guest expiry, token replay/expiry/purpose, credential enumeration responses, failed-login limits, pre-registration takeover, revocation races, profile changes, occupied email, complete deletion and certificate eligibility.
- Production HTTP smoke uses a disposable PostgreSQL database and a local SMTP capture server. It exercises actual Next route handlers and proxy/RSC guards: registration → email proof → password login → protected dashboard while public APP_URL is unreachable → profile update → reset → deletion. No LLM or external mail calls. Local script: ignored `.tmp/accounts-http-smoke.ts`.
- Final check counts and commit are recorded in the accounts execution plan and project context. Real external SMTP delivery and production replay must still be checked after deployment.
