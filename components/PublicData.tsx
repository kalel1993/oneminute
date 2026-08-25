'use client';
import {useCallback,useEffect,useState} from 'react';

type Activity={name:string;score:number;at:string;message?:string};
type Data={configured:boolean;leaders:{name:string;score:number}[];activity:Activity[];updatedAt?:string};

export function PublicData(){
  const[d,setD]=useState<Data|null>(null);
  const load=useCallback(()=>{
    fetch('/api/public?mode=touch&period=all',{cache:'no-store'})
      .then(r=>r.json())
      .then(setD)
      .catch(()=>setD({configured:false,leaders:[],activity:[]}));
  },[]);

  useEffect(()=>{
    load();
    const id=window.setInterval(load,10000);
    return()=>window.clearInterval(id);
  },[load]);

  return <section className="proof" aria-labelledby="activity-title">
    <div>
      <p className="eyebrow">THE PACE · TOUCH</p>
      {d?.leaders?.length?<><strong className="record">{d.leaders[0].score}</strong><span>verified hits · world record</span></>:<><strong className="record">—</strong><span>{d?.configured?'No verified runs yet. Set the first pace.':'Local arcade mode · rankings come online with the database.'}</span></>}
    </div>
    <div>
      <h2 id="activity-title">● LIVE ACTIVITY</h2>
      {d?.activity?.length?<ul className="feed">{d.activity.map((a,i)=><li key={`${a.at}-${i}`}><b>{a.message??a.name}</b><span>{new Date(a.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></li>)}</ul>:<p className="empty">It’s quiet in here. The first verified run will appear live—maybe yours.</p>}
    </div>
  </section>;
}
