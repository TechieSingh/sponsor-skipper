# Sponsor Skipper

A free Chrome Manifest V3 extension that skips creator-read sponsorships inside standard YouTube videos. It queries SponsorBlock first, then uses deterministic English caption rules if no valid sponsor segments are available. No AI, accounts, analytics, paid APIs, developer backend, remote code, or segment submissions. Regular YouTube ads are not blocked or skipped.

## Install unpacked

Requires Node.js 22+ and Chrome 111+.

```sh
npm ci
npm run check
```

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this project's **dist/** directory, not the source directory.
3. Reload any YouTube tabs already open, then open a standard `https://www.youtube.com/watch?v=...` video.
4. Pin Sponsor Skipper to access its popup. Use **Settings** for detailed controls.

The generated `dist/` is self-contained. There are no runtime npm dependencies. All JavaScript is bundled locally; neither the build nor the installed extension downloads executable code at runtime. Updating source requires rebuilding, reloading the extension, and reloading the YouTube tab.

## Behavior

- Known `sponsor` / `skip` segments from SponsorBlock take priority. Other categories are ignored. Overlaps are merged. Responses with invalid times or mismatched video duration are rejected.
- Available English captions are processed once if no usable known segment exists, SponsorBlock is disabled, or its lookup fails. English manual captions are preferred over English automatic captions. Captions need not be visible. No automatic translation occurs.
- Local automatic skipping requires an explicit creator sponsor opening, multiple nearby commercial signals, a clear content-return phrase, sufficient score, and an 8–120-second bounded interval. Defaults favor precision over recall.
- Suggestions never authorize an automatic skip. A suggestion with a tentative end can be skipped explicitly; one with no end asks how many seconds to seek, with no prefilled guess.
- Automatic skips seek to the segment end plus 0.1 seconds. Notifications include **Undo** for seven seconds. Undo seeks to the segment start. Skipped/undone segments stay ignored during that visit, including video element replacement; revisiting the video allows detection again.
- Playback seeking is suspended during ad classes/overlays, an unknown or mismatched duration, navigation, unavailable metadata, nonseekable playback, livestreams, and upcoming/live premieres. V1 also conservatively disables archived live content. Shorts, embeds, mobile YouTube, and other video sites are outside V1.

## Controls

After installing or updating, reload the YouTube tab. The popup explicitly reports an unconnected tab and provides **Reload this tab**. It shows segment intervals and current playback readiness. **Check again** clears this video's cached lookup and reruns detection once; it also resets skipped/undone segments for this visit. Popup status refreshes once per second only while open and does not poll SponsorBlock.

The popup provides global enable/disable, SponsorBlock, local fallback, and notification toggles; current-video counts; and channel choices: enabled, disabled, or SponsorBlock only. The global switch stops all processing for newly initialized videos. Options additionally control known/local automatic skips, suggestions, supporting heatmaps, conservative/balanced/aggressive scores, exclusion removal, cache clearing, and debug logs. Disabling both automatic source switches leaves explicit suggestion controls available.

## Architecture

```text
manifest.json              MV3 declaration; storage + SponsorBlock host only
src/background/            Validated messages, serialized cache/settings writes
src/content/               SPA lifecycle and the event-driven SkipEngine
src/sponsorblock/           Hash-prefix API adapter, validation and overlap merging
src/youtube/               MAIN-world metadata bridge, captions, player guards, heatmap
src/detection/             Normalization, phrase matching, scoring and boundaries
src/storage/               Preference schema and bounded local cache
src/ui/                    Isolated player overlay and shared settings controls
src/popup/                 Minimal current-video controls
src/options/               Preferences, exclusions, privacy and debugging
src/lib/                   Shared types and bounded response reader
tests/                     Synthetic detector, adapter, storage and engine tests
scripts/                   Reproducible bundling, packaging and browser smoke suite
```

The MAIN-world bridge reads `getPlayerResponse()` when available, with a matching-video `ytInitialPlayerResponse` fallback. It exports only a bounded metadata subset through request-correlated messages. The isolated content script validates every response, uses only same-origin timedtext URLs, and never exposes extension storage or arbitrary privileged fetch access to the page. Page metadata is an untrusted input and may change; absent data fails closed.

`yt-navigate-start` immediately tears down active skipping. `yt-navigate-finish`, Back/Forward, and a one-second URL/player identity watchdog handle SPA changes. Per-video work has abortable waits, stale-result protection, and listener cleanup. A player-class-only observer handles ad transitions. No whole-DOM observer runs. The skip engine uses media events plus one timeout for the next boundary, adjusted for playback speed; it does no animation-frame or high-frequency polling. Captions are matched/indexed once and rule work uses bounded windows.

SponsorBlock requests run in the MV3 service worker because they are cross-origin. The adapter uses the documented privacy endpoint, `GET /api/skipSegments/:sha256HashPrefix`, with the recommended four-character prefix, `categories=["sponsor"]`, and `actionTypes=["skip"]`. Requests have a seven-second timeout, bounded bodies, no credentials/referrer, and no redirects. A short-lived in-flight map deduplicates concurrent requests. Persistent state survives worker suspension in `chrome.storage.local`; no keepalive mechanism is used. See [SponsorBlock API documentation](https://wiki.sponsor.ajay.app/w/API_Docs).

## Detection tuning

All phrases, thresholds, bonuses, and search limits live in `src/detection/rules.ts`. Scores are deterministic and are **not calibrated probabilities**. Each signal group scores once within a candidate, so repeating a promo code does not inflate confidence. Commercial clustering needs distinct signal kinds. Repeated domains may add two points. Generic mentions of sponsorship, brands, or advertising are not openings.

| Mode | Auto score | Suggest score | Required commercial kinds |
| --- | ---: | ---: | ---: |
| Conservative (default) | 19 | 10 | 2 |
| Balanced | 17 | 9 | 2 |
| Aggressive | 15 | 8 | 1 |

Every mode still requires multiple clustered signals, an explicit opening, and a strong end for automatic skipping. Heatmaps can add two points to transcript-backed candidates but cannot supply an opening or a missing end. Heatmap intensity represents replay activity, **not measured viewer skip behavior**. The optional parser handles legacy heat markers and current `macroMarkersListEntity` shapes, including string millisecond values, with bounded traversal. These are undocumented YouTube internals, not a guaranteed API; see the current [yt-dlp YouTube extractor](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/_video.py) for independently maintained examples of the public-page structures.

Quiet commercial tails and weaker transitions such as “with that said” are suggestion-only. Long caption gaps invalidate end continuity. No arbitrary 90/120/180-second endpoint is ever created. Rule-based detection can miss sponsors or mistake quoted marketing language for a sponsor; keep Conservative enabled or turn off local automatic skipping if precision is insufficient for your videos.

## Privacy and permissions

Read [PRIVACY.md](PRIVACY.md) for exact network, cache, and retention behavior.

| Manifest entry | Why it is needed |
| --- | --- |
| `storage` | Device-only settings, channel exclusions, bounded segment cache. |
| `https://sponsor.ajay.app/*` host permission | Cross-origin read-only SponsorBlock API lookup in the worker. Chrome host permissions are origin-scoped; application code limits paths to the lookup API. |
| `https://www.youtube.com/*` content-script match | Observe SPA navigation into `/watch` from any YouTube page, read public player metadata, fetch same-origin captions, and seek the current video. |

No `tabs` permission is needed to query an active tab ID or send it a message; sensitive tab metadata is not accessed. The extension declares neither ad-blocking permissions nor network interception rules. The MAIN-world bridge has no extension API access. Chrome documents [content-script isolation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) and [permission declarations](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions).

The cache has at most 150 video entries: known results expire for reuse after seven days, misses after one hour, errors after five minutes, and local inference after one day. Local results are keyed by detector version, mode, heatmap setting, language/track kind, and duration. Transcripts are never persisted. Physical cleanup happens during cache operations; there is no always-running expiration timer.

## Verification

See [VERIFICATION.md](VERIFICATION.md) for measured results, generated artifacts, and the distinction between fixture checks, live smoke testing, and manual release acceptance.

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
# Optional: installed Chrome smoke check, with a Chromium fallback if Chrome
# disallows CDP unpacked loading. --live visits one public YouTube watch page.
npm run test:chrome -- --live
```

TypeScript strict checks include unused code; no separate linter is configured. Unit tests cover normalization, split/overlapping phrases, scoring, exact boundaries, negative examples, multiple sponsors, missing ends, heatmap-only rejection, API failures, caption URLs, cache eviction, live metadata, seeking, Undo, disposal, and speed-aware scheduling.

The browser suite launches a clean Chromium profile and loads the **actual unpacked extension**. It serves a controlled YouTube-origin fixture and deterministic API responses, exercising MV3 startup, bridge isolation, worker messaging, ad protection, caption fallback, replacement videos, SPA/playlist/Back/Forward navigation, settings, popup, channel exclusions, and real overlay Undo. It writes screenshots and a JSON report to `test-results/`. Its media element has a deterministic test clock; this does not establish compatibility with every current live YouTube experiment.

For release acceptance, also manually exercise real YouTube: a known SponsorBlock video, a captioned unknown video, unavailable captions, an ordinary pre-roll/mid-roll ad, speed changes, seeking into/past a sponsor, playlist navigation, Back/Forward, a premiere, a live stream, and replacing/reloading the tab. Check the extension error list and compare Chrome Task Manager with and without the extension. YouTube can require extra tokens for captions or omit tracks/heatmaps for an account; these situations intentionally produce no local skip. Live-site behavior cannot be guaranteed by synthetic tests.

Enable **Settings → Developer settings → Debug console output** to see `[SKIPPER]` video IDs, selected SponsorBlock intervals, local evidence tables, scores, boundaries and decisions. No transcript is logged. Disable it again after tuning.

## Chrome Web Store build

```sh
npm ci
npm run package
```

This runs checks, creates `dist/`, then produces `release/sponsor-skipper-1.0.1.zip` with the manifest at the archive root. The package script requires the standard `zip` utility (available on macOS/Linux; Windows users can use WSL). Files are sorted and timestamps normalized so rebuilding from the same lockfile/toolchain is reproducible. Only bundled extension resources are included, with no tests, node_modules, secrets, or source maps.

Upload the ZIP through your Chrome Web Store developer dashboard, supply screenshots and a privacy-policy URL based on `PRIVACY.md`, describe the single purpose and the permission justifications above, and complete the store's current data-use disclosures accurately. The extension itself has no signup or fees; publishing through Google's developer program is separate. This project does not create an account or publish automatically. Follow the current [Chrome Web Store publishing guide](https://developer.chrome.com/docs/webstore/publish).

## Attribution

This extension's own source is released under the [MIT License](LICENSE).

Sponsor timestamps are provided by [SponsorBlock](https://sponsor.ajay.app/) contributors under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/); see the [database/API license](https://github.com/ajayyy/SponsorBlock/wiki/Database-and-API-License). This extension normalizes and merges overlapping returned intervals locally. It is an independent client, not an official SponsorBlock release. No SponsorBlock extension source is bundled. Local detector results are never contributed automatically; a future contribution feature would need a separate explicit user-confirmed write adapter.
