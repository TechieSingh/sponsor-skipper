# Sponsor Skipper privacy

Sponsor Skipper has no account, analytics, telemetry, fingerprinting, advertising, monetization, or model APIs. It does not collect browsing history or upload transcripts. There is no developer-operated server. It never submits, votes on, or reports viewing of SponsorBlock segments.

## Network access

- **SponsorBlock:** one read-only lookup per video initialization when enabled and a fresh cache result is unavailable. The request uses the first four hexadecimal characters of the video's SHA-256 hash, plus sponsor/skip filters. The full video ID, channel, title, captions, cookies, and referrer are not sent. SponsorBlock still sees normal network information, including your IP address. Hash-prefix lookup reduces disclosure; it is not anonymity. Its response may include several candidate video IDs; matching happens locally. Concurrent lookups share one request. An in-flight lookup can finish after navigation or disabling; its result will not control the old player.
- **YouTube:** if fallback is needed, one available English caption track is fetched from `https://www.youtube.com/api/timedtext`. It uses the current page's signed caption URL and ordinary same-origin session credentials. YouTube therefore sees its own caption request. No translation, transcript scraping service, proxy, model, or third-party caption endpoint is used. Caption visibility does not have to be enabled in the player.
- **Heatmap:** only metadata already present on the page is inspected. No additional heatmap request occurs.

## Device storage

`chrome.storage.local` contains preferences, channel IDs explicitly excluded by the user, and at most 150 cached video entries. Each cache entry contains a video ID, sponsor times and rule evidence, timestamps, and schema/detector settings. No captions, titles, watch timestamps, playback statistics, or watch-history log are stored. The segment cache necessarily identifies recently queried videos; it is a bounded performance cache, not anonymous data.

Positive SponsorBlock entries are reused for seven days, empty results for one hour, failures for five minutes, and local results for one day. Expired entries are ignored and storage is pruned during subsequent cache operations; expiration is not a promise of deletion while the extension is idle. Settings → Clear local segment cache deletes stored entries. A lookup already in flight may subsequently repopulate its result. Uninstalling removes extension storage. Preferences are not synced to an account.

Debug mode is off by default. When enabled it prints video IDs, segment times, evidence scores, and decisions to the local developer console. It never transmits logs. Captions exist transiently in memory and are released after detection.

## Permissions

The only API permission is `storage`. SponsorBlock has a narrowly scoped host permission. Static content scripts run on `https://www.youtube.com/*` so they can detect navigation from a YouTube homepage to a watch page. They act only on standard `/watch` videos. No `tabs`, `history`, `webRequest`, `declarativeNetRequest`, `scripting`, account, or broad host permission is requested.

YouTube's own advertising and data processing, and SponsorBlock's server practices, are controlled by those services. This document describes this extension's behavior.
