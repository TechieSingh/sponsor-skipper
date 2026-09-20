import type { CaptionSegment, DetectionMode, HeatPoint, SponsorSegment } from '../lib/types';
import { matchCaptions } from './matcher';
import { findEnd, findStart } from './boundaries';
import { scoreEvidence } from './scoring';
import { BONUS, LIMITS, THRESHOLDS } from './rules';
import { supportsBoundary } from '../youtube/heatmap';

export const DETECTOR_VERSION = 1;
export function detectSponsors(captions: CaptionSegment[], mode: DetectionMode = 'conservative', heatmap: HeatPoint[] = []): SponsorSegment[] {
  const rows = matchCaptions(captions.slice(0, LIMITS.maxCaptions));
  const threshold = THRESHOLDS[mode];
  const candidates: SponsorSegment[] = [];
  let coveredUntil = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.caption.start < coveredUntil || (!row.opening && !row.commercial.length)) continue;
    const cluster = [];
    for (let j = i; j < Math.min(rows.length, i + LIMITS.maxWindowCaptions) && rows[j]!.caption.start - row.caption.start <= LIMITS.clusterWindow; j++) cluster.push(rows[j]!);
    const initial = scoreEvidence(cluster);
    if (!row.opening && (initial.commercialKinds < 3 || initial.score < threshold.suggest)) continue;
    const start = Math.max(coveredUntil, findStart(rows, i));
    const { end, boundary, lastIndex } = findEnd(rows, i, start);
    const span = rows.slice(i, lastIndex + 1).filter(r => end === null || r.caption.start < end);
    const result = scoreEvidence(span);
    if (boundary === 'return') result.evidence.push({ rule: 'Content return', points: BONUS.return });
    if (end !== null && supportsBoundary(heatmap, end)) result.evidence.push({ rule: 'Heatmap support', points: BONUS.heat });
    const score = result.evidence.reduce((sum, item) => sum + item.points, 0);
    if (score < threshold.suggest) continue;
    const auto = end !== null && boundary === 'return' && end - start >= LIMITS.minLength && end - start <= LIMITS.typicalMax
      && score >= threshold.auto && result.opening && result.cluster && result.commercialKinds >= threshold.commercialKinds;
    candidates.push({ id: `local:${start}:${end ?? 'unknown'}`, start, end, source: 'local',
      score, evidence: result.evidence, boundary, decision: auto ? 'auto' : 'suggest' });
    coveredUntil = end ?? row.caption.start + LIMITS.absoluteMax;
  }
  return candidates;
}
