import { auth } from '@clerk/nextjs/server';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { eq } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { getDb, hasDb } from './db';
import { players } from './db/schema';

const adjectives = ['Electric', 'Rapid', 'Neon', 'Turbo', 'Lucky', 'Brisk'];
const nouns = ['Mantis', 'Panda', 'Falcon', 'Gecko', 'Otter', 'Cobra'];

function playerCookieSecret() {
  return (
    process.env.PLAYER_COOKIE_SECRET ??
    process.env.CLERK_SECRET_KEY ??
    process.env.STRIPE_WEBHOOK_SECRET ??
    'oneminute-local-player-cookie-key'
  );
}

function signPlayerId(id: string) {
  return createHmac('sha256', playerCookieSecret()).update(id).digest('base64url');
}

export function encodePlayerCookie(id: string) {
  return `${id}.${signPlayerId(id)}`;
}

export function decodePlayerCookie(value?: string) {
  if (!value) return null;
  const separator = value.lastIndexOf('.');
  if (separator < 1) return null;
  const id = value.slice(0, separator);
  const received = value.slice(separator + 1);
  const expected = signPlayerId(id);
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length) return null;
  return timingSafeEqual(receivedBuffer, expectedBuffer) ? id : null;
}

export function cleanDisplayName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .slice(0, 20);
}

export const clerkConfigured = () =>
  Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export async function signedInUserId() {
  if (!clerkConfigured()) return null;
  try {
    return (await auth()).userId;
  } catch {
    return null;
  }
}

function rememberPlayer(jar: Awaited<ReturnType<typeof cookies>>, id: string) {
  jar.set('om_player', encodePlayerCookie(id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 31536000,
  });
}

export async function identity(requestedName?: string) {
  const jar = await cookies();
  let id = decodePlayerCookie(jar.get('om_player')?.value);
  if (!id) {
    id = randomBytes(18).toString('base64url');
    rememberPlayer(jar, id);
  }

  let generatedName = `${adjectives[parseInt(id.slice(0, 2), 36) % adjectives.length]} ${nouns[parseInt(id.slice(-2), 36) % nouns.length]}`;
  let credits = 0;
  const chosen = requestedName ? cleanDisplayName(requestedName) : '';
  const userId = await signedInUserId();

  if (hasDb()) {
    const db = getDb();
    await db.insert(players).values({ id, displayName: generatedName }).onConflictDoNothing();

    if (userId) {
      const [account] = await db.select().from(players).where(eq(players.clerkUserId, userId)).limit(1);
      if (account) {
        id = account.id;
        generatedName = account.displayName;
        credits = account.credits;
        rememberPlayer(jar, id);
      } else {
        await db.update(players).set({ clerkUserId: userId }).where(eq(players.id, id));
        const [claimed] = await db.select().from(players).where(eq(players.id, id)).limit(1);
        credits = claimed?.credits ?? 0;
      }
    }

    if (chosen.length >= 2) {
      await db.update(players).set({ displayName: chosen }).where(eq(players.id, id));
    } else {
      const [current] = await db
        .select({ displayName: players.displayName, credits: players.credits })
        .from(players)
        .where(eq(players.id, id))
        .limit(1);
      if (current) {
        generatedName = current.displayName;
        credits = current.credits;
      }
    }
  }

  return {
    id,
    displayName: chosen.length >= 2 ? chosen : generatedName,
    signedIn: Boolean(userId),
    credits,
  };
}

export async function sameOrigin() {
  const requestHeaders = await headers();
  if (requestHeaders.get('sec-fetch-site') === 'cross-site') return false;
  const origin = requestHeaders.get('origin');
  const host = requestHeaders.get('host');
  if (!origin) return true;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function token(n = 12) {
  return randomBytes(n).toString('base64url');
}

export function seed() {
  return randomInt(1, 2147483646);
}

export function fingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

