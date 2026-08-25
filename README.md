# OneMinute.lol

A production-oriented, anonymous 60-second competitive micro-arcade built with Next.js App Router, TypeScript, Neon Postgres, Drizzle, Clerk, Stripe and Vercel. Product scope is frozen in [PRODUCT.md](PRODUCT.md).

## Local development

Requires Node 20.9+ and npm.

```bash
npm install --no-audit
cp .env.example .env.local
npm run dev
```

Without `DATABASE_URL`, gameplay, sounds, haptics, results, replay, sharing, SEO cards, and truthful empty states work. Ranked submission and challenge creation return explicit configuration errors; local scores never enter public data.

## Production environment

At minimum for ranked production play set:

- `DATABASE_URL`
- `PLAYER_COOKIE_SECRET` — a long random secret dedicated to signing durable anonymous player cookies

Optional account/credit features additionally use the Clerk and Stripe variables documented in `.env.example`. Never expose server secrets with a `NEXT_PUBLIC_` prefix.

## Provision Neon and migrate

1. Create a Neon Postgres project and copy its pooled connection string.
2. Set `DATABASE_URL` locally and in Vercel.
3. Apply all committed migrations from a trusted machine in numeric order.
4. Run `npm run build`, deploy, complete a run, and verify `/api/public` returns `configured: true`.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

## Vercel launch checklist

1. Import the GitHub repository into Vercel; framework preset is Next.js and no custom build command is needed.
2. Add `DATABASE_URL` and `PLAYER_COOKIE_SECRET` as secret environment variables. Add Clerk/Stripe secrets only when those features are enabled. Redeploy production after any environment-variable change.
3. Apply migrations before accepting ranked traffic.
4. Smoke-test home, a full 60-second run, both leaderboard lanes/periods, challenge creation, native/fallback sharing, challenge acceptance, dynamic 1200×630 challenge cards, account purchase flow, privacy/terms/refunds routes and sitemap/robots.
5. Assign `oneminute.lol` and `www.oneminute.lol`, redirect `www` to the apex, and verify DNS/SSL.
6. Confirm Vercel Analytics receives privacy-conscious event names and verify UTC daily rollover.
7. Confirm live leaderboard/activity refreshes and that repeated runs from one player occupy only one leaderboard position.

## Security model

A secure, same-site, httpOnly durable cookie identifies an anonymous player. Production cookie signatures use dedicated or server-only deployment secrets and never a public hard-coded key. Session starts are server-timestamped and cryptographically identified. Finalization is ownership-checked and idempotent; ordered compact traces are checked for duration, monotonicity, deterministic target geometry, bounds, hit cadence, machine-like timing/targeting and event limits. Suspicious traces are retained but never ranked. Public names are format checked and screened for a launch blocklist. Production should additionally layer Vercel Firewall/rate limiting and database monitoring according to traffic.
