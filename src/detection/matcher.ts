import type { CaptionSegment } from '../lib/types';
import { COMMERCIAL_RULES, LIMITS, OPENINGS, STRONG_RETURNS, WEAK_RETURNS } from './rules';

export interface MatchedCaption {
  caption: CaptionSegment;
  opening: boolean;
  commercial: string[];
  domains: string[];
  strongReturn: boolean;
  weakReturn: boolean;
}
/** Small lookahead joins phrases split across auto-caption events, without rescoring words. */
export function matchCaptions(captions: CaptionSegment[]): MatchedCaption[] {
  return captions.map((c, i) => {
    let joined = c.normalizedText;
    for (let j = i + 1; j < Math.min(captions.length, i + LIMITS.maxJoinedCaptions); j++) {
      const next = captions[j]!;
      const previous = captions[j - 1]!;
      if (next.start - c.start > LIMITS.phraseWindow || next.start - previous.end > 2) break;
      joined += ' ' + next.normalizedText;
    }
    // A phrase must begin in this caption, even when it finishes in the next one.
    const beginsHere = (pattern: RegExp) => {
      const match = pattern.exec(joined);
      return match !== null && match.index < c.normalizedText.length;
    };
    return {
      caption: c, opening: OPENINGS.some(beginsHere),
      commercial: COMMERCIAL_RULES.filter(r => beginsHere(r.pattern)).map(r => r.id),
      domains: c.normalizedText.match(/\b[a-z0-9-]+\.(?:com|net|org|io|co|app)\b/g) ?? [],
      strongReturn: beginsHere(STRONG_RETURNS), weakReturn: beginsHere(WEAK_RETURNS),
    };
  });
}
