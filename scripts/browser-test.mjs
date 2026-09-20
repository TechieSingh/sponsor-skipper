import { chromium } from 'playwright';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const extensionPath = path.resolve('dist');
const profile = await mkdtemp(path.join(tmpdir(), 'sponsor-skipper-test-'));
await mkdir('test-results', { recursive: true });
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium', headless: true,
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
});
const errors = [];
const results = [];
const check = (description, value) => { assert.ok(value, description); results.push(description); console.log(`PASS ${description}`); };
const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
const extensionId = new URL(worker.url()).host;

const fixture = `<!doctype html><html><head><title>YouTube player fixture</title></head><body style="background:#f7f8f7;margin:40px;font-family:system-ui"><h1>Controlled YouTube player fixture</h1><div id="movie_player" style="position:relative;width:960px;height:540px;background:#14231d"><video class="html5-main-video"></video></div><script>
window.fixtureState={paused:false,seeking:false,rate:1};
Object.defineProperty(fixtureState,'time',{get:()=>Number(document.querySelector('video').dataset.clock||0),set:v=>document.querySelector('video').dataset.clock=v});
window.setupVideo=()=>{const v=document.querySelector('video');for(const [key,get] of Object.entries({currentTime:()=>fixtureState.time,duration:()=>300,paused:()=>fixtureState.paused,seeking:()=>fixtureState.seeking,playbackRate:()=>fixtureState.rate,readyState:()=>4,seekable:()=>({length:1,start:()=>0,end:()=>300}),ended:()=>false})){Object.defineProperty(v,key,{configurable:true,get,set:value=>{if(key==='currentTime')fixtureState.time=value;}});}return v;};
setupVideo();
window.metadata=(id,live=false)=>({videoDetails:{videoId:id,channelId:'UCabcdefghijklmnopqrstuv',author:'Fixture Creator',lengthSeconds:'300',isLive:live},playabilityStatus:{status:'OK'},captions:{playerCaptionsTracklistRenderer:{captionTracks:[{baseUrl:'https://www.youtube.com/api/timedtext?v='+id,languageCode:'en'}]}}});
window.response=metadata(new URL(location.href).searchParams.get('v'));
document.querySelector('#movie_player').getPlayerResponse=()=>window.response;
window.ytInitialPlayerResponse=window.response;
window.setTime=(t)=>{fixtureState.time=t;document.querySelector('video').dispatchEvent(new Event('timeupdate'));};
window.navigate=(id,live=false)=>{document.dispatchEvent(new Event('yt-navigate-start'));history.pushState({},'', '/watch?v='+id+'&list=fixture');window.response=metadata(id,live);fixtureState.time=0;document.dispatchEvent(new Event('yt-navigate-finish'));};
window.addEventListener('popstate',()=>{window.response=metadata(new URL(location.href).searchParams.get('v'));fixtureState.time=0;document.dispatchEvent(new Event('yt-navigate-finish'));});
</script></body></html>`;
const captions = { events: [
  [10000, 3000, 'Before we continue'], [13000, 5000, 'This video is sponsored by Acme'],
  [18000, 5000, 'Go to example.com and use code JOHN for 20 percent off'],
  [23000, 5000, 'It works on all your devices at home'], [28000, 5000, 'Link in the description for a free trial'],
  [33000, 4000, 'Thanks again for supporting this channel'], [37000, 5000, 'Back to the video'],
].map(([tStartMs, dDurationMs, text]) => ({ tStartMs, dDurationMs, segs: [{ utf8: text }] })) };
let captionRequests = 0;
await context.route('https://www.youtube.com/**', route => {
  const url = new URL(route.request().url());
  if (url.pathname === '/api/timedtext') {
    captionRequests++;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(captions) });
  }
  if (route.request().resourceType() === 'document') return route.fulfill({ contentType: 'text/html', body: fixture });
  return route.abort();
});
await worker.evaluate(() => {
  globalThis.lookupCalls = 0;
  // Deterministic API fixture inside the actual extension worker, no production code edits.
  globalThis.fetch = async url => {
    if (!String(url).startsWith('https://sponsor.ajay.app/api/skipSegments/')) throw new Error('Unexpected network destination');
    globalThis.lookupCalls++;
    if (globalThis.failLookup) return new Response('', { status: 503 });
    return Response.json([{ videoID: 'knownVideo1', segments: [
      { segment: [10, 30], category: 'sponsor', actionType: 'skip', videoDuration: 300 },
      { segment: [25, 40], category: 'sponsor', actionType: 'skip', videoDuration: 300 },
      { segment: [80, 95], category: 'intro', actionType: 'skip', videoDuration: 300 },
    ] }]);
  };
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
const clockSession = await context.newCDPSession(page);
const worlds = [];
clockSession.on('Runtime.executionContextCreated', ({ context }) => worlds.push(context));
await clockSession.send('Runtime.enable');
async function installIsolatedClock() {
  // DOM wrappers differ between MAIN and ISOLATED worlds. Install the fixture clock
  // in both worlds, backed by a shared DOM attribute, without replacing extension code.
  for (const world of worlds.filter(w => !w.auxData?.isDefault)) {
    try {
      const result = await clockSession.send('Runtime.evaluate', { contextId: world.id, expression: 'typeof chrome !== "undefined" && chrome.runtime?.id', returnByValue: true });
      if (result.result.value !== extensionId) continue;
      await clockSession.send('Runtime.evaluate', { contextId: world.id, expression: `(() => {
        const setup = () => { const v=document.querySelector('video'); if(!v||v.dataset.isolatedClock)return; v.dataset.isolatedClock='true';
          for(const [key,get] of Object.entries({currentTime:()=>Number(v.dataset.clock||0),duration:()=>300,paused:()=>false,seeking:()=>false,playbackRate:()=>1,readyState:()=>4,seekable:()=>({length:1,start:()=>0,end:()=>300}),ended:()=>false}))Object.defineProperty(v,key,{configurable:true,get,set:value=>{if(key==='currentTime')v.dataset.clock=value;}});
        }; setup(); new MutationObserver(setup).observe(document.querySelector('#movie_player'),{childList:true});
      })()` });
      return;
    } catch { /* Ignore stale contexts from initial about:blank. */ }
  }
  throw new Error('Extension isolated world was not found');
}
const time = () => page.evaluate(() => document.querySelector('video').currentTime);
async function status(id) {
  return worker.evaluate(async expected => {
    for (const tab of await chrome.tabs.query({})) {
      try { const value = await chrome.tabs.sendMessage(tab.id, { type: 'video:status' }); if (value?.videoId === expected) return value; } catch {}
    }
    return null;
  }, id);
}
async function ready(id, predicate) {
  const until = Date.now() + 15000;
  while (Date.now() < until) {
    const value = await status(id);
    if (value && predicate(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${id}: ${JSON.stringify(await status(id))}`);
}
async function clickClosedShadowButton(label) {
  const cdp = await context.newCDPSession(page);
  try {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    function find(node) {
      if (node.nodeName === 'BUTTON' && node.children?.some(c => c.nodeValue === label)) return node;
      for (const child of [...(node.children ?? []), ...(node.shadowRoots ?? [])]) { const found = find(child); if (found) return found; }
    }
    const node = find(root);
    assert.ok(node, `Closed shadow button ${label} exists`);
    const { model } = await cdp.send('DOM.getBoxModel', { nodeId: node.nodeId });
    await page.mouse.click((model.border[0] + model.border[4]) / 2, (model.border[1] + model.border[5]) / 2);
  } finally { await cdp.detach(); }
}
try {
  check('MV3 service worker loaded from unpacked dist', worker.url().endsWith('/background.js'));
  const manifest = await worker.evaluate(() => chrome.runtime.getManifest());
  check('minimum permission is storage, with no tabs/history', manifest.permissions.join() === 'storage');
  await page.goto('https://www.youtube.com/watch?v=knownVideo1');
  await ready('knownVideo1', s => s.known === 1);
  await installIsolatedClock();
  check('SponsorBlock lookup merges overlapping sponsor segments', (await status('knownVideo1')).known === 1);
  check('known segments avoid caption requests', captionRequests === 0);
  await page.evaluate(() => setTime(12));
  check('real content script seeks known sponsor to merged end', await time() === 40.1);
  await page.screenshot({ path: 'test-results/skip-toast.png' });
  await clickClosedShadowButton('Undo');
  check('overlay Undo returns to sponsor start', await time() === 10);
  await page.evaluate(() => setTime(12));
  check('Undo suppresses immediate repeat', await time() === 12);

  await page.evaluate(() => navigate('localVideo1'));
  await ready('localVideo1', s => s.local === 1);
  check('SPA navigation runs local fallback after empty SponsorBlock result', (await status('localVideo1')).local === 1);
  await page.evaluate(() => { document.querySelector('#movie_player').classList.add('ad-showing'); setTime(18); });
  check('YouTube ad-showing class prevents seeking', await time() === 18);
  await page.evaluate(() => { document.querySelector('#movie_player').classList.remove('ad-showing'); setTime(18); });
  check('local segment seeks only after ad finishes', await time() === 37.1);

  await page.evaluate(() => navigate('replaceVid1'));
  await ready('replaceVid1', s => s.local === 1);
  await page.evaluate(() => { const old = document.querySelector('video'); const v = document.createElement('video'); v.className = 'html5-main-video'; old.replaceWith(v); setupVideo(); });
  await page.waitForTimeout(1200);
  await page.evaluate(() => setTime(15));
  check('replacement video element receives skip listeners', await time() === 37.1);
  const requestsBeforeBack = await worker.evaluate(() => globalThis.lookupCalls);
  await page.goBack();
  await ready('localVideo1', s => s.local === 1);
  check('Back navigation reuses SponsorBlock cache', await worker.evaluate(() => globalThis.lookupCalls) === requestsBeforeBack);
  await page.goForward();
  await ready('replaceVid1', s => s.local === 1);
  check('Forward and playlist URL preserve video identity', (await status('replaceVid1')).local === 1);

  await worker.evaluate(() => { globalThis.failLookup = true; });
  await page.evaluate(() => navigate('apiError001'));
  await ready('apiError001', s => s.local === 1);
  check('API failure still permits conservative local fallback', /SponsorBlock unavailable/.test((await status('apiError001')).message));
  await worker.evaluate(() => { globalThis.failLookup = false; });
  await page.evaluate(() => { navigate('noCaption01'); delete window.response.captions; });
  await ready('noCaption01', s => /No English caption/.test(s.message));
  await page.evaluate(() => setTime(18));
  check('missing captions leave video playback unchanged', await time() === 18);

  await page.evaluate(() => navigate('liveVideo12', true));
  await ready('liveVideo12', s => /Live/.test(s.message));
  await page.evaluate(() => setTime(18));
  check('livestream metadata disables all seeking', await time() === 18);
  await page.evaluate(() => { document.dispatchEvent(new Event('yt-navigate-start')); history.pushState({}, '', '/shorts/knownVideo1'); document.dispatchEvent(new Event('yt-navigate-finish')); setTime(18); });
  check('Shorts navigation removes the overlay', await page.locator('[data-sponsor-skipper]').count() === 0);

  const options = await context.newPage();
  options.on('pageerror', error => errors.push(error.message));
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.locator('[data-pref=enabled]').uncheck();
  await options.getByRole('status').filter({ hasText: 'Saved' }).waitFor();
  await page.evaluate(() => navigate('knownVideo1'));
  await ready('knownVideo1', s => /Disabled globally/.test(s.message));
  check('options toggle propagates live to YouTube', (await status('knownVideo1')).message === 'Disabled globally.');
  await options.locator('[data-pref=enabled]').check();
  await ready('knownVideo1', s => s.known === 1);
  await options.screenshot({ path: 'test-results/options.png', fullPage: true });
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 350, height: 690 });
  popup.on('pageerror', error => errors.push(error.message));
  await page.bringToFront();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.waitForFunction(() => document.querySelector('[data-pref=enabled]').checked);
  await popup.getByText('1 sponsor segment found', { exact: true }).waitFor();
  check('popup loads from packaged resources', await popup.title() === 'Sponsor Skipper');
  check('popup reads the active YouTube tab without tabs permission', await popup.locator('#segment-count').textContent() === '1 sponsor segment found');
  check('popup shows the actual sponsor interval', (await popup.locator('#segment-ranges').textContent()).includes('0:10–0:40'));
  const beforeRetry = await worker.evaluate(() => globalThis.lookupCalls);
  await popup.getByRole('button', { name: 'Check again', exact: true }).click();
  await ready('knownVideo1', s => s.known === 1 && s.message === 'SponsorBlock segments ready.');
  check('explicit Check again refreshes the lookup cache', await worker.evaluate(() => globalThis.lookupCalls) === beforeRetry + 1);
  await page.evaluate(() => document.querySelector('#movie_player').classList.add('ad-showing'));
  await popup.getByText('Waiting for YouTube advertising to finish.', { exact: true }).waitFor();
  check('popup exposes the reason skipping is waiting', true);
  await page.evaluate(() => document.querySelector('#movie_player').classList.remove('ad-showing'));
  await popup.screenshot({ path: 'test-results/popup.png' });
  await options.evaluate(async () => chrome.runtime.sendMessage({ type: 'channel:update', channelId: 'UCabcdefghijklmnopqrstuv', mode: 'all' }));
  await ready('knownVideo1', s => /Disabled on this channel/.test(s.message));
  check('per-channel exclusion suspends skipping', (await status('knownVideo1')).message === 'Disabled on this channel.');
  await options.evaluate(async () => chrome.runtime.sendMessage({ type: 'channel:update', channelId: 'UCabcdefghijklmnopqrstuv', mode: 'local' }));
  await ready('knownVideo1', s => s.known === 1);
  await page.evaluate(() => navigate('localVideo1'));
  await ready('localVideo1', s => /Local fallback is disabled/.test(s.message));
  check('SponsorBlock-only channel setting disables local fallback', (await status('localVideo1')).local === 0);
  const blank = await context.newPage();
  await blank.goto('about:blank');
  await popup.reload();
  await popup.getByText('Not connected to this tab', { exact: true }).waitFor();
  check('unconnected tabs display reload guidance instead of Ready', await popup.getByRole('button', { name: 'Reload this tab' }).isVisible());
  check('no uncaught page or extension UI errors', errors.length === 0);
  await writeFile('test-results/browser-report.json', JSON.stringify({ browser: context.browser()?.version(), extensionId, fixture: true, checks: results, errors }, null, 2));
  console.log(`${results.length} browser checks passed. Screenshots and report: test-results/`);
} catch (error) {
  await page.screenshot({ path: 'test-results/failure.png' }).catch(() => {});
  console.error('Page errors:', errors);
  throw error;
} finally { await context.close(); }
