import { chromium } from 'playwright';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

// Installed, branded Google Chrome uses CDP loading instead of --load-extension.
// The unsafe debugging flag is limited to this disposable, empty test profile.
const profile = await mkdtemp(path.join(tmpdir(), 'sponsor-skipper-chrome-'));
let context = await chromium.launchPersistentContext(profile, {
  channel: 'chrome', headless: true, ignoreDefaultArgs: ['--disable-extensions'],
  args: ['--enable-unsafe-extension-debugging'],
});
const report = { browser: context.browser()?.version(), brandedChrome: null, loaded: false, options: false, live: null };
try {
  let page = context.pages()[0] ?? await context.newPage();
  const cdp = await context.newCDPSession(page);
  let id;
  try {
    ({ id } = await cdp.send('Extensions.loadUnpacked', { path: path.resolve('dist') }));
    report.brandedChrome = { version: report.browser, loaded: true };
  } catch (error) {
    report.brandedChrome = { version: report.browser, loaded: false, reason: String(error) };
    console.log('Google Chrome does not permit this automated loading method; manual Load unpacked is required. Using Chromium for the live smoke check.');
    await context.close();
    const fallbackProfile = await mkdtemp(path.join(tmpdir(), 'sponsor-skipper-live-'));
    context = await chromium.launchPersistentContext(fallbackProfile, {
      channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${path.resolve('dist')}`, `--load-extension=${path.resolve('dist')}`],
    });
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    id = new URL(worker.url()).host;
    report.browser = context.browser()?.version();
    page = context.pages()[0] ?? await context.newPage();
  }
  assert.ok(id);
  report.loaded = true;
  await page.goto(`chrome-extension://${id}/options.html`);
  await page.waitForFunction(() => document.querySelector('[data-pref=enabled]')?.checked === true);
  report.options = true;
  console.log(`PASS unpacked extension and options loaded in ${report.brandedChrome.loaded ? 'Google Chrome' : 'Chromium'} ${report.browser}`);
  await mkdir('test-results', { recursive: true });
  if (process.argv.includes('--live')) {
    const watch = await context.newPage();
    try {
      await watch.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await watch.waitForTimeout(12000);
      const worker = context.serviceWorkers().find(w => w.url().startsWith(`chrome-extension://${id}/`));
      const status = await worker?.evaluate(async () => {
        for (const tab of await chrome.tabs.query({})) {
          try { const s = await chrome.tabs.sendMessage(tab.id, { type: 'video:status' }); if (s?.videoId) return s; } catch {}
        }
      });
      report.live = { title: await watch.title(), status: status ?? null };
      console.log('Live YouTube smoke result:', JSON.stringify(report.live));
      await watch.screenshot({ path: 'test-results/live-youtube.png' });
    } catch (error) { report.live = { error: String(error) }; console.log('Live YouTube unavailable:', String(error)); }
  }
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/chrome-report.json', JSON.stringify(report, null, 2));
} finally { await context.close(); }
