# Guest access for the jury

User approved the server-flag approach on 2026-11-14 during backend implementation. This addendum supplements the unchanged product specifications.

Goal: visitors can run the product without email registration when the organizer enables guest access. Each visitor gets an isolated server session and user, displayed as Demo Guest. Existing ownership, CSRF, generation limits and server-side evaluation still apply.

Approaches considered: a server environment flag requires restart but reuses current auth and needs no admin UI; a database setting with an admin toggle also needs admin roles, management APIs and frontend work. User chose the server flag for the hackathon.

Implementation: `GUEST_ACCESS_ENABLED=false` by default. `GET /api/auth/options` returns the flag. `POST /api/auth/guest` creates or reuses a guest session, guarded by Origin and rate limits; no email is sent. Synthetic addresses use the reserved `.invalid` domain and are never accepted for magic links. Guest sessions expire in 24 hours. Disabling the flag rejects new guest entry and invalidates access by existing guest sessions. Session user includes `isGuest`; certificate `isDemo` marks guest results, with Demo Guest as holder. Public certificates continue to describe recorded simulations only.

Boundaries: no admin page, no shared account, no access to another visitor's data, no invented completed results. Guest payment checkout is unavailable; paid accounts use magic link. The friend owns the frontend entry button and demo indicator.

Execution addition: implement guest identity/config tests in T1; add auth endpoints and billing guard in T5; project `isDemo` during T4. Verify disabled flag, isolation, expiry, limits and reuse. User's explicit selection authorizes this small addition without reopening the main product design.
