import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, asc, eq, gt, gte, isNull, sql } from 'drizzle-orm';
import { identity, sameOrigin, fingerprint, token } from '@/lib/server';
import { getDb, hasDb } from '@/lib/db';
import { activity, sessions, submissions } from '@/lib/db/schema';
import { validateTrace } from '@/lib/game/validation';
import { BUTTON_RUSH_V2_STARTED_AT } from '@/lib/game/version';
import { bodyWithinLimit, payloadTooLarge, rateLimitRequest } from '@/lib/protection';

const event = z.object({
  type: z.enum(['hit', 'miss']),
  t: z.number().nonnegative(),
  x: z.number(),
  y: z.number(),
  targetId: z.number().int().min(0).max(3).optional(),
});

export async function POST(req: Request) {
  if (!(await sameOrigin())) {
    return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 });
  }
  if (!bodyWithinLimit(req, 128 * 1024)) return payloadTooLarge();

  const ipLimit = await rateLimitRequest(req, {
    scope: 'session-submit-ip',
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (ipLimit) return ipLimit;

  const body = z
    .object({ sessionId: z.string().min(10), events: z.array(event).max(500) })
    .safeParse(await req.json());

  if (!body.success) {
    return NextResponse.json({ error: 'Malformed trace' }, { status: 400 });
  }
  if (!hasDb()) {
    return NextResponse.json({ ranked: false, reason: 'Database not configured', result: null });
  }

  const player = await identity();
  const playerLimit = await rateLimitRequest(req, {
    scope: 'session-submit-player',
    identity: player.id,
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (playerLimit) return playerLimit;

  const db = getDb();
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, body.data.sessionId), eq(sessions.playerId, player.id)))
    .limit(1);

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (session.startedAt < BUTTON_RUSH_V2_STARTED_AT) {
    return NextResponse.json({ ranked: false, reason: 'Button Rush upgraded to V2. Start a new run.', result: null });
  }
  if (session.finishedAt) {
    return NextResponse.json({ ranked: session.valid, result: { score: session.score } });
  }

  const elapsed = Date.now() - session.startedAt.getTime();
  const result = validateTrace(session.seed, body.data.events, elapsed);
  const v2ModeFilter = and(
    eq(sessions.valid, true),
    eq(sessions.mode, session.mode),
    gte(sessions.startedAt, BUTTON_RUSH_V2_STARTED_AT),
  );
  const [recordBefore] = await db
    .select({ score: sql<number | null>`max(${sessions.score})` })
    .from(sessions)
    .where(v2ModeFilter);
  const previousRecord = recordBefore?.score ?? null;

  const [finalized] = await db
    .update(sessions)
    .set({
      finishedAt: new Date(),
      score: result.score,
      valid: result.valid,
      suspicious: !result.valid,
      trace: body.data.events,
    })
    .where(and(eq(sessions.id, session.id), isNull(sessions.finishedAt)))
    .returning({ id: sessions.id });

  if (!finalized) {
    const [existing] = await db
      .select({ valid: sessions.valid, score: sessions.score })
      .from(sessions)
      .where(eq(sessions.id, session.id))
      .limit(1);
    return NextResponse.json({ ranked: existing?.valid ?? false, result: { score: existing?.score ?? 0 } });
  }

  await db
    .insert(submissions)
    .values({ sessionId: session.id, fingerprint: fingerprint(body.data.events) })
    .onConflictDoNothing();

  if (!result.valid) {
    return NextResponse.json({ ranked: false, result, reasons: result.reasons });
  }

  await db.insert(activity).values({
    id: token(),
    playerId: player.id,
    kind: `completed:${session.mode}:v2`,
    score: result.score,
  });

  const bestScores = db
    .select({
      playerId: sessions.playerId,
      bestScore: sql<number>`max(${sessions.score})`.as('best_score'),
    })
    .from(sessions)
    .where(v2ModeFilter)
    .groupBy(sessions.playerId)
    .as('best_scores');

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(bestScores);
  const [{ better }] = await db
    .select({ better: sql<number>`count(*)::int` })
    .from(bestScores)
    .where(gt(bestScores.bestScore, result.score));

  const rank = better + 1;
  const percentile = total > 0 ? Math.max(1, Math.round(((total - better) / total) * 100)) : 100;
  const [next] = await db
    .select({ score: bestScores.bestScore })
    .from(bestScores)
    .where(gt(bestScores.bestScore, result.score))
    .orderBy(asc(bestScores.bestScore))
    .limit(1);

  let nextTarget: { score: number; rank: number; hitsNeeded: number } | null = null;
  if (next?.score != null) {
    const [{ aboveNext }] = await db
      .select({ aboveNext: sql<number>`count(*)::int` })
      .from(bestScores)
      .where(gt(bestScores.bestScore, next.score));
    nextTarget = {
      score: next.score,
      rank: aboveNext + 1,
      hitsNeeded: Math.max(1, next.score - result.score),
    };
  }

  return NextResponse.json({
    ranked: true,
    result: {
      ...result,
      rank,
      percentile,
      worldRecord: previousRecord === null || result.score > previousRecord,
      nextTarget,
    },
    reasons: [],
  });
}
