export type Mode='touch'|'mouse';
export type Target={x:number;y:number;r:number};
export type GameEvent={type:'hit'|'miss';t:number;x:number;y:number};
function mulberry32(a:number){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
export function targetAt(seed:number,index:number):Target{const random=mulberry32(seed+index*7919);const progress=Math.min(index/120,1);const r=44-18*progress;return{x:10+80*random(),y:18+74*random(),r}}
export function stats(events:GameEvent[]){const hits=events.filter(e=>e.type==='hit');let streak=0,maxStreak=0,last=0,total=0;for(const e of events){if(e.type==='hit'){streak++;maxStreak=Math.max(maxStreak,streak);total+=e.t-last;last=e.t}else streak=0}return{score:hits.length,misses:events.length-hits.length,streak:maxStreak,averageReaction:hits.length?Math.round(total/hits.length):0,accuracy:events.length?Math.round(hits.length/events.length*100):0}}
export function outcome(a:number,b:number){return a===b?'tie':a>b?'win':'loss'}
export function percentile(score:number,scores:number[]){if(!scores.length)return null;return Math.round(scores.filter(s=>s<=score).length/scores.length*100)}
