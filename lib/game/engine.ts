export type Mode='touch'|'mouse';
export type Target={id:number;x:number;y:number;r:number};
export type GameEvent={type:'hit'|'miss';t:number;x:number;y:number;targetId?:number};

const GAME_DURATION=60000;

function mulberry32(a:number){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value))}

export function activeTargetCount(elapsedMs:number){
  if(elapsedMs<30000)return 1;
  if(elapsedMs<40000)return 2;
  return 4;
}

export function targetRadiusAt(elapsedMs:number){
  const progress=clamp(elapsedMs/GAME_DURATION,0,1);
  let penalty=0;
  if(elapsedMs>=30000)penalty+=.25;
  if(elapsedMs>=40000)penalty+=.30;
  if(elapsedMs>=50000)penalty+=.25;
  return clamp(6.4-4.1*progress-penalty,2.15,6.4);
}

type Cell={x1:number;x2:number;y1:number;y2:number};
function cellFor(targetId:number,elapsedMs:number):Cell{
  const count=activeTargetCount(elapsedMs);
  if(count===1)return{x1:8,x2:92,y1:12,y2:92};
  if(count===2){
    return targetId===0
      ?{x1:8,x2:47,y1:12,y2:92}
      :{x1:53,x2:92,y1:12,y2:92};
  }
  const left=targetId===0||targetId===2;
  const top=targetId===0||targetId===1;
  return{
    x1:left?8:53,
    x2:left?47:92,
    y1:top?12:56,
    y2:top?48:92,
  };
}

function rawPosition(seed:number,targetId:number,generation:number,elapsedMs:number){
  const stage=activeTargetCount(elapsedMs);
  const cell=cellFor(targetId,elapsedMs);
  const random=mulberry32(seed+targetId*104729+generation*7919+stage*15485863);
  return{
    x:cell.x1+(cell.x2-cell.x1)*random(),
    y:cell.y1+(cell.y2-cell.y1)*random(),
  };
}

export function targetAt(seed:number,targetId:number,generation:number,elapsedMs=0):Target{
  const count=activeTargetCount(elapsedMs);
  if(targetId<0||targetId>=count)throw new Error('inactive target');
  const r=targetRadiusAt(elapsedMs);
  const cell=cellFor(targetId,elapsedMs);
  const progress=clamp(elapsedMs/GAME_DURATION,0,1);
  let current=rawPosition(seed,targetId,generation,elapsedMs);

  if(generation>0){
    const previous=rawPosition(seed,targetId,generation-1,elapsedMs);
    const minimumJump=count===1?18+18*progress:count===2?12+12*progress:8+8*progress;
    if(Math.hypot(current.x-previous.x,current.y-previous.y)<minimumJump){
      current={x:cell.x1+cell.x2-current.x,y:cell.y1+cell.y2-current.y};
    }
  }

  return{
    id:targetId,
    x:clamp(current.x,cell.x1+r,cell.x2-r),
    y:clamp(current.y,cell.y1+r,cell.y2-r),
    r,
  };
}

export function targetsAt(seed:number,generations:number[],elapsedMs:number){
  return Array.from({length:activeTargetCount(elapsedMs)},(_,targetId)=>
    targetAt(seed,targetId,generations[targetId]??0,elapsedMs),
  );
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
