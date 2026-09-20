import type { CaptionSegment } from '../lib/types';

export function decodeEntities(text: string): string {
  const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"' };
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (original, entity: string) => {
    if (entity.startsWith('#')) {
      const code = entity[1]?.toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : ' ';
    }
    return named[entity.toLowerCase()] ?? original;
  });
}
export function normalizeText(text: string): string {
  return decodeEntities(text).normalize('NFKC').toLowerCase()
    .replace(/<[^>]*>/g, ' ').replace(/\[(?:music|applause|laughter|inaudible)\]|[♪♫]/g, ' ')
    .replace(/[’‘]/g, "'").replace(/[\u200b-\u200d\ufeff]/g, '')
    .replace(/[^\p{L}\p{N}\s'.%/-]/gu, ' ').replace(/\s+/g, ' ').trim();
}
export function caption(start: number, duration: number, text: string): CaptionSegment {
  return { start, duration, end: start + duration, text, normalizedText: normalizeText(text) };
}
