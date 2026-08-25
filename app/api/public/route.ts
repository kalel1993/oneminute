import { and, desc, eq, gte } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb, hasDb } from '@/lib/db';
import { activity, players, sessions } from '@/lib/db/schema';
import { rateLimitRequest } from '@/lib/protection';

export async function GET(req: Request) {
  const limited = await rateLimitRequest(req, {
    scope: 'public-leaderboard-ip',
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  if (!hasDb()) {
    return NextResponse.json({ configured: false, leaders: [], activity: [], viewer: null });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get('mode') === 'mouse' ? 'mouse' : 'touch';
  const period = url.searchParams.get('period') === 'all' ? 'all' : 'today';
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const where =
    period === 'today'
      ? and(eq(sessions.valid, true), eq(sessions.mode, mode), gte(sessions.startedAt, since))
      : and(eq(sessions.valid, true), eq(sessions.mode, mode));

  const [leaders, feed] = await Promise.all([
    getDb()
      .select({ name: players.displayName, score: sessions.score })
      .from(sessions)
      .innerJoin(players, eq(players.id, sessions.playerId))
      .where(where)
      .orderBy(desc(sessions.score))
      .limit(50),
    getDb()
      .select({ name: players.displayName, score: activity.score, at: activity.createdAt })
      .from(activity)
      .innerJoin(players, eq(players.id, activity.playerId))
      .orderBy(desc(activity.createdAt))
      .limit(8),
  ]);

  return NextResponse.json({
    configured: true,
    leaders,
    activity: feed,
    count: leaders.length,
  });
}

