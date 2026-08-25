import {ImageResponse} from 'next/og';
import {and,eq,gte} from 'drizzle-orm';
import {getDb,hasDb} from '@/lib/db';
import {challenges,players,sessions} from '@/lib/db/schema';
import {BUTTON_RUSH_V2_STARTED_AT} from '@/lib/game/version';

export const runtime='nodejs';

export async function GET(_:Request,{params}:{params:Promise<{challengeId:string}>}){
  const id=(await params).challengeId;
  let score:'?'|number='?',name='A FAST STRANGER';
  if(hasDb()){
    const[r]=await getDb()
      .select({score:sessions.score,name:players.displayName})
      .from(challenges)
      .innerJoin(sessions,eq(sessions.id,challenges.sessionId))
      .innerJoin(players,eq(players.id,challenges.creatorId))
      .where(and(eq(challenges.id,id),gte(sessions.startedAt,BUTTON_RUSH_V2_STARTED_AT)))
      .limit(1);
    if(r){score=r.score??'?';name=r.name}
  }
  return new ImageResponse(
    <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between',background:'#0b0b0a',color:'#f3efe4',padding:'60px',fontFamily:'Arial',border:'18px solid #c9ff18'}}>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:38,fontWeight:900}}><span>ONEMINUTE.LOL</span><span style={{color:'#c9ff18'}}>BUTTON RUSH V2</span></div>
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between'}}>
        <div><div style={{fontSize:30,color:'#aaa69c'}}>{name} HIT</div><div style={{fontSize:260,lineHeight:.85,fontWeight:900,color:'#c9ff18'}}>{score}</div></div>
        <div style={{fontSize:55,fontWeight:900,textAlign:'right',display:'flex',flexDirection:'column'}}><span>1 → 2 → 4</span><span>CAN YOU</span><span>BEAT ME?</span></div>
      </div>
      <div style={{fontSize:25}}>oneminute.lol/c/{id}</div>
    </div>,
    {width:1200,height:630},
  );
}
