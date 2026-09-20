import type { MatchedCaption } from './matcher';
import { LIMITS, TRANSITIONS } from './rules';

export function findStart(rows: MatchedCaption[], index: number): number {
  const at = rows[index]!.caption.start;
  for (let i = index; i >= 0 && index - i < LIMITS.maxWindowCaptions; i--) {
    const c = rows[i]!.caption;
    if (at - c.start > LIMITS.lookBack) break;
    if (TRANSITIONS.test(c.normalizedText)) return c.start;
  }
  return at;
}
export function findEnd(rows: MatchedCaption[], index: number, start: number): { end: number | null; boundary: 'return' | 'quiet' | 'unknown'; lastIndex: number } {
  let lastCommercial = index;
  let quietStart: number | null = null;
  let quietEnd: number | null = null;
  let lastIndex = index;
  for (let i = index + 1; i < Math.min(rows.length, index + LIMITS.maxSearchCaptions); i++) {
    const row = rows[i]!;
    const c = row.caption;
    if (c.start - start > LIMITS.absoluteMax) break;
    lastIndex = i;
    // A long transcript gap cannot establish continuity or an end boundary.
    if (c.start - rows[i - 1]!.caption.end > LIMITS.maxCaptionGap) break;
    if (c.start - start >= LIMITS.minLength && (row.strongReturn || row.weakReturn) && !row.commercial.length && !row.opening) {
      return { end: c.start, boundary: row.strongReturn ? 'return' : 'quiet', lastIndex: i };
    }
    if (row.commercial.length || row.opening) {
      lastCommercial = i;
      quietStart = null;
      quietEnd = null;
    } else {
      quietStart ??= c.start;
      // Quiet text can suggest an end, but can NEVER authorize an automatic skip.
      if (c.end - quietStart >= LIMITS.quietPeriod && quietStart - start >= LIMITS.minLength && lastCommercial > index) {
        quietEnd ??= quietStart;
      }
    }
    // Preserve a quiet suggestion while still searching for a strong return phrase.
    if (quietEnd !== null && c.start - quietEnd > LIMITS.quietPeriod * 2) break;
  }
  return { end: quietEnd, boundary: quietEnd !== null ? 'quiet' : 'unknown', lastIndex };
}
