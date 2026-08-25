import { and, desc, eq, gte, sql } from 'drizzle-orm';
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
    return NextResponse.json(
      { configured: false, leaders: [], activity: [], viewer: null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
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
  const bestScore = sql<number>`max(${sessions.score})`.as('best_score');

  const [leaders, feed] = await Promise.all([
    getDb()
      .select({ name: players.displayName, score: bestScore })
      .from(sessions)
      .innerJoin(players, eq(players.id, sessions.playerId))
      .where(where)
      .groupBy(players.id, players.displayName)
      .orderBy(desc(bestScore))
      .limit(50),
    getDb()
      .select({ name: players.displayName, score: activity.score, at: activity.createdAt, kind: activity.kind })
      .from(activity)
      .innerJoin(players, eq(players.id, activity.playerId))
      .orderBy(desc(activity.createdAt))
      .limit(8),
  ]);

  const record = leaders[0]?.score ?? null;
  const topTenScores = new Set(leaders.slice(0, 10).map(row => row.score));
  const narrative = feed.map(item => {
    const activityMode = item.kind.includes(':') ? item.kind.split(':')[1] : null;
    let message = `${item.name} just scored ${item.score ?? 0}`;
    if (activityMode === mode && item.score != null && record != null && item.score === record) {
      message = `${item.name} holds the current pace at ${item.score}`;
    } else if (activityMode === mode && item.score != null && topTenScores.has(item.score)) {
      message = `${item.name} entered the Top 10 with ${item.score}`;
    }
    return { ...item, mode: activityMode, message };
  });

  return NextResponse.json(
    {
      configured: true,
      leaders,
      activity: narrative,
      count: leaders.length,
      updatedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
