import type { DetectionMode } from '../lib/types';

export const LIMITS = {
  minLength: 8, typicalMax: 120, absoluteMax: 180, lookBack: 12,
  clusterWindow: 20, repeatWindow: 30, quietPeriod: 18, maxCaptionGap: 6,
  phraseWindow: 8, maxJoinedCaptions: 4, maxCaptions: 30000,
  heatRadius: 5, epsilon: 0.1, undoMs: 7000, maxWindowCaptions: 200, maxSearchCaptions: 2000,
} as const;
export const THRESHOLDS: Record<DetectionMode, { auto: number; suggest: number; commercialKinds: number }> = {
  conservative: { auto: 19, suggest: 10, commercialKinds: 2 },
  balanced: { auto: 17, suggest: 9, commercialKinds: 2 },
  aggressive: { auto: 15, suggest: 8, commercialKinds: 1 },
};
export const BONUS = { opening: 10, cluster: 3, repeat: 2, return: 3, heat: 2 } as const;
export const OPENINGS = [
  /\bthis (?:video|episode) is sponsored by\b/,
  /\btoday'?s sponsor is\b/,
  /\bthanks to .{1,60}? for sponsoring(?: this (?:video|episode))?\b/,
  /\bthanks to our sponsor\b/,
  /\bour sponsor today\b/,
  /\ba word from our sponsor\b/,
  /\bthis portion .{0,35}?sponsored by\b/,
  /\bthis video was made possible by\b/,
  /\bthanks to our partners at\b/,
];
export const TRANSITIONS = /\b(?:before we (?:continue|get into|begin|move on)|quick (?:word|message)|but first)\b|^first\b/;
export const STRONG_RETURNS = /\b(?:anyway back to|back to the (?:video|episode|story)|now let'?s get back|now back to|now where were we)\b/;
export const WEAK_RETURNS = /\b(?:let'?s continue|with that said|let'?s get into|let'?s move on)\b/;
export const COMMERCIAL_RULES = [
  { id: 'Promo code', points: 4, pattern: /\buse (?:my |our |the )?code\b/ },
  { id: 'Discount', points: 3, pattern: /\b(?:(?:get|save) \d+\s*(?:%|percent)|\d+\s*(?:%|percent) off)\b|\b(?:get|save) \d+%/ },
  { id: 'Description link', points: 2, pattern: /\blink (?:in the description|below)\b/ },
  { id: 'URL', points: 3, pattern: /\b(?:[a-z0-9-]+\.(?:com|net|org|io|co|app)|(?:visit|go to|head to) .{1,40}? dot (?:com|net|org|io))\b/ },
  { id: 'Free trial', points: 2, pattern: /\b(?:free trial|first .{1,20}? months? free)\b/ },
  { id: 'Offer', points: 2, pattern: /\b(?:special offer|limited time offer|sign up)\b/ },
] as const;
