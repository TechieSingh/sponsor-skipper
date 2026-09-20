import { finite, isRecord, validVideoId, type LookupResult, type SponsorSegment } from '../lib/types';
import { readLimited } from '../lib/network';

export function mergeKnownSegments(segments: SponsorSegment[]): SponsorSegment[] {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: SponsorSegment[] = [];
  for (const s of sorted) {
    const previous = merged.at(-1);
    if (previous && previous.end !== null && s.end !== null && s.start <= previous.end) {
      previous.end = Math.max(previous.end, s.end);
      previous.id += `+${s.id}`;
    } else merged.push({ ...s });
  }
  return merged;
}
export function parseSponsorBlock(data: unknown, videoId: string): SponsorSegment[] {
  if (!Array.isArray(data) || data.length > 10000) throw new Error('Invalid SponsorBlock response');
  const match = data.find(v => isRecord(v) && v.videoID === videoId);
  if (!match) return [];
  if (!isRecord(match) || !Array.isArray(match.segments)) throw new Error('Invalid SponsorBlock segments');
  const segments: SponsorSegment[] = [];
  for (const row of match.segments.slice(0, 1000)) {
    if (!isRecord(row) || row.category !== 'sponsor' || row.actionType !== 'skip' || !Array.isArray(row.segment)) continue;
    const [start, end] = row.segment;
    if (!finite(start) || !finite(end) || start < 0 || end <= start || end > 86400) continue;
    segments.push({
      id: `sb:${start}:${end}`, start, end, source: 'sponsorblock', decision: 'auto',
      score: 100, evidence: [], boundary: 'known',
      videoDuration: finite(row.videoDuration) && row.videoDuration > 0 ? row.videoDuration : undefined,
    });
  }
  return mergeKnownSegments(segments);
}
export async function lookupSponsorBlock(videoId: string, fetcher: typeof fetch = fetch): Promise<LookupResult> {
  if (!validVideoId(videoId)) return { status: 'error', segments: [], error: 'Invalid video ID' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(videoId));
    const prefix = Array.from(new Uint8Array(digest)).map(n => n.toString(16).padStart(2, '0')).join('').slice(0, 4);
    const url = new URL(`https://sponsor.ajay.app/api/skipSegments/${prefix}`);
    url.searchParams.set('categories', '["sponsor"]');
    url.searchParams.set('actionTypes', '["skip"]');
    const response = await fetcher(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error' });
    if (response.status === 404) return { status: 'empty', segments: [] };
    if (!response.ok) throw new Error(`SponsorBlock HTTP ${response.status}`);
    const segments = parseSponsorBlock(JSON.parse(await readLimited(response, 2_000_000)), videoId);
    return { status: segments.length ? 'ok' : 'empty', segments };
  } catch (error) {
    return { status: 'error', segments: [], error: error instanceof Error ? error.message : 'Lookup failed' };
  } finally { clearTimeout(timeout); }
}
