import { getPreferences, sanitizePreferences } from '../storage/preferences';
import { patchCache, pruneCache, readCache, TTL, validSegments } from '../storage/cache';
import { isRecord, validVideoId, type LookupResult } from '../lib/types';
import { lookupSponsorBlock } from '../sponsorblock/adapter';

// Serialize mutations to avoid lost updates between tabs and extension pages.
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn);
  queue = result.catch(() => {});
  return result;
}
const inFlight = new Map<string, Promise<LookupResult>>();
async function lookup(videoId: string): Promise<LookupResult> {
  const cache = (await readCache())[videoId];
  if (cache?.status && Date.now() - cache.timestamp < TTL[cache.status]) return { status: cache.status, segments: cache.sponsorBlockSegments };
  let promise = inFlight.get(videoId);
  if (!promise) {
    promise = lookupSponsorBlock(videoId).then(async result => {
      await serialize(() => patchCache(videoId, { sponsorBlockSegments: result.segments, timestamp: Date.now(), status: result.status }));
      return result;
    }).finally(() => inFlight.delete(videoId));
    inFlight.set(videoId, promise);
  }
  return promise;
}
function senderVideo(sender: chrome.runtime.MessageSender): string | null {
  try {
    const url = new URL(sender.url ?? '');
    const id = url.searchParams.get('v');
    return sender.frameId === 0 && url.origin === 'https://www.youtube.com' && url.pathname === '/watch' && validVideoId(id) ? id : null;
  } catch { return null; }
}
async function handle(message: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
  if (sender.id !== chrome.runtime.id || !isRecord(message)) return { ok: false };
  const ownPage = sender.url?.startsWith(chrome.runtime.getURL('')) === true;
  if (ownPage && message.type === 'preferences:update' && isRecord(message.patch)) {
    const patch = message.patch;
    return serialize(async () => {
      const current = await getPreferences();
      await chrome.storage.local.set({ preferences: sanitizePreferences({ ...current, ...patch }) });
      return { ok: true };
    });
  }
  if (ownPage && message.type === 'channel:update' && typeof message.channelId === 'string' && /^UC[\w-]{22}$/.test(message.channelId)) {
    return serialize(async () => {
      const p = await getPreferences();
      if (message.mode === 'all' || message.mode === 'local') p.excludedChannels[message.channelId as string] = message.mode;
      else delete p.excludedChannels[message.channelId as string];
      await chrome.storage.local.set({ preferences: p });
      return { ok: true };
    });
  }
  if (ownPage && message.type === 'cache:clear') return serialize(async () => { await chrome.storage.local.remove('cache'); return { ok: true }; });
  if (ownPage && message.type === 'cache:invalidate' && validVideoId(message.videoId)) {
    const id = message.videoId;
    // Let an earlier lookup finish before invalidating, so it cannot restore a stale miss.
    await inFlight.get(id);
    return serialize(async () => {
      const cache = await readCache();
      delete cache[id];
      await chrome.storage.local.set({ cache });
      return { ok: true };
    });
  }
  const videoId = senderVideo(sender);
  if (!videoId || message.videoId !== videoId) return { ok: false };
  const p = await getPreferences();
  if (!p.enabled) return { ok: false };
  if (message.type === 'sponsorblock:lookup' && p.sponsorBlock) return lookup(videoId);
  if (message.type === 'cache:local:get' && p.localFallback && typeof message.key === 'string') {
    const e = (await readCache())[videoId];
    return e && e.localKey === message.key && Date.now() - (e.localTimestamp ?? 0) < TTL.local ? { segments: e.locallyDetectedSegments } : { segments: null };
  }
  if (message.type === 'cache:local:set' && p.localFallback && typeof message.key === 'string' && message.key.length < 200 && validSegments(message.segments) && message.segments.every(s => s.source === 'local')) {
    const segments = message.segments;
    const key = message.key;
    return serialize(async () => {
      await patchCache(videoId, { locallyDetectedSegments: segments, localTimestamp: Date.now(), localKey: key });
      return { ok: true };
    });
  }
  return { ok: false };
}
chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
  void handle(message, sender).then(respond).catch(() => respond({ ok: false, status: 'error', segments: [] }));
  return true;
});
chrome.runtime.onInstalled.addListener(() => {
  void serialize(async () => {
    await chrome.storage.local.set({ preferences: await getPreferences(), cache: pruneCache((await chrome.storage.local.get('cache')).cache) });
  });
});
