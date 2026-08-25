'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {track} from '@vercel/analytics';
import {activeTargetCount,GameEvent,stats,targetsAt} from '@/lib/game/engine';

type Phase='ready'|'countdown'|'playing'|'result';
type Session={sessionId:string;seed:number;duration:number;ranked:boolean;displayName:string;usage?:{freeRemaining:number;creditUsed:boolean;credits:number}};
type RankedResult={score:number;rank?:number;percentile?:number;worldRecord?:boolean;nextTarget?:{score:number;rank:number;hitsNeeded:number}|null};
type Submit={ranked:boolean;reason?:string;result?:RankedResult|null};
type NavigatorWithAudioSession=Navigator&{audioSession?:{type:string}};

const IOS_TONE='data:audio/wav;base64,UklGRgQCAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YeABAAAAAK0AUQLyA20E9gKD/+n6rPaB9Kr1cvrnAQwKVxCEElcPIgfY+5PwwegR55TsRPgpB0UUohtFG1kTIwZa9xnrw+QJ5n/uuvsDCmIVuBqYGKwPfwLD9Efq7OXW6CTyMv9VDOsVVRmwFRMMOP+38gbqhefS66z1RQIbDucVixelEqMIWvw38U3qeunm7v/46gRVD2EVbxWOD3AF8PlC8A7rt+v88Q78FwcGEGkUFxOADIoCAvjS7znsJu789Mj+xgg1EA4TlxCRCQAAkfbh77/tsfDV9x8B9wnsD2MRBQ7UBt39oPVi8IrvQ/Ny+gwDqwo3D3sPeAtaBCj8KfVI8YnxyPXG/IgE5gokDmwNAgkwAub6J/WC8qXzKvjC/pAFsgrGDEkLtwZjABj6j/UB9Mr1WfpdACQGGQotCycJpwT8/rz5Vvav9eT3RvyQAUkGKAltCRkH4gL//cz5bPd79+D54f1XAgYG7webBzMFcgFt/UD6wvhP+az7Iv+zAmQFgQbKBYUDYgBH/Qz7RvoY+zj9AAClAnAE7gQNBB4CuP+H/ST84/vE/Hf+dwA0AjkDSgN3AgkBdP8m/nf9iP1B/l//hwBqAc4BqgEYAVEAl/8a//T+IP9+/+b/MgBQAEMAHwA=';
const IOS_AUDIO_POOL_SIZE=16;

function isIOSDevice(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
}

export function Game({challengeId}:{challengeId?:string}){
  const[phase,setPhase]=useState<Phase>('ready');
  const[count,setCount]=useState('3');
  const[session,setSession]=useState<Session>();
  const[generations,setGenerations]=useState<[number,number,number,number]>([0,0,0,0]);
  const[events,setEvents]=useState<GameEvent[]>([]);
  const[remaining,setRemaining]=useState(60000);
  const[muted,setMuted]=useState(false);
  const[starting,setStarting]=useState(false);
  const[submit,setSubmit]=useState<Submit>();
  const[message,setMessage]=useState('');
  const[rival,setRival]=useState<{name:string;score:number}>();
  const[challengeUrl,setChallengeUrl]=useState('');
  const[arenaSize,setArenaSize]=useState({w:0,h:0});
  const[stageAnnouncement,setStageAnnouncement]=useState('');
  const startRef=useRef(0);
  const eventsRef=useRef<GameEvent[]>([]);
  const generationsRef=useRef<[number,number,number,number]>([0,0,0,0]);
  const finishing=useRef(false);
  const lastUrgentSecond=useRef(11);
  const stageRef=useRef(1);
  const announcementTimerRef=useRef<number>();
  const arenaRef=useRef<HTMLDivElement>(null);
  const audioRef=useRef<AudioContext|null>(null);
  const mediaAudioPoolRef=useRef<HTMLAudioElement[]>([]);
  const mediaAudioIndexRef=useRef(0);
  const score=events.filter(e=>e.type==='hit').length;
  const elapsed=session?Math.max(0,session.duration-remaining):0;
  const activeCount=activeTargetCount(elapsed);
  const urgentSecond=remaining<=10000&&remaining>0?Math.ceil(remaining/1000):null;
  const renderedTargets=session&&phase==='playing'?targetsAt(session.seed,generations,elapsed):[];

  const configurePlaybackSession=useCallback(()=>{
    try{
      const audioSession=(navigator as NavigatorWithAudioSession).audioSession;
      if(audioSession)audioSession.type='playback';
    }catch{}
  },[]);

  const getMediaAudioPool=useCallback(()=>{
    if(mediaAudioPoolRef.current.length)return mediaAudioPoolRef.current;
    mediaAudioPoolRef.current=Array.from({length:IOS_AUDIO_POOL_SIZE},()=>{
      const audio=new Audio(IOS_TONE);
      audio.preload='auto';
      audio.volume=.18;
      return audio;
    });
    return mediaAudioPoolRef.current;
  },[]);

  const getAudioContext=useCallback(()=>{
    const C=window.AudioContext||(window as typeof window&{webkitAudioContext:typeof AudioContext}).webkitAudioContext;
    const c=audioRef.current??new C();
    audioRef.current=c;
    return c;
  },[]);

  const emitTone=useCallback((c:AudioContext,f:number,d=.05)=>{
    if(c.state==='closed')return;
    const o=c.createOscillator(),g=c.createGain();
    o.frequency.value=f;
    g.gain.setValueAtTime(.035,c.currentTime);
    o.connect(g);g.connect(c.destination);o.start();
    g.gain.exponentialRampToValueAtTime(.001,c.currentTime+d);o.stop(c.currentTime+d);
  },[]);

  const emitWebAudio=useCallback((f:number,d=.05)=>{
    try{
      const c=getAudioContext();
      const emit=()=>emitTone(c,f,d);
      if(c.state==='suspended')void c.resume().then(emit).catch(()=>{});
      else emit();
    }catch{}
  },[getAudioContext,emitTone]);

  const unlockAudio=useCallback(async()=>{
    try{
      configurePlaybackSession();
      const c=getAudioContext();
      const resumePromise=c.state==='suspended'?c.resume():Promise.resolve();
      const o=c.createOscillator(),g=c.createGain();
      o.frequency.value=1;
      g.gain.setValueAtTime(.00001,c.currentTime);
      o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.02);

      if(isIOSDevice()){
        const pool=getMediaAudioPool();
        const plays=pool.map(audio=>{
          audio.volume=.001;
          audio.currentTime=0;
          try{return audio.play().catch(()=>{})}catch{return Promise.resolve()}
        });
        await Promise.allSettled([resumePromise,...plays]);
        for(const audio of pool){
          audio.pause();
          try{audio.currentTime=0}catch{}
          audio.volume=.18;
        }
        mediaAudioIndexRef.current=0;
        return;
      }
      await resumePromise;
    }catch{}
  },[configurePlaybackSession,getAudioContext,getMediaAudioPool]);

  const playSound=useCallback((f:number,d=.05)=>{
    if(muted)return;
    try{
      configurePlaybackSession();
      if(isIOSDevice()){
        const pool=getMediaAudioPool();
        const audio=pool[mediaAudioIndexRef.current%pool.length];
        mediaAudioIndexRef.current=(mediaAudioIndexRef.current+1)%pool.length;
        audio.playbackRate=Math.max(.65,Math.min(1.8,f/680));
        audio.volume=.18;
        try{audio.currentTime=0}catch{}
        try{
          const started=audio.play();
          if(started)void started.catch(()=>emitWebAudio(f,d));
        }catch{emitWebAudio(f,d)}
        return;
      }
      emitWebAudio(f,d);
    }catch{}
  },[muted,configurePlaybackSession,getMediaAudioPool,emitWebAudio]);

  const finish=useCallback(async()=>{
    if(finishing.current||!session)return;
    finishing.current=true;
    setPhase('result');
    try{
      const response=await fetch('/api/session/submit',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:session.sessionId,events:eventsRef.current})});
      const data=await response.json().catch(()=>({error:'Score verification failed'}));
      if(!response.ok)throw new Error(data.error||'Score verification failed');
      setSubmit(data);
      if(challengeId){
        fetch(`/api/challenges?id=${encodeURIComponent(challengeId)}`,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(value=>value&&setRival(value));
      }
      track('play_completed',{score:stats(eventsRef.current).score,ranked:Boolean(data.ranked)});
    }catch{
      setSubmit({ranked:false,reason:'Score verification failed. Your local result is safe—please play again.'});
    }
  },[session,challengeId]);

  useEffect(()=>{
    if(phase!=='playing')return;
    const id=window.setInterval(()=>{
      const left=Math.max(0,session!.duration-(performance.now()-startRef.current));
      setRemaining(left);
      if(left<=0){window.clearInterval(id);void finish()}
    },32);
    return()=>window.clearInterval(id);
  },[phase,finish,session]);

  useEffect(()=>{
    if(phase!=='playing'||activeCount<=stageRef.current)return;
    stageRef.current=activeCount;
    const label=activeCount===2?'DOUBLE TROUBLE':'QUAD MODE 😈';
    setStageAnnouncement(label);
    playSound(activeCount===2?980:1180,.18);
    navigator.vibrate?.(activeCount===2?[70,40,70]:[70,30,70,30,100]);
    if(announcementTimerRef.current)window.clearTimeout(announcementTimerRef.current);
    announcementTimerRef.current=window.setTimeout(()=>setStageAnnouncement(''),950);
  },[phase,activeCount,playSound]);

  useEffect(()=>()=>{
    if(announcementTimerRef.current)window.clearTimeout(announcementTimerRef.current);
  },[]);

  useEffect(()=>{
    if(phase!=='playing'||urgentSecond===null||urgentSecond===lastUrgentSecond.current)return;
    lastUrgentSecond.current=urgentSecond;
    playSound(520+(10-urgentSecond)*55,.12);
    navigator.vibrate?.(urgentSecond<=3?[80,35,80]:35);
  },[phase,urgentSecond,playSound]);

  useEffect(()=>{
    if(phase!=='playing'||!arenaRef.current)return;
    const arena=arenaRef.current;
    const update=()=>{const r=arena.getBoundingClientRect();setArenaSize({w:r.width,h:r.height})};
    update();
    const observer=new ResizeObserver(update);
    observer.observe(arena);
    return()=>observer.disconnect();
  },[phase]);

  useEffect(()=>{
    const resumeAudio=()=>{
      if(muted||document.visibilityState!=='visible')return;
      configurePlaybackSession();
      const c=audioRef.current;
      if(c?.state==='suspended')void c.resume().catch(()=>{});
    };
    document.addEventListener('visibilitychange',resumeAudio);
    window.addEventListener('pageshow',resumeAudio);
    return()=>{
      document.removeEventListener('visibilitychange',resumeAudio);
      window.removeEventListener('pageshow',resumeAudio);
    };
  },[muted,configurePlaybackSession]);

  async function begin(){
    if(starting)return;
    setStarting(true);
    if(!muted)await unlockAudio();
    finishing.current=false;
    lastUrgentSecond.current=11;
    stageRef.current=1;
    generationsRef.current=[0,0,0,0];
    eventsRef.current=[];
    setGenerations([0,0,0,0]);
    setEvents([]);setSubmit(undefined);setRival(undefined);setChallengeUrl('');setMessage('');setStageAnnouncement('');
    try{
      const mode:'touch'|'mouse'=matchMedia('(pointer: coarse)').matches?'touch':'mouse';
      const r=await fetch('/api/session/start',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({mode})});
      const data=await r.json().catch(()=>({error:'Could not start. Check your connection and try again.'}));
      if(!r.ok){setMessage(data.error||'Could not start. Check your connection and try again.');return}
      const s=data as Session;
      setSession(s);setPhase('countdown');
      track(challengeId?'challenge_accepted':'play_started',{mode});
      for(const value of ['3','2','1','GO']){
        setCount(value);playSound(value==='GO'?880:440,.1);
        await new Promise(res=>setTimeout(res,value==='GO'?500:750));
      }
      startRef.current=performance.now();
      setRemaining(s.duration);setPhase('playing');
    }finally{setStarting(false)}
  }

  async function toggleSound(){
    if(muted){
      setMuted(false);
      await unlockAudio();
    }else setMuted(true);
  }

  function hit(e:React.PointerEvent<HTMLButtonElement>,targetId:number){
    e.stopPropagation();
    if(phase!=='playing'||!session)return;
    const arena=e.currentTarget.parentElement!.getBoundingClientRect();
    const t=performance.now()-startRef.current;
    const ev:GameEvent={type:'hit',t,x:(e.clientX-arena.left)/arena.width*100,y:(e.clientY-arena.top)/arena.height*100,targetId};
    eventsRef.current=[...eventsRef.current,ev];setEvents(eventsRef.current);
    const next=[...generationsRef.current] as [number,number,number,number];
    next[targetId]+=1;
    generationsRef.current=next;
    setGenerations(next);
    playSound(600+score*4);navigator.vibrate?.(12);
  }

  function miss(e:React.PointerEvent<HTMLDivElement>){
    if(e.target!==e.currentTarget)return;
    const b=e.currentTarget.getBoundingClientRect();
    const ev:GameEvent={type:'miss',t:performance.now()-startRef.current,x:(e.clientX-b.left)/b.width*100,y:(e.clientY-b.top)/b.height*100};
    eventsRef.current=[...eventsRef.current,ev];setEvents(eventsRef.current);
  }

  async function ensureChallengeUrl(){
    if(challengeUrl)return challengeUrl;
    if(!session||!submit?.ranked)return location.origin;
    const r=await fetch('/api/challenges',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:session.sessionId,parentId:challengeId})});
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Could not create challenge.');
    const url=d.url||`${location.origin}/c/${d.id}`;
    setChallengeUrl(url);
    track('challenge_created');
    return url;
  }

  async function shareCurrent(kind:'challenge'|'score'){
    try{
      const url=await ensureChallengeUrl();
      const text=`${session?.displayName??'I'} hit ${score} in Button Rush V2 on OneMinute.lol. Can you beat it?`;
      track('share_clicked',{kind});
      if(navigator.share){
        await navigator.share({title:`Beat ${score} in 60 seconds`,text,url}).catch(()=>{});
      }else{
        await navigator.clipboard.writeText(`${text} ${url}`);
        setMessage('Challenge link copied. Send it to someone fast.');
      }
    }catch(error){setMessage(error instanceof Error?error.message:'Could not create challenge.')}
  }

  if(phase==='ready')return <main className="result">
    <p className="kicker">BUTTON RUSH V2 · {challengeId?'CHALLENGE RUN':'ONE MINUTE'}</p>
    <h2>READY<span>?</span></h2>
    <p className="lede">One target. Then two. Then four. They keep shrinking until the final second 😈</p>
    {message&&<p className="notice" role="alert">{message} {message.includes('Log in')&&<Link href="/sign-in">Log in →</Link>} {message.includes('credit')&&<Link href="/account">Get credits →</Link>}</p>}
    <button className="action" disabled={starting} onClick={()=>void begin()}>{starting?'STARTING…':'START 60 SECONDS →'}</button>
    <div className="playLinks"><span>30s left → 2 targets</span><span>20s left → 4 targets</span><span>3 free ranked plays daily</span></div>
    <Link href="/" className="fine" style={{marginTop:20}}>← Back home</Link>
  </main>;

  if(phase==='countdown')return <div className="countdown" aria-live="assertive">{count}</div>;

  if(phase==='playing'){
    const minArena=Math.min(arenaSize.w||700,arenaSize.h||700);
    return <main className={`gameShell${urgentSecond!==null?' finalTen':''}`}>
      <div className="hud">
        <div><label>SCORE</label><strong>{score}</strong></div>
        <div className="stageReadout"><label>MODE</label><strong>{activeCount}×</strong></div>
        <div className="timeReadout"><label>{urgentSecond!==null?'FINAL TEN':'TIME'}</label><strong>{(remaining/1000).toFixed(1)}</strong></div>
        <button onClick={()=>void toggleSound()} aria-label={muted?'Unmute sounds':'Mute sounds'}>{muted?'SOUND OFF':'SOUND ON'}</button>
      </div>
      {stageAnnouncement&&<div className="stageAnnouncement" aria-live="assertive">{stageAnnouncement}</div>}
      {urgentSecond!==null&&<div className="urgentCountdown" aria-live="assertive" aria-atomic="true"><span>{urgentSecond}</span><b>SECONDS</b></div>}
      <div ref={arenaRef} className="arena" onPointerDown={miss}>
        {renderedTargets.map(target=>{
          const targetPixels=Math.max(24,Math.min(96,minArena*target.r*.02));
          return <button
            key={target.id}
            aria-label={`Hit target ${target.id+1}`}
            className="target"
            onPointerDown={e=>hit(e,target.id)}
            style={{left:`${target.x}%`,top:`${target.y}%`,width:`${targetPixels}px`,height:`${targetPixels}px`}}
          >HIT</button>;
        })}
      </div>
    </main>;
  }

  const s=stats(events);
  const result=submit?.result;
  const challengeWon=Boolean(rival&&s.score>rival.score);
  let replayHook='Beat your own V2 score. One minute.';
  if(rival){
    if(s.score>rival.score)replayHook=`You beat ${rival.name} by ${s.score-rival.score}. Send it back.`;
    else if(s.score===rival.score)replayHook='Dead heat. One more hit wins it.';
    else replayHook=`You need ${rival.score-s.score+1} more hit${rival.score-s.score+1===1?'':'s'} to beat ${rival.name}.`;
  }else if(result?.rank===1){
    replayHook='You are V2 #1. Defend it.';
  }else if(result?.nextTarget){
    replayHook=`${result.nextTarget.hitsNeeded} more hit${result.nextTarget.hitsNeeded===1?'':'s'} to reach #${result.nextTarget.rank}.`;
  }

  return <main className="result">
    <p className="kicker">BUTTON RUSH V2 · {result?.worldRecord?'NEW WORLD RECORD':'TIME'} · {submit?.ranked?'VERIFIED RUN':'LOCAL / UNRANKED'}</p>
    <h2><span>{s.score}</span> HITS</h2>
    <p className="notice">{rival?`${s.score>rival.score?'YOU WIN':s.score===rival.score?'DEAD HEAT':'THEY WIN'} — ${rival.name} scored ${rival.score}.`:submit?.ranked?`Top ${Math.max(1,100-(result?.percentile||0))}% · rank #${result?.rank}. ${result?.worldRecord?'You genuinely set the V2 pace.':''}`:submit?.reason||'Checking your run…'}</p>
    <p className="replayHook">{replayHook}</p>
    {session?.usage&&<p className="fine">Playing as <b>{session.displayName}</b> · {session.usage.creditUsed?'1 credit used.':`${session.usage.freeRemaining} free play${session.usage.freeRemaining===1?'':'s'} left today.`} <Link className="accountCta" href="/account">KEEP MY SCORES →</Link></p>}
    <div className="resultGrid"><div><b>{s.accuracy}%</b><small>Accuracy</small></div><div><b>{s.averageReaction}ms</b><small>Avg reaction</small></div><div><b>{s.streak}</b><small>Best streak</small></div><div><b>{s.misses}</b><small>Misses</small></div></div>
    {message&&<p role="status">{message}</p>}
    <div className="actions">
      <button className="action" disabled={starting} onClick={()=>{track('replay_clicked');void begin()}}>{starting?'STARTING…':'PLAY AGAIN'}</button>
      <button className="action secondary" disabled={!submit?.ranked} onClick={()=>void shareCurrent('challenge')}>{challengeWon?'SEND IT BACK 😈':rival?'REMATCH THEM':'CHALLENGE A FRIEND'}</button>
      <button className="action secondary" onClick={()=>void shareCurrent('score')}>SHARE SCORE</button>
      <Link className="action secondary" href="/leaderboard">LEADERBOARD</Link>
      <Link className="action secondary accountAction" href="/account">MY SCORES</Link>
    </div>
  </main>;
}
