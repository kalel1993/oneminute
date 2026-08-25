'use client';
import {useCallback,useEffect,useState} from 'react';

type Row={name:string;score:number};

export function Leaderboard(){
  const[mode,setMode]=useState<'touch'|'mouse'>('touch');
  const[period,setPeriod]=useState<'today'|'all'>('today');
  const[rows,setRows]=useState<Row[]|null>(null);
  const[configured,setConfigured]=useState(true);
  const[updated,setUpdated]=useState('');

  const load=useCallback(()=>{
    fetch(`/api/public?mode=${mode}&period=${period}`,{cache:'no-store'})
      .then(r=>r.json())
      .then(d=>{setRows(d.leaders);setConfigured(d.configured);setUpdated(d.updatedAt??new Date().toISOString())})
      .catch(()=>setRows([]));
  },[mode,period]);

  useEffect(()=>{
    load();
    const id=window.setInterval(load,10000);
    return()=>window.clearInterval(id);
  },[load]);

  return <>
    <div className="tabs" aria-label="Leaderboard filters">
      <button className={period==='today'?'active':''} onClick={()=>setPeriod('today')}>LIVE / TODAY</button>
      <button className={period==='all'?'active':''} onClick={()=>setPeriod('all')}>ALL TIME</button>
      <button className={mode==='touch'?'active':''} onClick={()=>setMode('touch')}>TOUCH</button>
      <button className={mode==='mouse'?'active':''} onClick={()=>setMode('mouse')}>MOUSE</button>
    </div>
    <p className="fine liveStamp">● LIVE · best verified score per player{updated?` · refreshed ${new Date(updated).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:''}</p>
    <div className="board" aria-live="polite">
      {rows?.length?rows.map((r,i)=><div className="row" key={`${r.name}-${i}`}><b>#{i+1}</b><span>{r.name}</span><b>{r.score}</b></div>):<div className="emptyBoard"><h2>{rows===null?'LOADING THE PACE…':'THE BOARD IS WIDE OPEN.'}</h2>{rows!==null&&<p>{configured?'No verified runs in this lane yet. Be the first name up.':'Rankings are offline until DATABASE_URL is provisioned. Local play remains available and unranked.'}</p>}</div>}
    </div>
  </>;
}
