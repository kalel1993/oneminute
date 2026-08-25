import { GameEvent, stats, targetAt } from './engine';

export function validateTrace(seed: number, events: GameEvent[], elapsed: number) {
  const reasons: string[] = [];
  if (elapsed < 59500 || elapsed > 75000) reasons.push('invalid duration');
  if (events.length > 500) reasons.push('event limit');

  let prior = -1;
  let hits = 0;
  let lastHit = -1000;
  let spawnedAt = 0;
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
      const target = targetAt(seed, hits, spawnedAt);
      const distance = Math.hypot(event.x - target.x, event.y - target.y);
      const allowedDistance = Math.max(3.8, target.r + 1.4);
      if (distance > allowedDistance) reasons.push('hit outside target');
      if (event.t < 75 || event.t - lastHit < 45) reasons.push('implausible hit rate');
      lastHit = event.t;
      spawnedAt = event.t;
      hitTimes.push(event.t);
      hitOffsets.push(distance);
      hits += 1;
    }
  }

  if (hits > 300) reasons.push('implausible score');
  if (hitTimes.length >= 25) {
    const intervals = hitTimes.slice(1).map((time, index) => time - hitTimes[index]);
    const frequencies = new Map<number, number>();
    for (const interval of intervals) frequencies.set(interval, (frequencies.get(interval) ?? 0) + 1);
    const repeated = Math.max(...frequencies.values());
    const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const deviation = Math.sqrt(
      intervals.reduce((sum, interval) => sum + (interval - mean) ** 2, 0) / intervals.length,
    );
    if (repeated / intervals.length >= 0.8 || deviation < 1.5) reasons.push('machine-like timing');

    const nearPerfect = hitOffsets.filter(offset => offset < 0.08).length;
    if (nearPerfect / hitOffsets.length >= 0.9) reasons.push('machine-like targeting');
  }

  return { valid: reasons.length === 0, reasons: [...new Set(reasons)], ...stats(events) };
}
