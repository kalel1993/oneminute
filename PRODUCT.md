# OneMinute.lol — product source of truth
OneMinute.lol is a mobile-first competitive micro-arcade. V1 contains exactly one game, Button Rush. The viral loop is **PLAY → RESULT → REPLAY or CHALLENGE → SHARE**. Visitors can play without an account or pre-game form; a durable anonymous identity and generated leaderboard name are created automatically, while optional login preserves score history and credit balance.

## Principles
- Exactly 60 seconds; deterministic server-seeded targets with escalating difficulty, progressively smaller hit areas and increasingly separated target positions.
- Honest competition: only validated server-authoritative runs rank. Never invent activity, users, scores, records, or traction.
- No signup/name gate before first play. Anonymous players receive a safe generated public name automatically; optional login claims the identity and its history.
- Leaderboards rank each player's best verified score for the selected lane/period, never repeated runs from the same player.
- The final ten seconds are unmistakable: an assertive visual countdown, escalating audio, and supported-device haptics increase urgency without obscuring the target.
- Results expose score, percentile/rank when real, streak, reaction, accuracy, and a truthful next score/rank target.
- Challenges create score-specific URLs and OG cards, open the native share sheet where available, compare verified scores, support rematches, and make “send it back” the primary victory loop.
- Homepage activity and leaderboard data refresh live without fabricating activity.
- Stark black/ivory/electric-green, mobile-first, accessible and reduced-motion aware.
- Gracefully playable as clearly unranked local mode without a database.

## Current deliverables
Landing, Button Rush, results/replay, daily and all-time leaderboards, generated public names, anonymous identity, optional login and account score history, three free ranked runs per UTC day, a paid-credit ledger, challenge/rematch URLs, dynamic OG cards, authoritative sessions and anti-cheat, touch/mouse modes, real live activity, analytics, SEO/legal assets, responsive accessibility, Postgres/Drizzle migrations, tests, and Vercel documentation.

## Credits
- Every player receives three free ranked starts per UTC day.
- After the free allowance, each ranked start costs one credit.
- Packs: 5 credits for £0.99, 30 for £3.99, and 100 for £7.99.
- Purchases require login and are fulfilled only from a signature-verified Stripe webhook. No prizes, withdrawals, or cash value.

## Explicit exclusions
No subscriptions, friends system, achievements, extra games, admin mega-dashboard, AI, chat, prizes, tournaments, country rankings, skins, or native apps.
