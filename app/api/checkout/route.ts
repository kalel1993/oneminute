import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CREDIT_PACKS, stripeClient } from '@/lib/credits';
import { bodyWithinLimit, payloadTooLarge, rateLimitRequest } from '@/lib/protection';
import { identity, sameOrigin } from '@/lib/server';

export async function POST(req: Request) {
  if (!(await sameOrigin())) {
    return NextResponse.json({ error: 'Cross-origin request refused' }, { status: 403 });
  }
  if (!bodyWithinLimit(req, 2048)) return payloadTooLarge();

  const ipLimit = await rateLimitRequest(req, {
    scope: 'checkout-create-ip',
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (ipLimit) return ipLimit;

  const parsed = z.object({ pack: z.enum(['starter', 'boost', 'arcade']) }).safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Choose a valid credit pack.' }, { status: 400 });
  }

  const player = await identity();
  if (!player.signedIn) {
    return NextResponse.json({ error: 'Log in before buying credits.' }, { status: 401 });
  }
  const playerLimit = await rateLimitRequest(req, {
    scope: 'checkout-create-player',
    identity: player.id,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (playerLimit) return playerLimit;

  const pack = CREDIT_PACKS[parsed.data.pack];
  const origin = new URL(req.url).origin;
  const session = await stripeClient().checkout.sessions.create({
    mode: 'payment',
    client_reference_id: player.id,
    line_items: [
      {
        price_data: {
          currency: 'gbp',
          unit_amount: pack.amount,
          product_data: {
            name: `OneMinute.lol — ${pack.label}`,
            description: 'Arcade play credits. No prizes, cash value or cash-out.',
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/account?checkout=cancelled`,
    metadata: {
      pack: parsed.data.pack,
      credits: String(pack.credits),
      playerId: player.id,
    },
  });

  return NextResponse.json({ url: session.url });
}

