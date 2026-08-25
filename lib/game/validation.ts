import { activeTargetCount, GameEvent, Mode, stats, targetAt } from './engine';

const STAGE_BOUNDARIES=[30000,40000];
const BOUNDARY_GRACE_MS=250;

export function validateTrace(seed: number, events: GameEvent[], elapsed: number, mode: Mode = 'mouse') {
  const reasons: string[] = [];
  if (elapsed < 59500 || elapsed > 75000) reasons.push('invalid duration');
  if (events.length > 500) reasons.push('event limit');

  let prior = -1;
  let hits = 0;
  const generations = [0, 0, 0, 0];
  const lastHitByTarget = [-1000, -1000, -1000, -1000];
  const hitTimes: number[] = [];
  const hitOffsets: number[] = [];

  for (const event of events) {
    if (event.t < prior || event.t < 0 || event.t > 60500) reasons.push('non-monotonic timing');
    if (event.t > elapsed + 1500) reasons.push('timing exceeds elapsed duration');
    prior = event.t;

    if (event.x < 0 || event.x > 100 || event.y < 0 || event.y > 100) {
      reasons.push('invalid coordinates');
    }

    if (event.type === 'hit') {
      const targetId = event.targetId;
      const active = activeTargetCount(event.t);
      const candidateTimes=[event.t];
      for(const boundary of STAGE_BOUNDARIES){
        if(event.t>=boundary&&event.t<=boundary+BOUNDARY_GRACE_MS)candidateTimes.push(boundary-1);
      }

      const candidates=Number.isInteger(targetId)&&targetId!=null
        ?candidateTimes
          .filter(time=>targetId>=0&&targetId<activeTargetCount(time))
          .map(time=>targetAt(seed,targetId,generations[targetId],time))
        :[];

      if (!Number.isInteger(targetId) || targetId == null || targetId < 0 || targetId >= active || !candidates.length) {
        reasons.push('invalid target id');
      } else {
        let distance=Number.POSITIVE_INFINITY;
        let radius=0;
        for(const target of candidates){
          const candidateDistance=Math.hypot(event.x-target.x,event.y-target.y);
          if(candidateDistance<distance){distance=candidateDistance;radius=target.r}
        }

        // The phone UI deliberately uses a ~40px finger hit area around the
        // visible target. Coordinates are submitted as arena percentages, so
        // a slightly wider radial allowance is required on tall mobile arenas
        // to represent that same physical hit box without false negatives.
        const allowedDistance = mode === 'touch'
          ? Math.max(7.6, radius + 1.8)
          : Math.max(2.8, radius + 1.0);
        if (distance > allowedDistance) reasons.push('hit outside target');

        // Quad mode supports different fingers hitting different targets at
        // nearly the same time. Only an impossibly fast repeat on the SAME
        // target is structurally suspicious.
        if(event.t-lastHitByTarget[targetId]<20)reasons.push('implausible hit rate');
        lastHitByTarget[targetId]=event.t;

        generations[targetId] += 1;
        hitOffsets.push(distance);
      }
      if (event.t < 20) reasons.push('implausible hit rate');
      hitTimes.push(event.t);
      hits += 1;
    }
  }

  if (hits > 320) reasons.push('implausible score');

  if (hitTimes.length >= 25) {
    const intervals = hitTimes.slice(1).map((time, index) => time - hitTimes[index]);
    const frequencies = new Map<number, number>();
    for (const interval of intervals) frequencies.set(interval, (frequencies.get(interval) ?? 0) + 1);
    const repeated = Math.max(...frequencies.values());
    const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const deviation = Math.sqrt(
      intervals.reduce((sum, interval) => sum + (interval - mean) ** 2, 0) / intervals.length,
    );

    // Keep only extremely strong automation signals. Fast multi-touch itself
    // is valid gameplay and must never be enough to reject a run.
    if (repeated / intervals.length >= 0.95 && deviation < 0.5) reasons.push('machine-like timing');

    const nearPerfect = hitOffsets.filter(offset => offset < 0.03).length;
    if (hitOffsets.length >= 25 && nearPerfect / hitOffsets.length >= 0.98) reasons.push('machine-like targeting');
  }

  return { valid: reasons.length === 0, reasons: [...new Set(reasons)], ...stats(events) };
}
