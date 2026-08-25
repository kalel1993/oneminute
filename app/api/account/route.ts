import { and, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, hasDb } from '@/lib/db';
import { players, sessions } from '@/lib/db/schema';
import { isAllowedDisplayName } from '@/lib/moderation';
import { bodyWithinLimit, payloadTooLarge, rateLimitRequest } from '@/lib/protection';
import { cleanDisplayName, identity, sameOrigin } from '@/lib/server';

export async function GET(req: Request) {
  const player = await identity();
  if (!player.signedIn) {
    return NextResponse.json({ error: 'Log in to view your account.' }, { status: 401 });
  }

  const limited = await rateLimitRequest(req, {
    scope: 'account-read-player',
    identity: player.id,
    limit: 90,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;
  if (!hasDb()) {
    return NextResponse.json({ error: 'Score history is temporarily unavailable.' }, { status: 503 });
  }

  const db = getDb();
  const [[summary], recent, [fresh]] = await Promise.all([
    db
      .select({
        games: sql<number>`count(*)::int`,
        best: sql<number>`coalesce(max(${sessions.score}),0)::int`,
      })
      .from(sessions)
      .where(and(eq(sessions.playerId, player.id), eq(sessions.valid, true))),
    db
      .select({ score: sessions.score, mode: sessions.mode, finishedAt: sessions.finishedAt })
      .from(sessions)
      .where(and(eq(sessions.playerId, player.id), eq(sessions.valid, true)))
      .orderBy(desc(sessions.finishedAt))
      .limit(10),
    db
      .select({
        displayName: players.displayName,
        credits: players.credits,
        dailyPlayDate: players.dailyPlayDate,
        dailyPlays: players.dailyPlays,
      })
      .from(players)
      .where(eq(players.id, player.id))
      .limit(1),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const dailyPlays = fresh?.dailyPlayDate === today ? fresh.dailyPlays : 0;
  return NextResponse.json({
    displayName: fresh?.displayName ?? player.displayName,
    credits: fresh?.credits ?? 0,
    freeRemaining: Math.max(0, 3 - dailyPlays),
    games: summary.games,
    best: summary.best,
    recent,
  });
}

export async function PATCH(req: Request) {
  if (!(await sameOrigin())) {
    return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 });
  }
  if (!bodyWithinLimit(req, 2048)) return payloadTooLarge();

  const player = await identity();
  if (!player.signedIn) {
    return NextResponse.json({ error: 'Log in to claim a leaderboard name.' }, { status: 401 });
  }
  const limited = await rateLimitRequest(req, {
    scope: 'account-name-player',
    identity: player.id,
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;
  if (!hasDb()) {
    return NextResponse.json({ error: 'Account changes are temporarily unavailable.' }, { status: 503 });
  }

  const parsed = z.object({ displayName: z.string().min(2).max(20) }).safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Use 2–20 characters.' }, { status: 400 });
  }
  const displayName = cleanDisplayName(parsed.data.displayName);
  if (displayName.length < 2 || !isAllowedDisplayName(displayName)) {
    return NextResponse.json({ error: 'Choose a different leaderboard name.' }, { status: 400 });
  }

  await getDb().update(players).set({ displayName }).where(eq(players.id, player.id));
  return NextResponse.json({ displayName });
}
