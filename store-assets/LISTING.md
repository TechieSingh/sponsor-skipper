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

**Single purpose description**

> Sponsor Skipper has one purpose: to locate creator-read sponsorship segments inside a YouTube video and move the playback position past them. Every feature — the SponsorBlock lookup, the local caption rules, the popup, and the settings page — exists to serve that single skipping function.

**Permission justifications**

- `storage` — Stores the user's preferences, the list of channels they chose to exclude, and a bounded 150-entry cache of previously computed sponsor segment times, so the extension does not repeat the same lookup and detection work on every replay. All of it stays on the device; nothing is synced to an account.
- Host permission `https://sponsor.ajay.app/*` — Required to make the cross-origin read-only request to the SponsorBlock API that returns community-submitted sponsor segment timestamps. The request is a GET to the privacy-preserving hash-prefix endpoint, sends no cookies or referrer, and the extension never writes to or submits anything to that service.
- Host permission `https://www.youtube.com/*` (content script match) — Required to detect single-page navigation into a watch page from anywhere on YouTube, read the public player metadata needed to identify the video and its duration, fetch the video's own caption track same-origin when the local fallback runs, and set the playback position to skip a sponsor segment.
- Remote code — Not used. All JavaScript is bundled in the package.

**Data usage disclosures** — tick nothing in the collected-data list, then certify all three statements. Sponsor Skipper does not collect or transmit personally identifiable information, health information, financial information, authentication information, personal communications, location, web history, or user activity to the developer or any third party. There is no developer-operated server.

**Privacy policy URL:** `https://github.com/TechieSingh/sponsor-skipper/blob/main/PRIVACY.md`

This field is mandatory. The repo must be **public** for Google to reach it.

---

## Before you can submit

1. **Repo must be public** — otherwise the privacy policy and support URLs 404 for reviewers.
2. **Upload the package.** `npm run package` produces `release/sponsor-skipper-1.0.0.zip`.
