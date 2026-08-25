import 'server-only';
import {and,desc,eq,gte,isNotNull} from 'drizzle-orm';
import {getDb,hasDb} from '@/lib/db';
import {sessions} from '@/lib/db/schema';
import {BUTTON_RUSH_V2_STARTED_AT} from './version';
import {GameEvent} from './engine';
import {validateTrace} from './validation';

let repairPromise:Promise<void>|null=null;

export function repairRecentV2Runs(){
  if(!hasDb())return Promise.resolve();
  if(!repairPromise){
    repairPromise=(async()=>{
      const db=getDb();
      const rows=await db
        .select({id:sessions.id,seed:sessions.seed,mode:sessions.mode,startedAt:sessions.startedAt,finishedAt:sessions.finishedAt,trace:sessions.trace})
        .from(sessions)
        .where(and(
          eq(sessions.valid,false),
          eq(sessions.suspicious,true),
          gte(sessions.startedAt,BUTTON_RUSH_V2_STARTED_AT),
          isNotNull(sessions.finishedAt),
        ))
        .orderBy(desc(sessions.startedAt))
        .limit(200);

      for(const row of rows){
        if(!row.finishedAt||!Array.isArray(row.trace))continue;
        const elapsed=row.finishedAt.getTime()-row.startedAt.getTime();
        const mode=row.mode==='touch'?'touch':'mouse';
        const result=validateTrace(row.seed,row.trace as GameEvent[],elapsed,mode);
        if(!result.valid)continue;
        await db.update(sessions).set({valid:true,suspicious:false,score:result.score}).where(eq(sessions.id,row.id));
      }
    })().catch(error=>{
      repairPromise=null;
      throw error;
    });
  }
  return repairPromise;
}
