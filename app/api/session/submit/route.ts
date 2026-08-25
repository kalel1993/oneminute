import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { identity, sameOrigin, fingerprint, token } from '@/lib/server';
import { getDb, hasDb } from '@/lib/db';
import { activity, sessions, submissions } from '@/lib/db/schema';
import { validateTrace } from '@/lib/game/validation';

const event = z.object({
  type: z.enum(['hit', 'miss']),
  t: z.number().nonnegative(),
  x: z.number(),
  y: z.number(),
});

export async function POST(req: Request) {
  if (!(await sameOrigin())) {
    return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 });
  }

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
  const db = getDb();
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, body.data.sessionId), eq(sessions.playerId, player.id)))
    .limit(1);

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (session.finishedAt) {
    return NextResponse.json({ ranked: session.valid, result: { score: session.score } });
  }

  const elapsed = Date.now() - session.startedAt.getTime();
  const result = validateTrace(session.seed, body.data.events, elapsed);
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

  if (result.valid) {
    await db.insert(activity).values({
      id: token(),
      playerId: player.id,
      kind: 'completed',
      score: result.score,
    });
  } else {
    return NextResponse.json({ ranked: false, result, reasons: result.reasons });
  }

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(sessions)
    .where(and(eq(sessions.valid, true), eq(sessions.mode, session.mode)));
  const [{ better }] = await db
    .select({ better: sql<number>`count(*)::int` })
    .from(sessions)
    .where(
      and(eq(sessions.valid, true), eq(sessions.mode, session.mode), gt(sessions.score, result.score)),
    );

  const rank = better + 1;
  const percentile = Math.max(1, Math.round(((total - better) / total) * 100));
  return NextResponse.json({
    ranked: true,
    result: {
      ...result,
      rank,
      percentile,
      worldRecord: rank === 1 && total > 0,
      nextTarget: rank > 1 ? 1 : null,
    },
    reasons: [],
  });
}
