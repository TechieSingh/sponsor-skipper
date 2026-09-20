import { finite, isRecord, type HeatPoint } from '../lib/types';
import { LIMITS } from '../detection/rules';

/** Bounded optional traversal of already-present player/page metadata; no network. */
export function parseHeatmap(root: unknown): HeatPoint[] {
  const stack: unknown[] = [root];
  const seen = new WeakSet<object>();
  const points: HeatPoint[] = [];
  let visited = 0;
  while (stack.length && visited++ < 12000 && points.length < 1000) {
    const node = stack.pop();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    if (isRecord(node)) {
      const rawTime = node.timeRangeStartMillis ?? node.startMillis;
      const time = typeof rawTime === 'string' && /^\d+$/.test(rawTime) ? Number(rawTime) : rawTime;
      const intensity = node.heatMarkerIntensityScoreNormalized ?? node.intensityScoreNormalized;
      if (finite(time) && time >= 0 && finite(intensity) && intensity >= 0 && intensity <= 1) points.push({ time: time / 1000, intensity });
      for (const value of Object.values(node).slice(0, 300)) if (value && typeof value === 'object') stack.push(value);
    } else if (Array.isArray(node)) stack.push(...node.slice(0, 1000));
  }
  return [...new Map(points.map(p => [p.time, p])).values()].sort((a, b) => a.time - b.time);
}
export function supportsBoundary(points: HeatPoint[], time: number): boolean {
  // Replay intensity is not a measured skip rate. Only a small supporting bonus.
  return points.some((p, i) => i > 0 && Math.abs(p.time - time) <= LIMITS.heatRadius && p.intensity - points[i - 1]!.intensity >= 0.25);
}
