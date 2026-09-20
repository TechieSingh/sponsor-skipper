import { getPreferences } from '../storage/preferences';
import { DEFAULTS } from '../storage/preferences';
import { validSegments } from '../storage/cache';
import type { LookupResult, Preferences, SponsorSegment, VideoMetadata, VideoStatus } from '../lib/types';
import { currentVideoId, isSafePlayback, playbackBlockReason, requestMetadata } from '../youtube/player';
import { chooseTrack, fetchCaptions } from '../youtube/captions';
import { detectSponsors, DETECTOR_VERSION } from '../detection/detector';
import { SkipEngine } from './skip-engine';
import { Overlay } from '../ui/overlay';

let preferences: Preferences = { ...DEFAULTS };
let videoId: string | null = null;
let metadata: VideoMetadata | null = null;
let segments: SponsorSegment[] = [];
let controller = new AbortController();
let engine: SkipEngine | null = null;
let overlay: Overlay | null = null;
let video: HTMLVideoElement | null = null;
let adObserver: MutationObserver | null = null;
let ignored = new Set<string>();
let loading = false;
let navigating = false;
let navigationTimer: ReturnType<typeof setTimeout> | undefined;
let status: VideoStatus = { videoId: null, channelId: '', channelName: '', known: 0, local: 0, suspected: 0, message: 'Open a YouTube video.' };

function disposePlayer(): void {
  engine?.dispose(); overlay?.dispose(); adObserver?.disconnect();
  engine = null; overlay = null; adObserver = null; video = null;
}
function clear(): void {
  controller.abort(); controller = new AbortController();
  disposePlayer(); metadata = null; segments = []; loading = false;
}
function attach(): void {
  const next = document.querySelector<HTMLVideoElement>('#movie_player video.html5-main-video, #movie_player video');
  if (video === next && engine) { overlay?.ensureAttached(); return; }
  disposePlayer();
  if (!next || !metadata || metadata.unsafe || !preferences.enabled || preferences.excludedChannels[metadata.channelId] === 'all') return;
  video = next;
  const player = next.closest<HTMLElement>('#movie_player')!;
  const meta = metadata;
  overlay = new Overlay(player, preferences, next);
  engine = new SkipEngine(next, segments, preferences, () => !controller.signal.aborted && isSafePlayback(next, meta), overlay, ignored);
  adObserver = new MutationObserver(() => engine?.tick());
  adObserver.observe(player, { attributes: true, attributeFilter: ['class'] });
}
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) return resolve();
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}
async function load(id: string, signal: AbortSignal): Promise<void> {
  loading = true;
  status = { videoId: id, channelId: '', channelName: '', known: 0, local: 0, suspected: 0, message: preferences.enabled ? 'Checking this video…' : 'Disabled globally.' };
  if (!preferences.enabled) { loading = false; return; }
  let meta: VideoMetadata | null = null;
  for (let attempt = 0; attempt < 10 && !signal.aborted; attempt++) {
    meta = await requestMetadata(id, preferences.useHeatmap, signal);
    if (meta) break;
    await delay(500, signal);
  }
  if (signal.aborted) return;
  if (!meta) { loading = false; status.message = 'Player metadata unavailable; skipping paused.'; return; }
  metadata = meta;
  status.channelId = meta.channelId; status.channelName = meta.channelName;
  if (meta.unsafe) { loading = false; status.message = 'Live, premiere, or unavailable playback; skipping paused.'; return; }
  const exclusion = preferences.excludedChannels[meta.channelId];
  if (exclusion === 'all') { loading = false; status.message = 'Disabled on this channel.'; return; }
  let known: LookupResult = { status: 'empty', segments: [] };
  if (preferences.sponsorBlock) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'sponsorblock:lookup', videoId: id });
      if (response && ['ok', 'empty', 'error'].includes(response.status) && validSegments(response.segments)) known = response;
      else known = { status: 'error', segments: [] };
    } catch { known = { status: 'error', segments: [] }; }
  }
  if (signal.aborted) return;
  segments = known.segments.filter(s => s.source === 'sponsorblock' && s.end !== null && s.end <= meta.duration + 0.25 && (!s.videoDuration || Math.abs(s.videoDuration - meta.duration) <= 2));
  status.known = segments.length;
  status.message = segments.length ? 'SponsorBlock segments ready.' : known.status === 'error' ? 'SponsorBlock unavailable. Checking local captions…' : 'No known sponsors. Checking local captions…';
  if (!segments.length && preferences.localFallback && exclusion !== 'local') {
    const track = chooseTrack(meta.tracks);
    const key = `${DETECTOR_VERSION}:${preferences.mode}:${preferences.useHeatmap}:${meta.duration}:${track?.languageCode ?? ''}:${track?.kind ?? ''}`;
    const cached = await chrome.runtime.sendMessage({ type: 'cache:local:get', videoId: id, key }).catch(() => null);
    if (signal.aborted) return;
    if (cached && validSegments(cached.segments)) {
      segments = cached.segments;
      status.message = segments.length ? 'Local caption matches ready (cached).' : 'No confident local matches (cached).';
    } else if (track) {
      const captions = await fetchCaptions(track, signal);
      if (signal.aborted) return;
      if (captions.length) {
        segments = detectSponsors(captions, preferences.mode, preferences.useHeatmap ? meta.heatmap : []);
        status.message = segments.length ? 'Local caption matches ready.' : 'No confident local sponsor matches.';
        void chrome.runtime.sendMessage({ type: 'cache:local:set', videoId: id, key, segments }).catch(() => {});
      } else status.message = 'Caption track unavailable; no local skips.';
    } else status.message = 'No English caption track available; no local skips.';
  } else if (!segments.length) status.message = 'No known sponsors. Local fallback is disabled.';
  if (known.status === 'error') status.message = `SponsorBlock unavailable. ${status.message}`;
  status.local = segments.filter(s => s.source === 'local' && s.decision === 'auto').length;
  status.suspected = segments.filter(s => s.decision === 'suggest').length;
  if (preferences.debug) {
    console.groupCollapsed(`[SKIPPER] Video: ${id}`);
    console.log('SponsorBlock:', known.status, known.segments.map(s => [s.start, s.end]));
    for (const s of segments) {
      console.log(`${s.source}: ${s.start} → ${s.end ?? 'unknown'}`);
      console.table(s.evidence);
      console.log(`Total = ${s.score}; decision = ${s.decision}; boundary = ${s.boundary}`);
    }
    console.log(status.message); console.groupEnd();
  }
  loading = false;
  attach();
}
function sync(force = false): void {
  if (navigating) return;
  const id = currentVideoId();
  if (id !== videoId || force) {
    const changed = id !== videoId;
    clear(); videoId = id;
    if (changed) ignored = new Set();
    if (id) {
      const signal = controller.signal;
      void load(id, signal).catch(() => {
        if (!signal.aborted && videoId === id) { loading = false; status.message = 'Unable to initialize; skipping paused. Use Check again in the popup.'; }
      });
    }
    else status = { videoId: null, channelId: '', channelName: '', known: 0, local: 0, suspected: 0, message: 'Open a standard YouTube watch video. Shorts are not supported.' };
  } else if (!loading) attach();
}
// Immediate suspension prevents old segments being applied during SPA transitions.
document.addEventListener('yt-navigate-start', () => {
  clear(); videoId = null; navigating = true;
  clearTimeout(navigationTimer);
  navigationTimer = setTimeout(() => { navigating = false; sync(); }, 10000);
});
document.addEventListener('yt-navigate-finish', () => { clearTimeout(navigationTimer); navigating = false; sync(); });
window.addEventListener('popstate', () => { clearTimeout(navigationTimer); navigating = false; sync(); });
window.addEventListener('pagehide', () => clear());
window.addEventListener('pageshow', () => sync(true));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.preferences) void getPreferences().then(p => { preferences = p; sync(true); });
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === 'video:refresh') {
    ignored = new Set();
    sync(true);
    respond({ ok: true });
  }
  if (message?.type === 'video:status') {
    let playbackMessage = '';
    if (segments.length && metadata) {
      if (!video) playbackMessage = 'Waiting for the video player.';
      else playbackMessage = playbackBlockReason(video, metadata)
        ?? (video.seeking ? 'YouTube is seeking or buffering.' : video.paused ? 'Playback paused. Automatic skipping resumes when you play.'
          : segments.every(s => ignored.has(s.id)) ? 'These segments were already skipped or undone. Check again resets them.'
          : 'Automatic skipping is ready.');
      if (segments.every(s => s.decision !== 'auto' || !(s.source === 'sponsorblock' ? preferences.autoSkipKnown : preferences.autoSkipLocal))) playbackMessage = 'These matches require an explicit skip. Use the button in the player.';
    }
    respond({ ...status, playbackMessage, ranges: segments.map(({ start, end, source }) => ({ start, end, source })) });
  }
});
void getPreferences().then(p => { preferences = p; sync(); }).catch(() => {});
// One cheap URL + player-identity check per second catches missed SPA events/replacements.
// No transcript work, network requests, or full-DOM observer runs in this watchdog.
setInterval(() => sync(), 1000);
