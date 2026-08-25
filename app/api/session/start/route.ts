import { and, eq, gt, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, hasDb } from '@/lib/db';
import { players, sessions } from '@/lib/db/schema';
import { isAllowedDisplayName } from '@/lib/moderation';
import { bodyWithinLimit, payloadTooLarge, rateLimitRequest } from '@/lib/protection';
import { identity, sameOrigin, seed, token } from '@/lib/server';

const requestSchema = z.object({
  mode: z.enum(['touch', 'mouse']),
  displayName: z.string().trim().min(2).max(20).regex(/^[a-zA-Z0-9 _-]+$/).optional(),
});

export async function POST(req: Request) {
  if (!(await sameOrigin())) {
    return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 });
  }
  if (!bodyWithinLimit(req, 2048)) return payloadTooLarge();

  const ipLimit = await rateLimitRequest(req, {
    scope: 'session-start-ip',
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (ipLimit) return ipLimit;

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Leaderboard names use 2–20 letters, numbers, spaces, _ or -.' },
      { status: 400 },
    );
  }
  if (parsed.data.displayName && !isAllowedDisplayName(parsed.data.displayName)) {
    return NextResponse.json(
      { error: 'Choose a different leaderboard name.' },
      { status: 400 },
    );
  }

  const player = await identity(parsed.data.displayName);
  const playerLimit = await rateLimitRequest(req, {
    scope: 'session-start-player',
    identity: player.id,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (playerLimit) return playerLimit;

  const id = token(18);
  const startedAt = new Date();
  const gameSeed = seed();
  let creditUsed = false;
  let credits = player.credits;
  let freeRemaining = 3;

  if (hasDb()) {
    const db = getDb();
    const today = startedAt.toISOString().slice(0, 10);
    const newDay = or(isNull(players.dailyPlayDate), ne(players.dailyPlayDate, today));
    const freeAvailable = or(newDay, lt(players.dailyPlays, 3));
    const canStart = player.signedIn ? or(freeAvailable, gt(players.credits, 0)) : freeAvailable;

    const [usage] = await db
      .update(players)
      .set({
        dailyPlayDate: today,
        dailyPlays: sql`case when ${players.dailyPlayDate} is distinct from ${today} then 1 when ${players.dailyPlays} < 3 then ${players.dailyPlays} + 1 else ${players.dailyPlays} end`,
        credits: sql`case when ${players.dailyPlayDate} is not distinct from ${today} and ${players.dailyPlays} >= 3 then ${players.credits} - 1 else ${players.credits} end`,
      })
      .where(and(eq(players.id, player.id), canStart))
      .returning({ credits: players.credits, dailyPlays: players.dailyPlays });

    if (!usage) {
      if (!player.signedIn) {
        return NextResponse.json(
          {
            error: 'Your 3 free plays are used for today. Log in to keep your scores and use credits.',
            code: 'LOGIN_REQUIRED',
          },
          { status: 402 },
        );
      }
      return NextResponse.json(
        {
          error: 'Your 3 free plays are used for today. Add a credit pack to keep playing.',
          code: 'CREDITS_REQUIRED',
        },
        { status: 402 },
      );
    }

    creditUsed = usage.credits < player.credits;
    credits = usage.credits;
    freeRemaining = Math.max(0, 3 - usage.dailyPlays);

    try {
      await db.insert(sessions).values({
        id,
        playerId: player.id,
        mode: parsed.data.mode,
        seed: gameSeed,
        startedAt,
      });
    } catch (error) {
      if (creditUsed) {
        await db
          .update(players)
          .set({ credits: sql`${players.credits} + 1` })
          .where(eq(players.id, player.id));
      } else {
        await db
          .update(players)
          .set({ dailyPlays: sql`greatest(${players.dailyPlays} - 1, 0)` })
          .where(and(eq(players.id, player.id), eq(players.dailyPlayDate, today)));
      }
      throw error;
    }
  }

  return NextResponse.json({
    sessionId: id,
    seed: gameSeed,
    startedAt: startedAt.toISOString(),
    duration: 60000,
    ranked: hasDb(),
    displayName: player.displayName,
    usage: { freeRemaining, creditUsed, credits },
  });
}
