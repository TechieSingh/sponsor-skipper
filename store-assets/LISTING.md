# Chrome Web Store listing — Sponsor Skipper 1.0.0

Copy-paste source for the Store listing and Privacy tabs.
Graphics live alongside this file in `store-assets/`.

---

## Store listing tab

**Title** — from package, not editable here: `Sponsor Skipper`

**Summary** — from package (manifest `description`), not editable here:
`Skip embedded creator sponsorships using SponsorBlock and private, local caption rules. No AI or tracking.`

**Category:** Functionality & UI
(Alternative if you prefer discovery among YouTube viewers: Entertainment.)

**Language:** English (United States) — the UI and the local caption rules are English-only.

**Mature content:** No

---

### Description

Paste everything between the rules below. Plain text; the Store does not render Markdown.

---

Sponsor Skipper skips the sponsor reads baked into YouTube videos — the "this part of the video is brought to you by…" segments the creator recorded — so you get back to the content you came for.

PLEASE READ FIRST: THIS IS NOT AN AD BLOCKER
Sponsor Skipper does not block, hide, skip, or interfere with YouTube's own advertising. It declares no ad-blocking or network-interception permissions. It only moves the playback position past sponsor segments that are part of the creator's uploaded video.

HOW IT FINDS SPONSORS

1. SponsorBlock first.
For each video it makes one read-only lookup to the SponsorBlock community database and uses only "sponsor" segments marked as skippable. Overlapping segments are merged. Responses whose timestamps do not match the video are rejected.

2. Private local caption rules as a fallback.
If SponsorBlock has nothing for the video, or you have it turned off, Sponsor Skipper reads the video's own English captions and applies a fixed set of rules on your device. There is no AI, no model API, and no transcript ever leaves your browser.

A local match has to clear a high bar before anything is skipped automatically: an explicit sponsor opening, several distinct commercial signals nearby, a clear return-to-content phrase, a sufficient score, and a sensible 8–120 second length. If the ending is not clear, you get a suggestion you can act on yourself instead of a silent jump.

YOU STAY IN CONTROL

• Every skip shows a notification with Undo for seven seconds. Undo takes you right back to the start of the segment.
• Per-channel settings: enabled, disabled, or SponsorBlock-only for creators whose reads you actually want to hear.
• Turn off automatic skipping entirely and keep only the manual suggestion button.
• Three detection modes — Conservative (default), Balanced, Aggressive. Conservative favours precision: it would rather miss a sponsor than cut into the video.
• A single global switch pauses all lookups, detection, and skipping.
• "Check again" re-runs detection for the current video on demand.

PRIVACY

• No accounts, no sign-up, no analytics, no telemetry, no fingerprinting, no advertising, no monetisation.
• No developer-operated server exists. Nothing is sent anywhere the extension does not have to reach.
• SponsorBlock lookups send only the first four characters of the video ID's SHA-256 hash — not the video ID, channel, title, or captions — with no cookies and no referrer. Matching happens on your device. SponsorBlock still sees ordinary network information such as your IP address, as any web request does.
• Captions are fetched directly from YouTube, which already knows what you are watching. No proxy, translation service, or third-party caption endpoint is involved.
• Stored locally: your preferences, channels you explicitly excluded, and a capped 150-entry segment cache. No transcripts, no titles, no watch history. Clear it any time from Settings.
• Sponsor Skipper never submits, votes on, or reports anything to SponsorBlock.

PERMISSIONS, AND WHY EACH ONE EXISTS

• storage — keep your settings, channel exclusions, and the segment cache on this device.
• sponsor.ajay.app — the read-only SponsorBlock lookup. Nothing else is contacted.
• youtube.com — notice when you navigate to a video, read the public player metadata, fetch captions, and move the playback position.

It does not request tabs, history, webRequest, declarativeNetRequest, scripting, or broad host access.

SCOPE AND HONEST LIMITS

• Standard youtube.com/watch pages only. Shorts, embeds, and the mobile site are not covered in this version.
• Local rules need English captions. Videos without them fall back to SponsorBlock alone.
• Rule-based detection is not perfect. It can miss a sponsor, and it can occasionally react to marketing language inside the content itself. Conservative mode and the Undo button exist for exactly that reason.
• Skipping is suspended during YouTube ads, live streams, premieres, and any state where the player's timeline cannot be trusted.
• Sponsor timing scores are deterministic rule outputs, not calibrated probabilities.

Free and open source under the MIT licence, Manifest V3, no remote code. All JavaScript ships inside the package, and you can read every line of it.

Sponsor timestamps come from SponsorBlock contributors, licensed CC BY-NC-SA 4.0. Sponsor Skipper is an independent client and is not an official SponsorBlock release, nor is it affiliated with or endorsed by YouTube or Google.

---

### Graphic assets

| Slot | File | Size |
| --- | --- | --- |
| Store icon | `store-icon-128.png` | 128×128 |
| Screenshot 1 | `screenshot-1-skip.png` | 1280×800 |
| Screenshot 2 | `screenshot-2-popup.png` | 1280×800 |
| Screenshot 3 | `screenshot-3-fallback.png` | 1280×800 |
| Screenshot 4 | `screenshot-4-privacy.png` | 1280×800 |
| Screenshot 5 | `screenshot-5-settings.png` | 1280×800 |
| Small promo tile | `promo-small-440x280.png` | 440×280 |
| Marquee promo tile | `promo-marquee-1400x560.png` | 1400×560 |

All are 24-bit PNG with no alpha channel. Regenerate with `node scripts/store-assets.mjs`.

Global promo video: leave blank.

---

### Additional fields

**Official URL:** None — leave as is unless you verify a domain in Google Search Console.

**Homepage URL:** `https://github.com/TechieSingh/sponsor-skipper`

**Support URL:** `https://github.com/TechieSingh/sponsor-skipper/issues`

**Item support / visibility:** turn item support on so the Support URL is shown.

---

## Privacy tab

Paste each block verbatim. All four fit the 1,000-character limit.

### Single purpose description  (773 chars)

```text
Sponsor Skipper has one narrow purpose: to locate creator-read sponsorship segments inside a YouTube video and move the playback position past them.

Every feature serves that one function. It looks up community-submitted sponsor timestamps from SponsorBlock, and when none exist it applies a fixed set of English caption rules on the user's device to locate the segment. The popup reports what was found for the current video and lets the user undo a skip, disable skipping for a channel, or re-run detection. The options page exposes the same controls plus detection sensitivity and a cache reset.

It does not block, hide, or alter YouTube's own advertising. It does not modify page layout, inject content, or provide any feature unrelated to skipping sponsor segments.
```

### "storage" justification  (871 chars)

```text
The "storage" permission is used with chrome.storage.local to keep three things on the user's own device:

1. Preferences - whether skipping is enabled, whether the SponsorBlock lookup and the local caption fallback are each on, detection sensitivity, and notification settings.

2. Channel exclusions - the list of YouTube channels the user has explicitly chosen to disable or restrict.

3. A bounded segment cache - at most 150 entries mapping a video ID to previously computed sponsor start and end times, so the extension does not repeat the same network lookup and caption analysis every time a video is replayed.

Without this permission every setting would reset on each page load, and each replay would trigger a fresh SponsorBlock request. Nothing held in storage is transmitted anywhere, and none of it is synced to an account: chrome.storage.sync is not used.
```

### Host permission justification  (926 chars)

Covers both hosts, since the form has a single field for them.

```text
Two host permissions are required.

https://sponsor.ajay.app/* - the primary source of sponsor timestamps. The service worker makes one read-only GET per video to the SponsorBlock API. It uses the privacy-preserving hash-prefix endpoint: only the first four characters of the video ID's SHA-256 hash are sent, never the video ID, channel, title, or captions. No cookies and no referrer are sent, and the extension never writes, votes, or submits anything to that service. Matching the response to the actual video happens locally.

https://www.youtube.com/* - declared as a content_scripts match so the extension can detect single-page navigation into a watch page from anywhere on YouTube, read the public player metadata needed to identify the video and its duration, fetch the video's own caption track same-origin when the local fallback runs, and set currentTime to skip a segment. It acts only on standard /watch pages.
```

### Remote code

Select **"No, I am not using Remote code"**, then paste (414 chars):

```text
All JavaScript is bundled into the package at build time with esbuild. The extension has no runtime dependencies, loads no external scripts or modules, and does not use eval(), new Function(), or remotely hosted WebAssembly. The manifest sets content_security_policy to "script-src 'self'; object-src 'none'". Network requests retrieve data only - JSON sponsor timestamps and caption text - never executable code.
```

### Data usage

Tick **none** of the nine data categories. Nothing is transmitted to the developer
(there is no developer server) or to any third party in identifiable form.

Then certify **all three** statements — each is true:

- Does not sell or transfer user data to third parties.
- Does not use or transfer user data for purposes unrelated to the single purpose.
- Does not use or transfer user data for creditworthiness or lending.

### Privacy policy URL

```text
https://github.com/TechieSingh/sponsor-skipper/blob/main/PRIVACY.md
```

---

## Before you can submit

1. **Repo must be public** — otherwise the privacy policy and support URLs 404 for reviewers.
2. **Upload the package.** `npm run package` produces `release/sponsor-skipper-1.0.0.zip`.
