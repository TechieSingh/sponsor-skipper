import { isRecord, type CaptionTrack, type VideoMetadata } from '../lib/types';
import { parseHeatmap } from './heatmap';

export function extractMetadata(response: unknown, expectedId: string, heatData?: unknown): VideoMetadata | null {
  if (!isRecord(response) || !isRecord(response.videoDetails)) return null;
  const details = response.videoDetails;
  if (details.videoId !== expectedId) return null;
  const captions = isRecord(response.captions) && response.captions.playerCaptionsTracklistRenderer;
  const rawTracks = isRecord(captions) && Array.isArray(captions.captionTracks) ? captions.captionTracks : [];
  const tracks: CaptionTrack[] = [];
  for (const t of rawTracks.slice(0, 100)) {
    if (!isRecord(t) || typeof t.baseUrl !== 'string' || typeof t.languageCode !== 'string') continue;
    if (t.baseUrl.length > 16000) continue;
    tracks.push({ baseUrl: t.baseUrl, languageCode: t.languageCode, kind: typeof t.kind === 'string' ? t.kind : undefined });
  }
  const status = isRecord(response.playabilityStatus) ? response.playabilityStatus.status : '';
  const micro = isRecord(response.microformat) && response.microformat.playerMicroformatRenderer;
  const broadcast = isRecord(micro) && micro.liveBroadcastDetails;
  const duration = Number(details.lengthSeconds);
  return {
    videoId: expectedId,
    channelId: typeof details.channelId === 'string' && /^UC[\w-]{22}$/.test(details.channelId) ? details.channelId : '',
    channelName: typeof details.author === 'string' ? details.author.slice(0, 200) : '',
    duration: Number.isFinite(duration) ? duration : 0,
    unsafe: Boolean(details.isLive || details.isLiveContent || details.isUpcoming || (isRecord(broadcast) && broadcast.isLiveNow) || status !== 'OK'),
    tracks, heatmap: parseHeatmap(heatData),
  };
}
