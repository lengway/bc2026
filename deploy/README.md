# VPS deployment

Requirements: Linux VPS with Docker Compose v2, a hostname pointing to the VPS, ports 80/443 open. PostgreSQL and Node ports remain private to the Compose network.

1. Copy `.env.example` to `.env` at the repository root. Set `APP_URL=https://your-hostname`, `PUBLIC_HOSTNAME`, the PostgreSQL credentials, and `DATABASE_URL=postgres://USER:URL_ENCODED_PASSWORD@postgres:5432/DB`. Select an OpenAI model available to your account and configure SMTP. Never commit `.env`.
2. From the repository root run `docker compose --env-file .env -f deploy/compose.yml up -d --build`. The one-shot `migrate` service applies migrations before web and worker start. Caddy obtains and renews HTTPS certificates. Its proxy flushes SSE immediately.
3. Inspect `docker compose --env-file .env -f deploy/compose.yml ps` and the web/worker logs. Do not paste private connection strings or request payloads into shared logs.
4. Configure the Stripe **test-mode** webhook at `https://HOST/api/billing/webhook`, then store its signing secret and test price IDs in `.env`. Restart web/worker after changing environment variables.

For jury access set `GUEST_ACCESS_ENABLED=true` and recreate web/worker with Compose. The frontend can read `/api/auth/options` and enter via `POST /api/auth/guest`; existing session cookies are reused. Guest sessions last 24 hours, have separate users/cases and are disabled when the flag is off. Guest creation is capped at 10 per IP per hour and 100 globally per day to limit anonymous API spend. Caddy sets the client IP; do not expose web directly when relying on that header.

The worker image retains the TypeScript runtime/build dependencies for the hackathon. The web image runs Next.js standalone as the unprivileged `node` user. Local Docker execution has not yet been verified on the Windows development machine.

## Backup and restore

Run on the Linux VPS from the repository root. Backups contain personal data; restrict access and keep an encrypted off-site copy.

```sh
umask 077
docker compose --env-file .env -f deploy/compose.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > backup.dump
```

Restore into a **new, empty database** and test it before switching the application. Set `RESTORE_DB` to that database name, create it using `createdb`, then:

```sh
docker compose --env-file .env -f deploy/compose.yml exec -T -e RESTORE_DB=skills_restore postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$RESTORE_DB" --no-owner --exit-on-error' < backup.dump
```

Never use `docker compose down -v` on a deployment whose data you want to retain. PostgreSQL, Caddy certificates and Caddy configuration each use persistent named volumes. Migration checksums reject edits to previously applied SQL; add a new migration for subsequent schema changes.
