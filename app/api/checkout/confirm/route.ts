import { NextResponse } from 'next/server';
import { z } from 'zod';
import { fulfilCheckout, stripeClient } from '@/lib/credits';
import { bodyWithinLimit, payloadTooLarge, rateLimitRequest } from '@/lib/protection';
import { identity, sameOrigin } from '@/lib/server';

export async function POST(req: Request) {
  if (!(await sameOrigin())) {
    return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 });
  }
  if (!bodyWithinLimit(req, 2048)) return payloadTooLarge();

  const parsed = z.object({ sessionId: z.string().startsWith('cs_').max(255) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid checkout.' }, { status: 400 });

  const player = await identity();
  if (!player.signedIn) {
    return NextResponse.json({ error: 'Log in to confirm your credits.' }, { status: 401 });
  }
  const limited = await rateLimitRequest(req, {
    scope: 'checkout-confirm-player',
    identity: player.id,
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const session = await stripeClient().checkout.sessions.retrieve(parsed.data.sessionId);
  if (session.metadata?.playerId !== player.id) {
    return NextResponse.json({ error: 'This checkout belongs to another account.' }, { status: 403 });
  }
  const fulfilled = await fulfilCheckout(session);
  return NextResponse.json({ fulfilled });
}

