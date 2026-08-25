import {and,desc,eq,gte,sql} from 'drizzle-orm';
import {NextResponse} from 'next/server';
import {getDb,hasDb} from '@/lib/db';
import {activity,players,sessions} from '@/lib/db/schema';
import {repairRecentV2Runs} from '@/lib/game/repair';
import {BUTTON_RUSH_VERSION} from '@/lib/game/version';
import {ensurePresenceSchema} from '@/lib/presence';
import {rateLimitRequest} from '@/lib/protection';

export async function GET(req:Request){
  const limited=await rateLimitRequest(req,{scope:'public-leaderboard-ip',limit:120,windowMs:60*1000});
  if(limited)return limited;

  if(!hasDb()){
    return NextResponse.json(
      {configured:false,leaders:[],activity:[],viewer:null,gameVersion:BUTTON_RUSH_VERSION,totalVisitors:0,liveVisitors:0},
      {headers:{'Cache-Control':'no-store'}},
    );
  }

  await Promise.all([ensurePresenceSchema(),repairRecentV2Runs()]);

  const url=new URL(req.url);
  const mode=url.searchParams.get('mode')==='mouse'?'mouse':'touch';
  const period=url.searchParams.get('period')==='all'?'all':'today';
  const dayStart=new Date();
  dayStart.setUTCHours(0,0,0,0);
  const where=period==='today'
    ?and(eq(sessions.valid,true),eq(sessions.mode,mode),gte(sessions.startedAt,dayStart))
    :and(eq(sessions.valid,true),eq(sessions.mode,mode));
  const bestScore=sql<number>`max(${sessions.score})`.as('best_score');
  const liveSince=new Date(Date.now()-90_000);

  const [leaders,feed,totalRows,liveRows]=await Promise.all([
    getDb()
      .select({name:players.displayName,score:bestScore})
      .from(sessions)
      .innerJoin(players,eq(players.id,sessions.playerId))
      .where(where)
      .groupBy(players.id,players.displayName)
      .orderBy(desc(bestScore)),
    getDb()
      .select({name:players.displayName,score:activity.score,at:activity.createdAt,kind:activity.kind})
      .from(activity)
      .innerJoin(players,eq(players.id,activity.playerId))
      .orderBy(desc(activity.createdAt))
      .limit(8),
    getDb().select({count:sql<number>`count(*)::int`}).from(players),
    getDb().select({count:sql<number>`count(*)::int`}).from(players).where(gte(players.lastSeenAt,liveSince)),
  ]);

  const record=leaders[0]?.score??null;
  const topTenScores=new Set(leaders.slice(0,10).map(row=>row.score));
  const narrative=feed.map(item=>{
    const activityMode=item.kind.includes(':')?item.kind.split(':')[1]:null;
    let message=`${item.name} just scored ${item.score??0}`;
    if(activityMode===mode&&item.score!=null&&record!=null&&item.score===record){
      message=`${item.name} holds the current pace at ${item.score}`;
    }else if(activityMode===mode&&item.score!=null&&topTenScores.has(item.score)){
      message=`${item.name} entered the Top 10 with ${item.score}`;
    }
    return{...item,mode:activityMode,message};
  });

  return NextResponse.json(
    {
      configured:true,
      leaders,
      activity:narrative,
      count:leaders.length,
      gameVersion:BUTTON_RUSH_VERSION,
      totalVisitors:totalRows[0]?.count??0,
      liveVisitors:liveRows[0]?.count??0,
      updatedAt:new Date().toISOString(),
    },
    {headers:{'Cache-Control':'no-store'}},
  );
}
