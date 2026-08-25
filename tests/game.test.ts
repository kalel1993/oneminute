import {describe,expect,it} from 'vitest';
import {activeTargetCount,outcome,percentile,stats,targetAt,targetRadiusAt,targetsAt} from '@/lib/game/engine';
import {validateTrace} from '@/lib/game/validation';

describe('Button Rush V2 targets',()=>{
  it('switches from one to two to four targets at the intended times',()=>{
    expect(activeTargetCount(0)).toBe(1);
    expect(activeTargetCount(29999)).toBe(1);
    expect(activeTargetCount(30000)).toBe(2);
    expect(activeTargetCount(39999)).toBe(2);
    expect(activeTargetCount(40000)).toBe(4);
    expect(activeTargetCount(59999)).toBe(4);
  });
  it('repeats deterministically and keeps active targets in safe cells',()=>{
    expect(targetAt(42,0,3,12000)).toEqual(targetAt(42,0,3,12000));
    for(const elapsed of [0,30000,40000,50000,59900]){
      const targets=targetsAt(4,[2,3,4,5],elapsed);
      expect(targets).toHaveLength(activeTargetCount(elapsed));
      for(const t of targets){
        expect(t.x).toBeGreaterThanOrEqual(8);
        expect(t.x).toBeLessThanOrEqual(92);
        expect(t.y).toBeGreaterThanOrEqual(12);
        expect(t.y).toBeLessThanOrEqual(92);
      }
    }
  });
  it('shrinks continuously as the clock runs down',()=>{
    expect(targetRadiusAt(30000)).toBeLessThan(targetRadiusAt(10000));
    expect(targetRadiusAt(40000)).toBeLessThan(targetRadiusAt(30000));
    expect(targetRadiusAt(55000)).toBeLessThan(targetRadiusAt(40000));
  });
});

describe('statistics',()=>{
  it('computes score, misses, streak, reaction and accuracy',()=>expect(stats([{type:'hit',t:200,x:1,y:1,targetId:0},{type:'hit',t:500,x:1,y:1,targetId:0},{type:'miss',t:700,x:1,y:1}])).toEqual({score:2,misses:1,streak:2,averageReaction:250,accuracy:67}));
  it('ranks percentile and challenge outcomes',()=>{expect(percentile(20,[10,20,30,40])).toBe(50);expect(percentile(4,[])).toBeNull();expect(outcome(5,4)).toBe('win');expect(outcome(4,5)).toBe('loss');expect(outcome(5,5)).toBe('tie')});
});

describe('anti-cheat validation',()=>{
  it('accepts plausible deterministic hits on independently respawning targets',()=>{
    const a=targetAt(8,0,0,200);
    const b=targetAt(8,0,1,500);
    expect(validateTrace(8,[
      {type:'hit',t:200,x:a.x+.3,y:a.y+.2,targetId:0},
      {type:'hit',t:500,x:b.x-.2,y:b.y+.25,targetId:0},
    ],60000).valid).toBe(true);
  });
  it('accepts valid hits on the two-target and four-target stages',()=>{
    const two=targetAt(9,1,0,31000);
    const four=targetAt(9,3,0,41000);
    const result=validateTrace(9,[
      {type:'hit',t:31000,x:two.x,y:two.y,targetId:1},
      {type:'hit',t:41000,x:four.x,y:four.y,targetId:3},
    ],60000);
    expect(result.valid).toBe(true);
  });
  it('allows the wider finger hit area on touch without widening mouse validation',()=>{
    const target=targetAt(11,2,0,52000);
    const edgeHit={type:'hit' as const,t:52000,x:target.x+4.7,y:target.y,targetId:2};
    expect(validateTrace(11,[edgeHit],60000,'touch').valid).toBe(true);
    expect(validateTrace(11,[edgeHit],60000,'mouse').reasons).toContain('hit outside target');
  });
  it('rejects inactive target ids, short sessions, nonmonotonic traces and impossible speed',()=>{
    const a=targetAt(8,0,0,200);
    const r=validateTrace(8,[
      {type:'hit',t:200,x:a.x,y:a.y,targetId:1},
      {type:'hit',t:210,x:0,y:0,targetId:0},
      {type:'miss',t:100,x:101,y:0},
    ],1000);
    expect(r.valid).toBe(false);
    expect(r.reasons).toContain('invalid duration');
    expect(r.reasons).toContain('invalid target id');
    expect(r.reasons).toContain('implausible hit rate');
    expect(r.reasons).toContain('non-monotonic timing');
  });
});

describe('machine-generated traces',()=>{
  it('rejects perfectly repeated hit timing',()=>{
    const events=Array.from({length:25},(_,i)=>{
      const t=150+i*100;
      const target=targetAt(12,0,i,t);
      return{type:'hit' as const,t,x:target.x,y:target.y,targetId:0};
    });
    const result=validateTrace(12,events,60000);
    expect(result.valid).toBe(false);expect(result.reasons).toContain('machine-like timing');
  });
  it('rejects events timestamped beyond the real session',()=>{
    const target=targetAt(3,0,0,60000);
    const result=validateTrace(3,[{type:'hit',t:60000,x:target.x,y:target.y,targetId:0}],57000);
    expect(result.reasons).toContain('timing exceeds elapsed duration');
  });
});
