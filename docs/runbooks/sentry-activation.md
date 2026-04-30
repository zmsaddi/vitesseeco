# Runbook — Sentry activation

> **Status:** prerequisites landed in commit (Sentry-1). Activation on
> Vercel (Sentry-2) and the alert rule (Sentry-3) live in this runbook.
>
> Until `ENABLE_SENTRY=true` is added on Vercel, the SDK never installs
> handlers. There is no traffic to Sentry, no quota burn, no risk.

## Acceptance gate (must all be ✓ before Sentry-2)

- [ ] CI green on master for the prerequisites commit (build / e2e / lighthouse).
- [ ] `npm run check:langs`, `npm run check:hex`, `npx nuxi typecheck`, `npx nuxi build` exit 0
- [ ] Bundle size still under the 13 MB gzip budget.
- [ ] Local smoke: `node -e "require('@sentry/nuxt')"` resolves without error.
- [ ] No traffic to Sentry yet (verified by absence of `ENABLE_SENTRY` on Vercel).

## Sentry-2 — Activation on Vercel

### 1. Create the Sentry account + project

1. Sign up at [sentry.io](https://sentry.io) with the project email.
2. Choose the **Free** plan (5K errors / 10K performance / 50 replays per month).
3. Create a new project: platform = **Nuxt**, name = `vitesseeco`.
4. Copy the DSN from the project's "Client Keys (DSN)" page.

### 2. Add env vars to Vercel Production (and *only* Production)

> The DSN is a write-key — anyone who has it can submit events that count
> against the project's quota. Treat as sensitive even though it's
> client-readable when the page loads.

```
# In a local terminal (no chat leak):
read -s -p "Paste Sentry DSN: " DSN && echo
vercel env add SENTRY_DSN production --value "$DSN" --yes
unset DSN
vercel env add ENABLE_SENTRY production --value "true" --yes
```

Verify:

```
vercel env ls production | grep -E "SENTRY_DSN|ENABLE_SENTRY"
# expect both present, Encrypted, Production
```

### 3. Redeploy

```
vercel redeploy <latest-prod-url>
```

Wait for `● Ready` then continue.

### 4. Smoke test (do NOT add a public error endpoint in production)

Test capture by triggering an existing error path that's already
authenticated, instead of opening a new public surface:

- Hit `/api/cron/process-outbox` with a wrong `x-cron-secret` header.
  The route returns 401, but the request reaches the handler — the
  expected `unauthorized` log is captured by Sentry as a `warning`
  (not an `error`), and the route tag will appear in Sentry's
  Performance / Issues view under
  `route: /api/cron/process-outbox`.
- Confirm in Sentry's "Issues" that at least one event has appeared
  in the last 5 minutes.

Do not deliberately throw a 500 in production. Wait for natural traffic to
prove capture, or trigger a malformed body to `/api/cart/validate` (returns
400, lower-noise).

### 5. Verify PII scrubbing

Pull a captured event in Sentry's UI and confirm:

- `request.cookies` shows `[redacted]` (or absent)
- `request.data` shows `[redacted]` (or absent)
- `request.headers.cookie`, `authorization`, `x-cron-secret` are all absent
- `user.email`, `user.ip_address` are absent
- `contexts.cart`, `contexts.customer`, `contexts.order`, `contexts.address`
  are absent or `[redacted]`

If any of these leak, file an immediate issue and disable Sentry by
setting `ENABLE_SENTRY=false` and redeploying — investigate before
re-enabling.

## Sentry-3 — Alert rules (Sentry dashboard only)

Alerts live in Sentry's UI; nothing is configured in code.

### Rule 1 — 5xx on critical routes

- Project → Alerts → New Issue Alert
- Conditions:
  - When: `level == error`
  - And: `tag.route` is one of:
    - `/api/orders/create`
    - `/api/cart/validate`
    - `/api/cron/process-outbox`
- Action: Send email to `zmsaddi@gmail.com`
- Frequency: at least 1 minute between notifications (avoid storms)

### Rule 2 — order_failed business event

- New Issue Alert
- Conditions:
  - When: `event.message contains "order.failed"` (the audit_log marker
    for stock unavailability and other order errors)
- Action: Same email
- Frequency: at most every 5 minutes

### Rule 3 — release health

- Once the first deploy with `ENABLE_SENTRY=true` lands, Sentry will start
  attributing errors to a `release` (the Vercel commit SHA). Use this in
  the Releases view to compare error rate before/after each deploy.

## Rollback

If Sentry's noise overwhelms or the integration causes any issue:

1. `vercel env rm ENABLE_SENTRY production --yes`
2. `vercel redeploy <latest>` — SDK becomes a no-op immediately.
3. SENTRY_DSN can stay in env; without ENABLE_SENTRY it's never read.

## Sourcemap upload (deferred to a later commit)

The current build does **not** upload source maps to Sentry. Stack traces
will be minified. To enable:

1. Sentry: Settings → Auth Tokens → Create new with `project:releases`
   scope. Copy.
2. `vercel env add SENTRY_AUTH_TOKEN production --value <token> --yes`
3. Update `nuxt.config.ts` `sentry` block:
   ```ts
   sourceMapsUploadOptions: {
     enabled: true,
     org: '<your-org>',
     project: 'vitesseeco',
     authToken: process.env.SENTRY_AUTH_TOKEN,
   }
   ```
4. Redeploy. The build pipeline will upload maps for the new release.

This is a separate commit, run *after* Sentry-2 has shown clean traffic
for at least 24 hours.
