export type Mode='touch'|'mouse';
export type Target={x:number;y:number;r:number};
export type GameEvent={type:'hit'|'miss';t:number;x:number;y:number};

function mulberry32(a:number){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function rawPosition(seed:number,index:number){const random=mulberry32(seed+index*7919);return{x:8+84*random(),y:12+80*random()}}
function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value))}

export function targetAt(seed:number,index:number,elapsedMs=0):Target{
  const timeProgress=clamp(elapsedMs/60000,0,1);
  const hitProgress=clamp(index/150,0,1);
  const progress=Math.max(timeProgress,hitProgress);
  const r=6.6-3.2*progress;
  let current=rawPosition(seed,index);

  if(index>0){
    const previous=rawPosition(seed,index-1);
    const minimumJump=16+24*progress;
    if(Math.hypot(current.x-previous.x,current.y-previous.y)<minimumJump){
      current={x:100-current.x,y:100-current.y};
    }
  }

  return{
    x:clamp(current.x,8+r*.45,92-r*.45),
    y:clamp(current.y,12+r*.45,92-r*.45),
    r,
  };
}

export function stats(events:GameEvent[]){
  const hits=events.filter(e=>e.type==='hit');
  let streak=0,maxStreak=0,last=0,total=0;
  for(const e of events){
    if(e.type==='hit'){
      streak++;
      maxStreak=Math.max(maxStreak,streak);
      total+=e.t-last;
      last=e.t;
    }else streak=0;
  }
  return{
    score:hits.length,
    misses:events.length-hits.length,
    streak:maxStreak,
    averageReaction:hits.length?Math.round(total/hits.length):0,
    accuracy:events.length?Math.round(hits.length/events.length*100):0,
  };
}

export function outcome(a:number,b:number){return a===b?'tie':a>b?'win':'loss'}
export function percentile(score:number,scores:number[]){if(!scores.length)return null;return Math.round(scores.filter(s=>s<=score).length/scores.length*100)}
