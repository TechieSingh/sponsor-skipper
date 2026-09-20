import { finite, isRecord, validVideoId, type VideoMetadata } from '../lib/types';

export function currentVideoId(): string | null {
  if (location.hostname !== 'www.youtube.com' || location.pathname !== '/watch') return null;
  const id = new URL(location.href).searchParams.get('v');
  return validVideoId(id) ? id : null;
}
export function validateMetadata(value: unknown, videoId: string): VideoMetadata | null {
  if (!isRecord(value) || value.videoId !== videoId || !finite(value.duration) || value.duration <= 0 || typeof value.unsafe !== 'boolean') return null;
  if (typeof value.channelId !== 'string' || typeof value.channelName !== 'string' || !Array.isArray(value.tracks) || !Array.isArray(value.heatmap)) return null;
  if (value.channelId && !/^UC[\w-]{22}$/.test(value.channelId)) return null;
  return {
    videoId, duration: value.duration, unsafe: value.unsafe, channelId: value.channelId, channelName: value.channelName.slice(0, 200),
    tracks: value.tracks.slice(0, 100).filter(t => isRecord(t) && typeof t.baseUrl === 'string' && t.baseUrl.length < 16000 && typeof t.languageCode === 'string'),
    heatmap: value.heatmap.slice(0, 1000).filter(p => isRecord(p) && finite(p.time) && p.time >= 0 && finite(p.intensity) && p.intensity >= 0 && p.intensity <= 1),
  };
}
export function requestMetadata(videoId: string, heatmap: boolean, signal: AbortSignal): Promise<VideoMetadata | null> {
  return new Promise(resolve => {
    if (signal.aborted) return resolve(null);
    const token = crypto.randomUUID();
    const finish = (value: VideoMetadata | null) => {
      clearTimeout(timeout);
      window.removeEventListener('message', listener);
      signal.removeEventListener('abort', abort);
      resolve(value);
    };
    const listener = (e: MessageEvent) => {
      if (e.source === window && e.origin === location.origin && isRecord(e.data) && e.data.type === 'sponsor-skipper:metadata-response' && e.data.token === token) finish(validateMetadata(e.data.metadata, videoId));
    };
    const abort = () => finish(null);
    const timeout = setTimeout(() => finish(null), 1200);
    window.addEventListener('message', listener);
    signal.addEventListener('abort', abort, { once: true });
    window.postMessage({ type: 'sponsor-skipper:metadata-request', token, videoId, heatmap }, location.origin);
  });
}
export function playbackBlockReason(video: HTMLVideoElement, metadata: VideoMetadata): string | null {
  const player = video.closest('#movie_player');
  if (currentVideoId() !== metadata.videoId || !video.isConnected || !player) return 'Waiting for the current video player.';
  if (metadata.unsafe) return 'Skipping is paused for live or unavailable playback.';
  if (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting') || player.querySelector('.ytp-ad-player-overlay, .ytp-ad-survey')) return 'Waiting for YouTube advertising to finish.';
  if (!Number.isFinite(video.duration) || metadata.duration <= 0 || Math.abs(video.duration - metadata.duration) > 2) return 'Waiting for the video duration to match; skipping is paused.';
  if (video.readyState < 1 || video.seekable.length === 0) return 'Waiting for YouTube to load seekable video.';
  return null;
}
export function isSafePlayback(video: HTMLVideoElement, metadata: VideoMetadata): boolean {
  return playbackBlockReason(video, metadata) === null;
}
