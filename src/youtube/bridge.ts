import { isRecord, validVideoId } from '../lib/types';
import { extractMetadata } from './metadata';

// MAIN world only reads public page data. No extension APIs, credentials or settings are exposed.
const page = window as unknown as { ytInitialPlayerResponse?: unknown; ytInitialData?: unknown };
let lastRequest = 0;
window.addEventListener('message', event => {
  if (event.source !== window || event.origin !== location.origin || !isRecord(event.data)) return;
  const request = event.data;
  if (request.type !== 'sponsor-skipper:metadata-request' || typeof request.token !== 'string' || request.token.length > 80 || !validVideoId(request.videoId)) return;
  if (location.pathname !== '/watch' || new URL(location.href).searchParams.get('v') !== request.videoId) return;
  if (Date.now() - lastRequest < 100) return;
  lastRequest = Date.now();
  let metadata = null;
  try {
    const player = document.getElementById('movie_player') as (HTMLElement & { getPlayerResponse?: () => unknown }) | null;
    const response = player?.getPlayerResponse?.();
    const watch = document.querySelector('ytd-watch-flexy') as (HTMLElement & { data?: unknown }) | null;
    // Initial page data can refer to a previous SPA video; only use it for its matching ID.
    const initial = extractMetadata(page.ytInitialPlayerResponse, request.videoId);
    const heatData = request.heatmap === true ? (watch?.data ?? (initial ? page.ytInitialData : undefined)) : undefined;
    metadata = extractMetadata(response, request.videoId, heatData) ?? extractMetadata(page.ytInitialPlayerResponse, request.videoId, heatData);
  } catch { /* Page structure/API changes fail closed. */ }
  window.postMessage({ type: 'sponsor-skipper:metadata-response', token: request.token, metadata }, location.origin);
});
