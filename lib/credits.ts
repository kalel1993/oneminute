import 'server-only';
import Stripe from 'stripe';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';

export const CREDIT_PACKS={starter:{credits:5,amount:99,label:'5 credits'},boost:{credits:30,amount:399,label:'30 credits'},arcade:{credits:100,amount:799,label:'100 credits'}} as const;
export type CreditPack=keyof typeof CREDIT_PACKS;

export function stripeClient(){const key=process.env.STRIPE_SECRET_KEY;if(!key)throw new Error('STRIPE_NOT_CONFIGURED');return new Stripe(key)}

export async function fulfilCheckout(session:Stripe.Checkout.Session){const packId=session.metadata?.pack as CreditPack|undefined,playerId=session.metadata?.playerId,pack=packId?CREDIT_PACKS[packId]:undefined;if(!pack||!playerId||session.payment_status!=='paid'||session.currency!=='gbp'||session.amount_total!==pack.amount)return false;await getDb().execute(sql`WITH purchased AS (INSERT INTO credit_purchases (stripe_session_id,player_id,credits,amount,currency) SELECT ${session.id},${playerId},${pack.credits},${pack.amount},'gbp' WHERE EXISTS (SELECT 1 FROM players WHERE id=${playerId}) ON CONFLICT (stripe_session_id) DO NOTHING RETURNING player_id,credits) UPDATE players SET credits=players.credits+purchased.credits FROM purchased WHERE players.id=purchased.player_id`);return true}
