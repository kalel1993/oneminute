import 'server-only';

import { createHmac } from 'crypto';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb, hasDb } from './db';
import { rateLimitBuckets } from './db/schema';

type RateLimitRule = {
  scope: string;
  limit: number;
  windowMs: number;
  identity?: string;
};

type MemoryBucket = { count: number; windowStart: number };
const memoryBuckets = new Map<string, MemoryBucket>();

function protectionSecret() {
  return (
    process.env.PLAYER_COOKIE_SECRET ??
    process.env.CLERK_SECRET_KEY ??
    process.env.STRIPE_WEBHOOK_SECRET ??
    'oneminute-local-protection-key'
  );
}

function clientAddress(req: Request) {
  const forwarded =
    req.headers.get('x-vercel-forwarded-for') ??
    req.headers.get('x-forwarded-for') ??
    req.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

function bucketKey(scope: string, identity: string) {
  return createHmac('sha256', protectionSecret())
    .update(`${scope}:${identity}`)
    .digest('hex');
}

function memoryIncrement(key: string, windowStart: number) {
  const current = memoryBuckets.get(key);
  if (!current || current.windowStart < windowStart) {
    memoryBuckets.set(key, { count: 1, windowStart });
    return 1;
  }
  current.count += 1;
  return current.count;
}

async function increment(key: string, windowStart: Date) {
  if (!hasDb()) return memoryIncrement(key, windowStart.getTime());

  const [bucket] = await getDb()
    .insert(rateLimitBuckets)
    .values({ key, count: 1, windowStart })
    .onConflictDoUpdate({
      target: rateLimitBuckets.key,
      set: {
        count: sql`case when ${rateLimitBuckets.windowStart} < ${windowStart} then 1 else ${rateLimitBuckets.count} + 1 end`,
        windowStart: sql`greatest(${rateLimitBuckets.windowStart}, ${windowStart})`,
        updatedAt: new Date(),
      },
    })
    .returning({ count: rateLimitBuckets.count });

  return bucket.count;
}

export function bodyWithinLimit(req: Request, maxBytes: number) {
  const raw = req.headers.get('content-length');
  if (!raw) return true;
  const size = Number(raw);
  return Number.isFinite(size) && size >= 0 && size <= maxBytes;
}

export async function rateLimitRequest(req: Request, rule: RateLimitRule) {
  const now = Date.now();
  const windowStartMs = Math.floor(now / rule.windowMs) * rule.windowMs;
  const identity = rule.identity ?? clientAddress(req);
  const count = await increment(bucketKey(rule.scope, identity), new Date(windowStartMs));
  if (count <= rule.limit) return null;

  const retryAfter = Math.max(1, Math.ceil((windowStartMs + rule.windowMs - now) / 1000));
  return NextResponse.json(
    { error: 'Too many requests. Please wait a moment and try again.', code: 'RATE_LIMITED' },
    {
      status: 429,
      headers: {
        'Cache-Control': 'private, no-store',
        'Retry-After': String(retryAfter),
      },
    },
  );
}

export function payloadTooLarge() {
  return NextResponse.json(
    { error: 'Request payload is too large.' },
    { status: 413, headers: { 'Cache-Control': 'private, no-store' } },
  );
}

