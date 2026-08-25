import type Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { fulfilCheckout, stripeClient } from '@/lib/credits';
import { bodyWithinLimit, payloadTooLarge } from '@/lib/protection';

export async function POST(req: Request) {
  if (!bodyWithinLimit(req, 1024 * 1024)) return payloadTooLarge();
  const signature = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    await fulfilCheckout(event.data.object);
  }
  return NextResponse.json({ received: true });
}

