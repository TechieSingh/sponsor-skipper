// Generates Chrome Web Store listing graphics into store-assets/.
// Renders branded HTML at exact canvas sizes with Playwright Chromium.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'store-assets');
mkdirSync(out, { recursive: true });

const b64 = (p) => `data:image/png;base64,${readFileSync(join(root, p)).toString('base64')}`;
const shots = {
  popup: b64('test-results/popup.png'),
  options: b64('test-results/options.png'),
  toast: b64('test-results/skip-toast.png'),
  icon: b64('dist/assets/icon128.png'),
};

// Regions of interest in the source captures, in their own pixel coordinates.
const OPTIONS_COL = { x: 272, w: 736 };
const REGIONS = {
  player: { src: shots.toast, x: 42, y: 100, w: 958, h: 556 },
  detection: { src: shots.options, x: OPTIONS_COL.x, y: 587, w: OPTIONS_COL.w, h: 262 },
  privacy: { src: shots.options, x: OPTIONS_COL.x, y: 983, w: OPTIONS_COL.w, h: 288 },
  skipping: { src: shots.options, x: OPTIONS_COL.x, y: 118, w: OPTIONS_COL.w, h: 735 },
};

// Scale a region so it renders `cardW` wide, then crop to it exactly.
const crop = (region, cardW, extra = '') => {
  const k = cardW / region.w;
  return `<div class="card" style="width:${cardW}px;height:${Math.round(region.h * k)}px;position:relative;${extra}">
    <img src="${region.src}" style="position:absolute;width:${Math.round(1280 * k)}px;
         left:${-Math.round(region.x * k)}px;top:${-Math.round(region.y * k)}px;display:block">
  </div>`;
};

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;

const base = (w, h, body) => `<!doctype html><meta charset="utf-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;overflow:hidden}
  body{font-family:${FONT};background:#f6f8f5;color:#18392f;-webkit-font-smoothing:antialiased}
  .wrap{width:${w}px;height:${h}px;display:flex;flex-direction:column}
  .bar{display:flex;align-items:center;gap:14px;padding:32px 56px 0;flex:0 0 auto}
  .bar img{width:42px;height:42px;border-radius:11px}
  .bar b{font-size:21px;letter-spacing:-.2px}
  .bar span{font-size:15px;color:#60776a;margin-left:2px}
  h1{font-size:44px;line-height:1.12;letter-spacing:-1px;font-weight:700}
  .sub{font-size:20px;line-height:1.45;color:#487657;margin-top:14px;max-width:660px}
  .head{padding:22px 56px 0;flex:0 0 auto}
  .stage{flex:1;display:flex;align-items:center;justify-content:center;padding:26px 56px 36px;min-height:0}
  .card{background:#fff;border:1px solid #d2e2d1;border-radius:16px;
        box-shadow:0 18px 44px rgba(24,57,47,.14);overflow:hidden}
  .pill{display:inline-block;background:#e6f2e5;color:#236647;font-size:13px;font-weight:700;
        letter-spacing:.9px;text-transform:uppercase;padding:7px 13px;border-radius:999px}
  .cols{display:flex;gap:40px;align-items:center;width:100%;height:100%}
  ul{list-style:none;display:flex;flex-direction:column;gap:17px}
  li{font-size:18px;line-height:1.42;color:#23583b;padding-left:30px;position:relative}
  li::before{content:"›››";position:absolute;left:0;top:0;color:#74ba92;font-weight:800;font-size:15px;letter-spacing:-2px}
  li b{color:#18392f}
</style>
<div class="wrap">${body}</div>`;

const header = (pill, title, sub) => `
  <div class="bar"><img src="${shots.icon}"><b>Sponsor Skipper</b><span>for YouTube</span></div>
  <div class="head"><span class="pill">${pill}</span><h1 style="margin-top:16px">${title}</h1>
  ${sub ? `<p class="sub">${sub}</p>` : ''}</div>`;

const screens = [
  {
    name: 'screenshot-1-skip',
    html: base(1280, 800, `
      ${header('Automatic skipping', 'Skip the sponsor read.<br>Keep the video.',
        'Seeks past creator-read sponsor segments, then shows a notification with Undo for seven seconds.')}
      <div class="stage">${crop(REGIONS.player, 660, 'background:#132b22')}</div>`),
  },
  {
    name: 'screenshot-2-popup',
    html: base(1280, 800, `
      <div class="stage" style="padding:56px 64px">
        <div class="cols">
          <div style="flex:1">
            <span class="pill">Popup</span>
            <h1 style="margin-top:16px">Control for the<br>video you're on</h1>
            <ul style="margin-top:30px">
              <li><b>See the segments</b> found for this video, and their timestamps.</li>
              <li><b>Toggle sources</b> — SponsorBlock, local rules, notifications.</li>
              <li><b>Per-channel choice:</b> enabled, disabled, or SponsorBlock only.</li>
              <li><b>Check again</b> clears this video's cache and reruns detection.</li>
            </ul>
          </div>
          <div class="card" style="flex:0 0 auto">
            <img src="${shots.popup}" style="width:340px;display:block">
          </div>
        </div>
      </div>`),
  },
  {
    name: 'screenshot-3-fallback',
    html: base(1280, 800, `
      ${header('Local fallback', 'No SponsorBlock entry?<br>Local rules still catch it.',
        'When no community segment exists, deterministic English caption rules run on your device. No AI, no uploads, no third-party service.')}
      <div class="stage">${crop(REGIONS.detection, 720)}</div>`),
  },
  {
    name: 'screenshot-4-privacy',
    html: base(1280, 800, `
      ${header('Privacy', 'Your data stays yours.',
        'No accounts, analytics, telemetry, AI models, transcript uploads, or segment submissions. There is no developer-operated server.')}
      <div class="stage">${crop(REGIONS.privacy, 720)}</div>`),
  },
  {
    name: 'screenshot-5-settings',
    html: base(1280, 800, `
      <div class="stage" style="padding:48px 64px">
        <div class="cols">
          <div style="flex:0 0 430px">
            <span class="pill">Settings</span>
            <h1 style="margin-top:16px;font-size:40px">Tuned for<br>precision</h1>
            <ul style="margin-top:26px">
              <li><b>Conservative by default.</b> Balanced and Aggressive available.</li>
              <li>Every mode needs an explicit opening, clustered signals, and a clear end.</li>
              <li>Ending unclear? You get a <b>suggestion</b>, never a silent skip.</li>
              <li>Exclude channels, clear the local cache, enable debug logs.</li>
            </ul>
          </div>
          ${crop(REGIONS.skipping, 600)}
        </div>
      </div>`),
  },
];

const tile = (w, h, titleSize) => base(w, h, `
  <div style="width:${w}px;height:${h}px;background:linear-gradient(135deg,#18392f 0%,#236647 100%);
       display:flex;align-items:center;${w > 800 ? 'justify-content:center;' : ''}
       gap:${w > 800 ? 48 : 26}px;padding:0 ${w > 800 ? 84 : 34}px;color:#fff">
    <img src="${shots.icon}" style="width:${w > 800 ? 132 : 82}px;height:${w > 800 ? 132 : 82}px;
         border-radius:${w > 800 ? 30 : 19}px;flex:0 0 auto">
    <div>
      <div style="font-size:${titleSize}px;font-weight:700;letter-spacing:-.8px">Sponsor Skipper</div>
      <div style="font-size:${w > 800 ? 27 : 16}px;color:#bde3cc;margin-top:${w > 800 ? 14 : 8}px;line-height:1.35">
        Skip creator sponsor reads on YouTube.<br>SponsorBlock + private local rules.
      </div>
      ${w > 800 ? `<div style="font-size:19px;color:#74ba92;margin-top:20px;font-weight:600;letter-spacing:.5px">NO AI · NO ACCOUNTS · NO TRACKING</div>` : ''}
    </div>
  </div>`);

const browser = await chromium.launch();
for (const { name, html } of screens) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.screenshot({ path: join(out, `${name}.png`) });
  await page.close();
}
for (const [name, w, h, ts] of [['promo-small-440x280', 440, 280, 29], ['promo-marquee-1400x560', 1400, 560, 62]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(tile(w, h, ts));
  await page.screenshot({ path: join(out, `${name}.png`) });
  await page.close();
}
await browser.close();
console.log(`Wrote store assets to ${out}`);
