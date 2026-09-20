import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupSponsorBlock, parseSponsorBlock } from '../src/sponsorblock/adapter';
import { captionUrl, chooseTrack, parseJsonCaptions } from '../src/youtube/captions';
import { parseHeatmap } from '../src/youtube/heatmap';
import { extractMetadata } from '../src/youtube/metadata';
import { CACHE_LIMIT, CACHE_VERSION, pruneCache, TTL } from '../src/storage/cache';
import { sanitizePreferences } from '../src/storage/preferences';

const videoId = 'abcdefghijk';
const row = (start: unknown, end: unknown, category = 'sponsor', actionType = 'skip') => ({ segment: [start, end], category, actionType, videoDuration: 300 });
test('SponsorBlock filters malformed, irrelevant and non-skip entries and merges overlaps', () => {
  const result = parseSponsorBlock([{ videoID: videoId, segments: [row(20, 40), row(10, 30), row(-1, 5), row(0, '8'), row(50, 60, 'intro'), row(60, 65, 'sponsor', 'mute'), row(8, 2)] }], videoId);
  assert.deepEqual(result.map(s => [s.start, s.end]), [[10, 40]]);
  assert.deepEqual(parseSponsorBlock([{ videoID: 'anotherId12', segments: [row(1, 5)] }], videoId), []);
  assert.throws(() => parseSponsorBlock({}, videoId));
});
test('SponsorBlock uses the documented hash prefix endpoint and no credentials/referrer', async () => {
  let called = false;
  const result = await lookupSponsorBlock(videoId, (async (url, init) => {
    called = true;
    const u = new URL(String(url));
    assert.match(u.pathname, /^\/api\/skipSegments\/[a-f0-9]{4}$/);
    assert.ok(!String(url).includes(videoId)); assert.equal(u.searchParams.get('categories'), '["sponsor"]');
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.referrerPolicy, 'no-referrer');
    return Response.json([{ videoID: videoId, segments: [row(10, 20)] }]);
  }) as typeof fetch);
  assert.ok(called); assert.equal(result.status, 'ok');
});
test('missing data, HTTP errors, malformed JSON, and network errors fail gracefully', async () => {
  const scenarios: [() => Promise<Response>, string][] = [
    [async () => new Response('', { status: 404 }), 'empty'],
    [async () => Response.json([]), 'empty'],
    [async () => new Response('', { status: 500 }), 'error'],
    [async () => new Response('invalid json'), 'error'],
    [async () => { throw new Error('network offline'); }, 'error'],
  ];
  for (const [fetcher, expected] of scenarios) assert.equal((await lookupSponsorBlock(videoId, fetcher as typeof fetch)).status, expected);
});
test('invalid video IDs make no network request', async () => {
  assert.equal((await lookupSponsorBlock('../foo', (async () => { throw new Error('should never execute'); }) as typeof fetch)).status, 'error');
});
test('SponsorBlock timeout aborts a stalled request', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let started: () => void = () => {};
  const requestStarted = new Promise<void>(resolve => { started = resolve; });
  try {
    const request = lookupSponsorBlock(videoId, ((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
      started();
    })) as typeof fetch);
    await requestStarted;
    t.mock.timers.tick(7000);
    assert.equal((await request).status, 'error');
  } finally { t.mock.timers.reset(); }
});
test('oversized API responses fail before JSON parsing', async () => {
  const result = await lookupSponsorBlock(videoId, (async () => new Response('[]', { headers: { 'content-length': '3000000' } })) as typeof fetch);
  assert.equal(result.status, 'error');
});
test('caption parser supports JSON3 automatic captions, duplicate events and invalid entries', () => {
  const parsed = parseJsonCaptions({ events: [
    { tStartMs: 10000, dDurationMs: 3000, segs: [{ utf8: 'This video ' }, { utf8: 'is sponsored by Acme' }] },
    { tStartMs: 13000, dDurationMs: 2000, segs: [{ utf8: 'Use code X' }] },
    { tStartMs: 15000, dDurationMs: 2000, segs: [{ utf8: 'Use code X' }] },
    { tStartMs: -1, segs: [{ utf8: 'bad' }] }, { tStartMs: 17000, segs: [{ utf8: '\n' }] },
  ] });
  assert.equal(parsed.length, 2); assert.equal(parsed[0]?.start, 10); assert.equal(parsed[0]?.end, 13);
  assert.equal(parsed[1]?.end, 17);
});
test('captions accept only YouTube timedtext, and prefer manual English without translations', () => {
  const track = { baseUrl: 'https://www.youtube.com/api/timedtext?v=abcdefghijk&sig=x', languageCode: 'en' };
  assert.equal(captionUrl(track)?.searchParams.get('sig'), 'x');
  for (const baseUrl of ['https://evil.com/api/timedtext', 'https://www.youtube.com/redirect', 'http://www.youtube.com/api/timedtext', 'https://www.youtube.com.evil.com/api/timedtext']) assert.equal(captionUrl({ ...track, baseUrl }), null);
  assert.equal(chooseTrack([{ ...track, kind: 'asr' }, track])?.kind, undefined);
  assert.equal(chooseTrack([{ ...track, languageCode: 'de' }]), undefined);
});
test('heatmap parses legacy and entity markers, tolerates unavailable and cyclic metadata', () => {
  assert.deepEqual(parseHeatmap(null), []);
  const data: Record<string, unknown> = { old: { heatMarkerRenderer: { timeRangeStartMillis: 5000, heatMarkerIntensityScoreNormalized: 0.1 } }, markers: [{ startMillis: '10000', intensityScoreNormalized: 0.8 }] };
  data.self = data;
  assert.deepEqual(parseHeatmap(data), [{ time: 5, intensity: 0.1 }, { time: 10, intensity: 0.8 }]);
});
test('metadata rejects stale SPA response and marks livestreams/premieres unsafe', () => {
  const response = { videoDetails: { videoId, lengthSeconds: '300', channelId: 'UCabcdefghijklmnopqrstuv', author: 'Creator' }, playabilityStatus: { status: 'OK' } };
  assert.equal(extractMetadata(response, 'otherVideo1'), null);
  assert.equal(extractMetadata(response, videoId)?.unsafe, false);
  for (const field of ['isLive', 'isLiveContent', 'isUpcoming']) assert.equal(extractMetadata({ ...response, videoDetails: { ...response.videoDetails, [field]: true } }, videoId)?.unsafe, true);
  assert.equal(extractMetadata({ ...response, playabilityStatus: { status: 'LIVE_STREAM_OFFLINE' } }, videoId)?.unsafe, true);
});
test('cache evicts oldest entries, expires data, and discards corrupt versions', () => {
  const now = Date.now();
  const entry = { sponsorBlockSegments: [], locallyDetectedSegments: [], timestamp: now, version: CACHE_VERSION };
  const cache = Object.fromEntries(Array.from({ length: CACHE_LIMIT + 20 }, (_, i) => [String(i).padStart(11, '0'), { ...entry, timestamp: now - i }]));
  assert.equal(Object.keys(pruneCache(cache, now)).length, CACHE_LIMIT);
  assert.ok(!pruneCache(cache, now)[String(169).padStart(11, '0')]);
  assert.deepEqual(pruneCache({ [videoId]: { ...entry, timestamp: now - TTL.ok } }, now), {});
  assert.deepEqual(pruneCache({ [videoId]: { ...entry, version: 999 } }, now), {});
});
test('preference validation preserves defaults and only accepts channel IDs', () => {
  const p = sanitizePreferences({ enabled: 'false', mode: 'wild', excludedChannels: { bad: 'all', UCabcdefghijklmnopqrstuv: 'local' } });
  assert.equal(p.enabled, true); assert.equal(p.mode, 'conservative');
  assert.deepEqual(p.excludedChannels, { UCabcdefghijklmnopqrstuv: 'local' });
});
