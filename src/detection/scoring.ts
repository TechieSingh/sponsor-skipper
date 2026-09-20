import type { Evidence } from '../lib/types';
import type { MatchedCaption } from './matcher';
import { BONUS, COMMERCIAL_RULES, LIMITS } from './rules';

export function scoreEvidence(rows: MatchedCaption[]): { score: number; evidence: Evidence[]; commercialKinds: number; opening: boolean; cluster: boolean } {
  const evidence: Evidence[] = [];
  const opening = rows.some(r => r.opening);
  if (opening) evidence.push({ rule: 'Opening phrase', points: BONUS.opening });
  const kinds = new Set(rows.flatMap(r => r.commercial));
  for (const rule of COMMERCIAL_RULES) if (kinds.has(rule.id)) evidence.push({ rule: rule.id, points: rule.points });
  let cluster = false;
  const counts = new Map<string, number>();
  let left = 0;
  const domains = new Map<string, number>();
  let repeated = false;
  for (const [index, row] of rows.entries()) {
    while (left < index && row.caption.start - rows[left]!.caption.start > LIMITS.clusterWindow) {
      for (const id of rows[left]!.commercial) {
        const remaining = (counts.get(id) ?? 1) - 1;
        if (remaining) counts.set(id, remaining); else counts.delete(id);
      }
      left++;
    }
    for (const id of row.commercial) counts.set(id, (counts.get(id) ?? 0) + 1);
    if (counts.size >= 2) cluster = true;
    for (const domain of new Set(row.domains)) {
      const prev = domains.get(domain);
      if (prev !== undefined && row.caption.start > prev && row.caption.start - prev <= LIMITS.repeatWindow) repeated = true;
      domains.set(domain, row.caption.start);
    }
  }
  if (cluster) evidence.push({ rule: 'Commercial cluster', points: BONUS.cluster });
  if (repeated) evidence.push({ rule: 'Repeated domain', points: BONUS.repeat });
  return { score: evidence.reduce((sum, e) => sum + e.points, 0), evidence, commercialKinds: kinds.size, opening, cluster };
}
