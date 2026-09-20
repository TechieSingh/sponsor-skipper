import { finite, isRecord, type CaptionSegment, type CaptionTrack } from '../lib/types';
import { caption } from '../detection/normalize';
import { LIMITS } from '../detection/rules';
import { readLimited } from '../lib/network';

export function parseJsonCaptions(data: unknown): CaptionSegment[] {
  if (!isRecord(data) || !Array.isArray(data.events)) return [];
  const rows: CaptionSegment[] = [];
  for (const event of data.events.slice(0, LIMITS.maxCaptions)) {
    if (!isRecord(event) || !finite(event.tStartMs) || event.tStartMs < 0 || !Array.isArray(event.segs)) continue;
    const text = event.segs.filter(isRecord).map(s => typeof s.utf8 === 'string' ? s.utf8 : '').join('').slice(0, 10000);
    if (!text.trim()) continue;
    const duration = finite(event.dDurationMs) && event.dDurationMs > 0 ? Math.min(event.dDurationMs / 1000, 30) : 0;
    rows.push(caption(event.tStartMs / 1000, duration, text));
  }
  return finalizeCaptions(rows);
}
export function finalizeCaptions(rows: CaptionSegment[]): CaptionSegment[] {
  const sorted = rows.filter(r => r.normalizedText && finite(r.start) && r.start >= 0 && finite(r.duration) && r.duration >= 0).sort((a, b) => a.start - b.start);
  const result: CaptionSegment[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i]!;
    const next = sorted[i + 1];
    const duration = Math.min(c.duration || (next ? next.start - c.start : 0), next ? Math.max(0, next.start - c.start) : c.duration, 30);
    const previous = result.at(-1);
    if (previous && previous.normalizedText === c.normalizedText && c.start <= previous.end + 0.25) {
      previous.end = Math.max(previous.end, c.start + duration);
      previous.duration = previous.end - previous.start;
    } else result.push({ ...c, duration, end: c.start + duration });
  }
  return result;
}
export function parseXmlCaptions(text: string): CaptionSegment[] {
  const document = new DOMParser().parseFromString(text, 'text/xml');
  if (document.querySelector('parsererror')) return [];
  const rows = Array.from(document.querySelectorAll('text, p')).slice(0, LIMITS.maxCaptions).map(node => {
    const srv = node.tagName === 'p';
    const start = Number(node.getAttribute(srv ? 't' : 'start')) / (srv ? 1000 : 1);
    const duration = Number(node.getAttribute(srv ? 'd' : 'dur')) / (srv ? 1000 : 1);
    return caption(start, duration, node.textContent ?? '');
  });
  return finalizeCaptions(rows);
}
export function chooseTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
  // V1 rules are English. Do not request translation or pretend other languages are supported.
  return tracks.filter(t => /^en(?:-|$)/i.test(t.languageCode)).sort((a, b) => Number(a.kind === 'asr') - Number(b.kind === 'asr'))[0];
}
export function captionUrl(track: CaptionTrack): URL | null {
  try {
    const url = new URL(track.baseUrl);
    if (url.origin !== 'https://www.youtube.com' || url.pathname !== '/api/timedtext' || url.username || url.password) return null;
    url.searchParams.set('fmt', 'json3');
    url.searchParams.delete('xosf');
    return url;
  } catch { return null; }
}
export async function fetchCaptions(track: CaptionTrack, signal: AbortSignal): Promise<CaptionSegment[]> {
  const url = captionUrl(track);
  if (!url) return [];
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 7000);
  try {
    if (signal.aborted) return [];
    const response = await fetch(url, { signal: controller.signal, credentials: 'same-origin', redirect: 'error' });
    if (!response.ok) return [];
    const text = await readLimited(response, 4_000_000);
    if (!text.trim()) return [];
    return text.trimStart().startsWith('<') ? parseXmlCaptions(text) : parseJsonCaptions(JSON.parse(text));
  } catch { return []; }
  finally { clearTimeout(timeout); signal.removeEventListener('abort', abort); }
}
