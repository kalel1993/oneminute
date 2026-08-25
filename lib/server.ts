import { cookies,headers } from 'next/headers';import { randomBytes,randomInt,createHash } from 'crypto';import { getDb,hasDb } from './db';import { players } from './db/schema';
const adjectives=['Electric','Rapid','Neon','Turbo','Lucky','Brisk'];const nouns=['Mantis','Panda','Falcon','Gecko','Otter','Cobra'];
export async function identity(){const jar=await cookies();let id=jar.get('om_player')?.value;if(!id){id=randomBytes(18).toString('base64url');jar.set('om_player',id,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:31536000})}const displayName=`${adjectives[parseInt(id.slice(0,2),36)%adjectives.length]} ${nouns[parseInt(id.slice(-2),36)%nouns.length]}`;if(hasDb())await getDb().insert(players).values({id,displayName}).onConflictDoNothing();return{id,displayName}}
export async function sameOrigin(){const h=await headers();const origin=h.get('origin');const host=h.get('host');return !origin||new URL(origin).host===host}
export function token(n=12){return randomBytes(n).toString('base64url')}
export function seed(){return randomInt(1,2147483646)}
export function fingerprint(v:unknown){return createHash('sha256').update(JSON.stringify(v)).digest('hex')}
