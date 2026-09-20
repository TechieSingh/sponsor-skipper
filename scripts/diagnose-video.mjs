import { chromium } from 'playwright';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const videoId = process.argv[2];
if (!/^[\w-]{11}$/.test(videoId ?? '')) throw new Error('Provide an 11-character YouTube video ID');
const profile = await mkdtemp(path.join(tmpdir(), 'sponsor-skipper-diagnose-'));
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium', headless: true,
  args: [`--disable-extensions-except=${path.resolve('dist')}`, `--load-extension=${path.resolve('dist')}`, '--autoplay-policy=no-user-gesture-required'],
});
const network = [];
const logs = [];
const snapshots = [];
try {
  await mkdir('test-results', { recursive: true });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  await worker.evaluate(async () => {
    const { preferences } = await chrome.storage.local.get('preferences');
    await chrome.storage.local.set({ preferences: { ...preferences, debug: true } });
  });
  context.on('response', response => {
    const url = new URL(response.url());
    if (url.host === 'sponsor.ajay.app' || url.pathname === '/api/timedtext') {
      void response.text().then(body => network.push({ host: url.host, path: url.pathname, status: response.status(), bytes: body.length,
        body: url.host === 'sponsor.ajay.app' ? body.slice(0, 5000) : undefined })).catch(() => {});
    }
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.skipEvents = [];
    document.addEventListener('seeking', event => {
      if (event.target instanceof HTMLVideoElement) window.skipEvents.push({ event: 'seeking', time: event.target.currentTime });
    }, true);
    document.addEventListener('seeked', event => {
      if (event.target instanceof HTMLVideoElement) window.skipEvents.push({ event: 'seeked', time: event.target.currentTime });
    }, true);
  });
  page.on('console', m => { if (m.text().includes('SKIPPER') || m.type() === 'error') logs.push(m.text().slice(0, 400)); });
  const start = process.argv.includes('--test-skip') ? '&t=269s' : '';
  await page.goto(`https://www.youtube.com/watch?v=${videoId}${start}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  for (let i = 0; i < 2; i++) {
    await page.waitForTimeout(6000);
    const player = await page.evaluate(() => {
      const p = document.getElementById('movie_player');
      const v = p?.querySelector('video');
      const r = p?.getPlayerResponse?.();
      return {
        title: document.title, details: r?.videoDetails, playability: r?.playabilityStatus?.status,
        duration: v?.duration, currentTime: v?.currentTime, paused: v?.paused, readyState: v?.readyState, seekable: v && Array.from({length:v.seekable.length},(_,i)=>[v.seekable.start(i),v.seekable.end(i)]),
        playerClasses: p?.className,
        overlays: [...(p?.querySelectorAll('.ytp-ad-player-overlay, .ytp-ad-survey') ?? [])].map(e => ({ class: e.className, display: getComputedStyle(e).display, visibility: getComputedStyle(e).visibility, rect: e.getBoundingClientRect().toJSON() })),
        tracks: r?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.map(t => ({ language: t.languageCode, kind: t.kind, urlHost: new URL(t.baseUrl).host })),
        overlayAttached: !!document.querySelector('[data-sponsor-skipper]'),
      };
    });
    const extension = await worker.evaluate(async () => {
      const storage = await chrome.storage.local.get(['preferences', 'cache']);
      const statuses = [];
      for (const tab of await chrome.tabs.query({})) {
        try { statuses.push(await chrome.tabs.sendMessage(tab.id, { type: 'video:status' })); } catch {}
      }
      return { ...storage, statuses };
    });
    snapshots.push({ player, extension });
    console.log(JSON.stringify({ iteration: i, player: { ...player, details: { videoId: player.details?.videoId, lengthSeconds: player.details?.lengthSeconds, isLive: player.details?.isLive, isLiveContent: player.details?.isLiveContent, isUpcoming: player.details?.isUpcoming } }, extension }, null, 2));
  }
  if (process.argv.includes('--test-skip')) {
    await page.waitForTimeout(10000);
    const result = await page.evaluate(() => ({ currentTime: document.querySelector('#movie_player video')?.currentTime, events: window.skipEvents, playerClasses: document.getElementById('movie_player')?.className }));
    const skipped = result.events?.some(e => e.event === 'seeking' && Math.abs(e.time - 346.753) < 0.25);
    snapshots.push({ skipTest: { skipped, ...result } });
    console.log('LIVE SKIP TEST', JSON.stringify({ skipped, ...result }));
  }
  await page.screenshot({ path: `test-results/${videoId}.png` });
  await writeFile(`test-results/${videoId}-diagnostic.json`, JSON.stringify({ network, logs, snapshots }, null, 2));
  console.log('NETWORK', JSON.stringify(network));
} finally { await context.close(); }
