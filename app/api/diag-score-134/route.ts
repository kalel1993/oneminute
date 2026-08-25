import {and,desc,eq,gte,isNotNull} from 'drizzle-orm';
import {NextResponse} from 'next/server';
import {getDb,hasDb} from '@/lib/db';
import {sessions} from '@/lib/db/schema';
import {BUTTON_RUSH_V2_STARTED_AT} from '@/lib/game/version';
import {GameEvent} from '@/lib/game/engine';
import {validateTrace} from '@/lib/game/validation';

export const dynamic='force-dynamic';

export async function GET(){
  if(process.env.VERCEL_ENV==='production')return NextResponse.json({error:'disabled'},{status:404});
  if(!hasDb())return NextResponse.json({configured:false});
  const rows=await getDb().select({score:sessions.score,mode:sessions.mode,startedAt:sessions.startedAt,finishedAt:sessions.finishedAt,valid:sessions.valid,suspicious:sessions.suspicious,trace:sessions.trace,seed:sessions.seed})
    .from(sessions)
    .where(and(eq(sessions.score,134),gte(sessions.startedAt,BUTTON_RUSH_V2_STARTED_AT),isNotNull(sessions.finishedAt)))
    .orderBy(desc(sessions.startedAt))
    .limit(10);
  const result=rows.map(row=>{
    const elapsed=row.finishedAt!.getTime()-row.startedAt.getTime();
    const mode=row.mode==='touch'?'touch':'mouse';
    const trace=Array.isArray(row.trace)?row.trace as GameEvent[]:[];
    const checked=validateTrace(row.seed,trace,elapsed,mode);
    const hitTimes=trace.filter(e=>e.type==='hit').map(e=>e.t);
    const intervals=hitTimes.slice(1).map((t,i)=>t-hitTimes[i]);
    return{
      stored:{score:row.score,mode,valid:row.valid,suspicious:row.suspicious,elapsed},
      checked:{valid:checked.valid,reasons:checked.reasons,score:checked.score},
      timing:{hits:hitTimes.length,minInterval:intervals.length?Math.min(...intervals):null,sub30:intervals.filter(v=>v<30).length,sub45:intervals.filter(v=>v<45).length},
    };
  });
  return NextResponse.json({count:result.length,result},{headers:{'Cache-Control':'no-store'}});
}
