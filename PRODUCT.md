# OneMinute.lol — product source of truth
OneMinute.lol is a mobile-first competitive micro-arcade. V1 contains exactly one game, Button Rush. The viral loop is **NAME → PLAY → RESULT → REPLAY or CHALLENGE → SHARE**. Visitors can play without an account, while optional login preserves their score history and credit balance.

## Principles
- Exactly 60 seconds; deterministic server-seeded moving targets with escalating difficulty.
- Honest competition: only validated server-authoritative runs rank. Never invent activity, users, scores, records, or traction.
- A player chooses a public leaderboard name before each run. A durable anonymous identity remains available, and optional login claims that identity and its history.
- The final ten seconds are unmistakable: an assertive visual countdown, escalating audio, and supported-device haptics increase urgency without obscuring the target.
- Results expose score, percentile/rank when real, streak, reaction, accuracy, and a truthful next target.
- Challenges preserve context, compare verified scores, support rematches and sharing.
- Stark black/ivory/electric-green, mobile-first, accessible and reduced-motion aware.
- Gracefully playable as clearly unranked local mode without a database.

## Current deliverables
Landing, Button Rush, results/replay, daily and all-time leaderboards, chosen public names, anonymous identity, optional login and account score history, three free ranked runs per UTC day, a paid-credit ledger, challenge/rematch URLs, dynamic OG cards, authoritative sessions and anti-cheat, touch/mouse modes, real activity, analytics, SEO assets, responsive accessibility, Postgres/Drizzle migrations, tests, and Vercel documentation.

## Credits
- Every player receives three free ranked starts per UTC day.
- After the free allowance, each ranked start costs one credit.
- Packs: 5 credits for £0.99, 30 for £3.99, and 100 for £7.99.
- Purchases require login and are fulfilled only from a signature-verified Stripe webhook. No prizes, withdrawals, or cash value.

## Explicit exclusions
No subscriptions, friends system, achievements, extra games, admin mega-dashboard, AI, chat, prizes, tournaments, country rankings, skins, or native apps.
