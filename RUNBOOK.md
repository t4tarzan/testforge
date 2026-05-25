# TestForge — operational runbook

The thing to read when something is on fire, when you're getting ready to
ship, or when a teammate needs to take over on-call. Lives in the repo so
it stays in sync with the code.

---

## Pre-launch checklist

Do these once before flipping the site live. Repeat the Verify column for
every major deploy.

| Item | Where | Verify |
|---|---|---|
| **Vercel env vars** set for `Production` + `Preview` | Vercel → Project → Settings → Environment Variables | `vercel env ls` shows all of: `DATABASE_URL`, `SESSION_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`, `MCP_SERVER_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **`SESSION_SECRET` ≥ 32 chars** | Generate: `openssl rand -base64 48` | `/api/auth/me` without a cookie returns 401, not "Server misconfigured" |
| **Upstash Redis** provisioned | Vercel Marketplace → Upstash → Redis (free tier) | After two quick requests, `X-RateLimit-Remaining` header decrements |
| **Neon DB** has v1 schema | Paste `scripts/migrate-to-v1.sql` into Neon SQL Editor | `\d projects` shows a `user_id` column; `\d api_keys` exists; `\d stripe_events` exists |
| **GitHub OAuth callback** registered | https://github.com/settings/developers → your app → Authorization callback URL | Value: `https://testforge.run/api/auth/callback` |
| **Stripe webhook endpoint** registered with the correct events | https://dashboard.stripe.com/webhooks | Endpoint: `https://testforge.run/api/stripe-webhook`; events: `checkout.session.completed`, `customer.subscription.{created,updated,deleted}` |
| **Stripe price ids** point to live mode (not test mode) | Stripe Dashboard → Products | `STRIPE_PRICE_PRO`/`STRIPE_PRICE_ENTERPRISE` env vars match a live-mode price id |
| **Fly.io MCP** healthy | `flyctl status -a testforge-mcp` | At least one machine `started`, last deploy ≤ 24h |
| **npm package** publishable | `cd mcp-server && npm publish --dry-run` | No errors; `dist/` is in the tarball |
| **DNS** for `testforge.run` → Vercel | `dig +short testforge.run` | Resolves to Vercel's IPs |
| **CI green on `main`** | https://github.com/t4tarzan/testforge/actions | Latest run all green |

## Day-of-launch sequence

1. **Final smoke test on prod.** ~30 seconds:
   ```bash
   ./scripts/smoke.sh https://testforge.run
   ```
   Exits 0 if everything's healthy. Run it again 5 minutes later just to be sure.

2. **Verify a real Stripe purchase** in Stripe **test mode** first:
   - Sign in with GitHub
   - Click "Upgrade to Pro" → use card `4242 4242 4242 4242`
   - Confirm redirect to `/#/account?checkout=success`
   - In Neon, run: `SELECT plan, stripe_customer_id FROM users WHERE login = 'your-gh-username';` → plan should be `pro`
   - In Stripe Dashboard, confirm webhook delivery shows 200
   - In Neon, run: `SELECT * FROM stripe_events ORDER BY received_at DESC LIMIT 3;` → see the event id

3. **Flip Stripe to live mode** (change env vars). Re-run smoke.

4. **Submit Product Hunt** in the morning (PT timezone — best traffic).
   Material is in `LAUNCH_KIT.md`.

5. **Monitor for the first hour** — open these tabs:
   - https://testforge.run/api/status
   - Vercel logs filtered by `level:error`
   - Stripe events log
   - GitHub Issues

## Common incident playbooks

### "Users can't sign in"

1. Check `/api/auth/me` from a browser with devtools open. Is the response 500?
2. Inspect response body: `{"error":"Server misconfigured","missing":["SESSION_SECRET"]}` means SESSION_SECRET got unset or shortened. Restore in Vercel env and redeploy.
3. If 401 (no cookie) but OAuth redirect doesn't set the cookie, check that the callback URL in GitHub OAuth app matches exactly `https://testforge.run/api/auth/callback` (no trailing slash, no `www.`).
4. If GitHub OAuth itself returns "redirect_uri mismatch", same fix.

### "All API requests return 500 'column does not exist'"

The migration didn't run on Neon. Paste `scripts/migrate-to-v1.sql` into the Neon SQL Editor and run it.

### "Stripe checkout creates a session but plan doesn't upgrade"

Open the Stripe Dashboard → Webhooks → the testforge endpoint → check the recent deliveries.

- **Signature mismatch:** `STRIPE_WEBHOOK_SECRET` in Vercel env doesn't match the one in Stripe's webhook config. Get it from Stripe Dashboard → Webhooks → click endpoint → "Signing secret".
- **200 OK but no upgrade:** the event metadata is missing `userId`. Re-check that `/api/stripe` sets `subscription_data.metadata.userId`. Otherwise grep Vercel logs for `[stripe-webhook]` lines.
- **Duplicates returning `{duplicate: true}`:** that's correct behavior — Stripe retries are deduped via `stripe_events`.

### "Rate limit returns 429 for legitimate traffic"

- Confirm Upstash is reachable: `curl -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" $UPSTASH_REDIS_REST_URL/ping` → should return `"PONG"`.
- If Upstash is down, every request fails open (allowed) — see `[rate-limit] Upstash error, falling open` in Vercel logs. No action needed unless it's prolonged.
- If a specific IP needs lifting, today there's no admin override — increase `maxRequests` in the affected handler's `withSecurity` opts and redeploy.

### "MCP server is slow / failing"

`/api/analyze` returns 504 on timeout, 502 on connection failure. Triage:

1. `flyctl status -a testforge-mcp` — any machine in `failed`?
2. `flyctl logs -a testforge-mcp` — last error?
3. Quick restart: `flyctl machine restart -a testforge-mcp <machine-id>`
4. Last-resort scaling: `flyctl scale count 3 -a testforge-mcp`

### "I need to roll back"

Vercel: Dashboard → Deployments → click the previous deploy → "Promote to Production". 30 seconds.

Schema changes: rolling back the DB is **not safe** mid-launch (would lose user data). Always do forward-only fixes. The `IF NOT EXISTS` guards in `migrate-to-v1.sql` make it safe to re-apply.

## Where things live

| Thing | Location |
|---|---|
| Production frontend | https://testforge.run (Vercel) |
| Production MCP analyzer | https://testforge-mcp.fly.dev (Fly.io) |
| Production database | Neon project `testforge` |
| Rate limit store | Upstash Redis (via Vercel Marketplace) |
| Public status | https://testforge.run/api/status |
| Logs | Vercel project → Logs; Fly → `flyctl logs -a testforge-mcp` |
| Stripe events history | https://dashboard.stripe.com/events |
| Source of truth for schema | `src/db/schema.ts` |
| Migration script | `scripts/migrate-to-v1.sql` (forward-only, idempotent) |
| Smoke test | `scripts/smoke.sh <base-url>` |
| CI workflow | `.github/workflows/ci.yml` |

## Glossary

- **Session JWT (`tf_session` cookie)** — httpOnly cookie minted by `/api/auth/callback`, signed with `SESSION_SECRET`. Payload: `{sub:userId, gh:githubId, login, plan, email}`. 30-day expiry.
- **Request id (`X-Request-Id` header)** — correlation id set by `withSecurity`. Echoes Vercel's `x-vercel-id` if present, else a fresh 16-hex token. Appears in every `req.log.*` line as `rid:`.
- **`MissingEnvError`** — thrown by `requireEnv()` when a required env var is missing. `withSecurity` catches it and returns `{error:"Server misconfigured", missing:[...]}` — much faster to debug than a generic 500.
