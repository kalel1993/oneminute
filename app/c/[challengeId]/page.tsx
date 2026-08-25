import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {and,eq,gte} from 'drizzle-orm';
import {getDb,hasDb} from '@/lib/db';
import {challenges,players,sessions} from '@/lib/db/schema';
import {BUTTON_RUSH_V2_STARTED_AT} from '@/lib/game/version';

async function getChallenge(id:string){
  if(!hasDb())return null;
  const [row]=await getDb()
    .select({name:players.displayName,score:sessions.score,valid:sessions.valid})
    .from(challenges)
    .innerJoin(players,eq(players.id,challenges.creatorId))
    .innerJoin(sessions,eq(sessions.id,challenges.sessionId))
    .where(and(eq(challenges.id,id),gte(sessions.startedAt,BUTTON_RUSH_V2_STARTED_AT)))
    .limit(1);
  return row?.valid?row:null;
}

export async function generateMetadata({params}:{params:Promise<{challengeId:string}>}):Promise<Metadata>{
  const id=(await params).challengeId;
  const c=await getChallenge(id);
  return{
    title:c?`${c.name} scored ${c.score}. Beat it.`:'Challenge',
    description:'You have 60 seconds. One target becomes two, then four. Can you beat this verified Button Rush V2 score?',
    alternates:{canonical:`/c/${id}`},
    openGraph:{images:[`/c/${id}/opengraph-image`]},
  };
}

export default async function Page({params}:{params:Promise<{challengeId:string}>}){
  const id=(await params).challengeId;
  if(!hasDb())return <main className="result"><p className="kicker">CHALLENGE UNAVAILABLE</p><h2>RANKINGS<br/><span>OFFLINE.</span></h2><p className="notice">This deployment needs DATABASE_URL before verified challenges can load.</p><Link className="action" href="/play">PLAY LOCALLY</Link></main>;
  const c=await getChallenge(id);
  if(!c)notFound();
  return <main className="result">
    <p className="kicker">BUTTON RUSH V2 · CHALLENGE FROM {c.name.toUpperCase()}</p>
    <h2>BEAT<br/><span>{c.score}</span></h2>
    <p className="lede">60 seconds. One target becomes two at 30 seconds, then four at 20. They keep shrinking. Good luck 😈</p>
    <Link className="action" href={`/play?challenge=${encodeURIComponent(id)}`}>ACCEPT CHALLENGE →</Link>
    <Link className="fine" style={{marginTop:20}} href="/leaderboard">Check the V2 leaderboard</Link>
  </main>;
}
