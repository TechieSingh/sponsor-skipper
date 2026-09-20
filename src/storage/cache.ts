import { finite, isRecord, validVideoId, type LookupResult, type SponsorSegment } from '../lib/types';

export const CACHE_VERSION = 1;
export const CACHE_LIMIT = 150;
export const TTL = { ok: 7 * 86400_000, empty: 3600_000, error: 5 * 60_000, local: 86400_000 };
export interface CacheEntry {
  sponsorBlockSegments: SponsorSegment[];
  locallyDetectedSegments: SponsorSegment[];
  timestamp: number;
  version: number;
  status?: LookupResult['status'];
  localTimestamp?: number;
  localKey?: string;
}
export function validSegments(value: unknown): value is SponsorSegment[] {
  return Array.isArray(value) && value.length <= 1000 && value.every(s => isRecord(s)
    && typeof s.id === 'string' && s.id.length <= 20000 && finite(s.start) && s.start >= 0 && s.start <= 86400
    && (s.end === null || (finite(s.end) && s.end > s.start && s.end <= 86400))
    && ['local', 'sponsorblock'].includes(String(s.source)) && ['auto', 'suggest'].includes(String(s.decision))
    && ['known', 'return', 'quiet', 'unknown'].includes(String(s.boundary)) && finite(s.score)
    && (s.videoDuration === undefined || (finite(s.videoDuration) && s.videoDuration > 0))
    && Array.isArray(s.evidence) && s.evidence.length <= 30 && s.evidence.every(e => isRecord(e) && typeof e.rule === 'string' && e.rule.length < 100 && finite(e.points)));
}
export function pruneCache(value: unknown, now = Date.now()): Record<string, CacheEntry> {
  if (!isRecord(value)) return {};
  const entries = Object.entries(value).filter(([id, e]) => validVideoId(id) && isRecord(e)
    && e.version === CACHE_VERSION && finite(e.timestamp) && e.timestamp <= now && now - Math.max(e.timestamp, finite(e.localTimestamp) ? e.localTimestamp : 0) < TTL.ok
    && (e.localTimestamp === undefined || (finite(e.localTimestamp) && e.localTimestamp <= now))
    && (e.status === undefined || ['ok', 'empty', 'error'].includes(String(e.status)))
    && validSegments(e.sponsorBlockSegments) && validSegments(e.locallyDetectedSegments)) as [string, CacheEntry][];
  return Object.fromEntries(entries.sort((a, b) => Math.max(b[1].timestamp, b[1].localTimestamp ?? 0) - Math.max(a[1].timestamp, a[1].localTimestamp ?? 0)).slice(0, CACHE_LIMIT));
}
export async function readCache(): Promise<Record<string, CacheEntry>> {
  return pruneCache((await chrome.storage.local.get('cache')).cache);
}
export async function patchCache(videoId: string, patch: Partial<CacheEntry>): Promise<void> {
  const cache = await readCache();
  cache[videoId] = { sponsorBlockSegments: [], locallyDetectedSegments: [], timestamp: 0, version: CACHE_VERSION, ...cache[videoId], ...patch };
  await chrome.storage.local.set({ cache: pruneCache(cache) });
}
