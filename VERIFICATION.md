# Verification record

Version 1.0.0 validated with Node.js 22.14.0.

| Check | Result |
| --- | --- |
| Strict TypeScript, unused symbols, module resolution | Passed |
| Unit tests | 34 passed, 0 failed |
| MV3 bundle and required resources | Passed; no runtime dependencies |
| Chromium 140.0.7339.186 unpacked integration | 27 checks passed, no uncaught page/UI errors |
| Popup, options, and closed-shadow Undo UI | Rendered and exercised in Chromium |
| Archive contents | 12 extension resources, manifest at ZIP root |
| Reproducibility | Rebuilt and repackaged; SHA-256 identical |
| Installed Google Chrome 153.0.8010.48 automated load | Not verified: CDP `Extensions.loadUnpacked` returned `Method not available` |
| Public YouTube smoke in Chromium | Loaded “Me at the zoo”; matched video and channel metadata; no sponsors found; unavailable captions safely produced no local skip |

Reproducible release SHA-256:

```text
a77038338a6393bea414062dba79fc84a90a24d835ee1200116e2164653b68aa
```

Artifacts generated locally:

- `dist/`: unpacked extension.
- `release/sponsor-skipper-1.0.0.zip`: current distributable archive.
- `test-results/browser-report.json`: named integration checks.
- `test-results/chrome-report.json`: installed Chrome limitation and live smoke result.
- `test-results/skip-toast.png`, `options.png`, `popup.png`, `live-youtube.png`: browser screenshots.

The integration fixture uses real extension worlds, service-worker messages, storage, and UI with a synthetic video clock and deterministic network responses. It covers known segments, overlap merging, API failure fallback, absent captions, automatic seeking, Undo, ad classes, replacement video elements, SPA/Back/Forward/playlist navigation, Shorts and live exclusions, options, popup messaging without `tabs`, and channel exclusions.

These results do **not** establish accuracy on a labeled real-world sponsor corpus, guarantee access to current YouTube caption experiments, or verify a real pre-roll/mid-roll ad and embedded-sponsor skip in installed branded Chrome. Manual Chrome loading and the live-playback acceptance matrix in README.md remain necessary before a public release. No Web Store upload or publication was performed.

## Reported video: EaJFv8v0tQg

The user reported a sponsor at approximately 4:35–5:50. Real SponsorBlock lookup returned `[271.144, 346.653]` with video duration `1001.501`; the extension accepted it. Starting real YouTube playback at 269 seconds produced an automatic `seeking` event at **346.753**, the expected end plus epsilon. The headless browser subsequently buffered and encountered network errors; uninterrupted post-skip playback was not verified. The cause of the user's specific tab failure is still unconfirmed without its popup status.

The popup reports a disconnected content script instead of a misleading “Ready when you are” state, shows live status and intervals, and provides explicit cache retry/reinitialization. Regression checks verify disconnected-tab guidance, displayed intervals, retry lookup, and ad-wait diagnostics. The per-video diagnostic is saved in `test-results/EaJFv8v0tQg-diagnostic.json`; no video-specific timestamps are added to production skipping logic.
