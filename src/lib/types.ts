export interface CaptionSegment {
  start: number;
  duration: number;
  end: number;
  text: string;
  normalizedText: string;
}
export interface HeatPoint { time: number; intensity: number }
export interface Evidence { rule: string; points: number }
export interface SponsorSegment {
  id: string;
  start: number;
  end: number | null;
  source: 'sponsorblock' | 'local';
  decision: 'auto' | 'suggest';
  score: number;
  evidence: Evidence[];
  boundary: 'known' | 'return' | 'quiet' | 'unknown';
  videoDuration?: number;
}
export type DetectionMode = 'conservative' | 'balanced' | 'aggressive';
export interface Preferences {
  enabled: boolean;
  sponsorBlock: boolean;
  localFallback: boolean;
  autoSkipKnown: boolean;
  autoSkipLocal: boolean;
  showSuspected: boolean;
  useHeatmap: boolean;
  showNotifications: boolean;
  mode: DetectionMode;
  debug: boolean;
  excludedChannels: Record<string, 'all' | 'local'>;
}
export interface CaptionTrack { baseUrl: string; languageCode: string; kind?: string }
export interface VideoMetadata {
  videoId: string;
  channelId: string;
  channelName: string;
  duration: number;
  unsafe: boolean;
  tracks: CaptionTrack[];
  heatmap: HeatPoint[];
}
export interface VideoStatus {
  videoId: string | null;
  channelId: string;
  channelName: string;
  known: number;
  local: number;
  suspected: number;
  message: string;
  playbackMessage?: string;
  ranges?: { start: number; end: number | null; source: SponsorSegment['source'] }[];
}
export type LookupResult = { status: 'ok' | 'empty' | 'error'; segments: SponsorSegment[]; error?: string };
export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const validVideoId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(v);
