import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, hasDb } from '@/lib/db';
import { challenges, players, sessions } from '@/lib/db/schema';
import { bodyWithinLimit, payloadTooLarge, rateLimitRequest } from '@/lib/protection';
import { identity, sameOrigin, token } from '@/lib/server';

export async function POST(req: Request) {
  if (!(await sameOrigin())) {
    return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 });
  }
  if (!bodyWithinLimit(req, 2048)) return payloadTooLarge();
  if (!hasDb()) {
    return NextResponse.json(
      { error: 'Challenges require DATABASE_URL and a verified ranked score.' },
      { status: 503 },
    );
  }

  const player = await identity();
  const limited = await rateLimitRequest(req, {
    scope: 'challenge-create-player',
    identity: player.id,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = z
    .object({ sessionId: z.string().min(10).max(64), parentId: z.string().max(32).optional() })
    .safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const [session] = await getDb()
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.id, body.data.sessionId),
        eq(sessions.playerId, player.id),
        eq(sessions.valid, true),
      ),
    )
    .limit(1);
  if (!session) {
    return NextResponse.json({ error: 'Only your verified score can be challenged.' }, { status: 400 });
  }

  const id = token(6);
  await getDb()
    .insert(challenges)
    .values({ id, creatorId: player.id, sessionId: session.id, parentId: body.data.parentId });
  return NextResponse.json({ id, url: `https://oneminute.lol/c/${id}` });
}

export async function GET(req: Request) {
  const limited = await rateLimitRequest(req, {
    scope: 'challenge-read-ip',
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;
  if (!hasDb()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id || !/^[a-zA-Z0-9_-]{6,32}$/.test(id)) {
    return NextResponse.json({ error: 'Missing challenge' }, { status: 400 });
  }

  const [row] = await getDb()
    .select({ name: players.displayName, score: sessions.score })
    .from(challenges)
    .innerJoin(players, eq(players.id, challenges.creatorId))
    .innerJoin(sessions, eq(sessions.id, challenges.sessionId))
    .where(and(eq(challenges.id, id), eq(sessions.valid, true)))
    .limit(1);
  return row
    ? NextResponse.json(row)
    : NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
}

