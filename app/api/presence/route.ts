import {eq} from 'drizzle-orm';
import {NextResponse} from 'next/server';
import {getDb,hasDb} from '@/lib/db';
import {players} from '@/lib/db/schema';
import {ensurePresenceSchema} from '@/lib/presence';
import {identity,sameOrigin} from '@/lib/server';

export async function POST(){
  if(!(await sameOrigin()))return NextResponse.json({error:'Cross-origin request refused'},{status:403});
  if(!hasDb())return new NextResponse(null,{status:204,headers:{'Cache-Control':'no-store'}});

  await ensurePresenceSchema();
  const player=await identity();
  await getDb().update(players).set({lastSeenAt:new Date()}).where(eq(players.id,player.id));
  return new NextResponse(null,{status:204,headers:{'Cache-Control':'no-store'}});
}
