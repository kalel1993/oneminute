'use client';
import {useEffect} from 'react';

export function PresenceTracker(){
  useEffect(()=>{
    let stopped=false;
    const ping=()=>{
      if(stopped||document.visibilityState!=='visible')return;
      void fetch('/api/presence',{method:'POST',keepalive:true,cache:'no-store'}).catch(()=>{});
    };
    ping();
    const interval=window.setInterval(ping,30000);
    const onVisible=()=>{if(document.visibilityState==='visible')ping()};
    document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('pageshow',ping);
    return()=>{
      stopped=true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange',onVisible);
      window.removeEventListener('pageshow',ping);
    };
  },[]);
  return null;
}
