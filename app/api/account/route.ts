import { and, desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb, hasDb } from '@/lib/db';
import { players, sessions } from '@/lib/db/schema';
import { rateLimitRequest } from '@/lib/protection';
import { identity } from '@/lib/server';

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

