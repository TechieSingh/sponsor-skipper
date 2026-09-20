import test from 'node:test';
import assert from 'node:assert/strict';
import { SkipEngine, type SkipEvent, type SkipUI } from '../src/content/skip-engine';
import { DEFAULTS } from '../src/storage/preferences';
import type { SponsorSegment } from '../src/lib/types';

class Video extends EventTarget {
  currentTime = 0; duration = 300; paused = false; seeking = false; ended = false; playbackRate = 1;
  seekable = { length: 1, start: () => 0, end: () => this.duration };
  emit(event = 'timeupdate') { this.dispatchEvent(new Event(event)); }
}
const segment = (start = 10, end: number | null = 30): SponsorSegment => ({ id: `${start}:${end}`, start, end, source: 'sponsorblock', decision: 'auto', score: 100, evidence: [], boundary: 'known' });
function setup(segments = [segment()], safe = () => true, p = DEFAULTS) {
  const video = new Video();
  const events: SkipEvent[] = [];
  let suggestion: SponsorSegment | null = null;
  const ui: SkipUI = { skipped: event => events.push(event), suggest: s => { suggestion = s; } };
  const engine = new SkipEngine(video as unknown as HTMLVideoElement, segments, p, safe, ui);
  return { video, engine, events, get suggestion() { return suggestion; } };
}
test('seeking into sponsor skips to end plus epsilon, undo does not retrigger', () => {
  const s = setup();
  try {
    s.video.currentTime = 17; s.video.emit();
    assert.equal(s.video.currentTime, 30.1); assert.equal(s.events[0]?.previousTime, 17);
    s.events[0]?.undo(); assert.equal(s.video.currentTime, 10);
    s.video.emit(); assert.equal(s.events.length, 1); assert.equal(s.video.currentTime, 10);
  } finally { s.engine.dispose(); }
});
test('seek past segment, paused playback, and active seek do not trigger', () => {
  for (const state of [{ currentTime: 31 }, { currentTime: 15, paused: true }, { currentTime: 15, seeking: true }]) {
    const s = setup();
    try { Object.assign(s.video, state); s.video.emit(); assert.equal(s.events.length, 0); } finally { s.engine.dispose(); }
  }
});
test('unsafe ad/live/player state blocks both automatic skips and undo', () => {
  let safe = false;
  const s = setup([segment()], () => safe);
  try {
    s.video.currentTime = 15; s.video.emit(); assert.equal(s.video.currentTime, 15);
    safe = true; s.video.emit(); assert.equal(s.video.currentTime, 30.1);
    safe = false; s.events[0]?.undo(); assert.equal(s.video.currentTime, 30.1);
  } finally { s.engine.dispose(); }
});
test('unknown end and disabled automatic preference only suggest', () => {
  for (const [segments, p] of [[[segment(10, null)], DEFAULTS], [[segment()], { ...DEFAULTS, autoSkipKnown: false }]] as const) {
    const s = setup([...segments], () => true, p);
    try { s.video.currentTime = 15; s.video.emit(); assert.equal(s.events.length, 0); assert.ok(s.suggestion); } finally { s.engine.dispose(); }
  }
});
test('duration mismatch and out-of-range segments fail closed', () => {
  const s = setup([{ ...segment(), videoDuration: 400 }, segment(30, 400)]);
  try { s.video.currentTime = 15; s.video.emit(); assert.equal(s.events.length, 0); s.video.currentTime = 35; s.video.emit(); assert.equal(s.events.length, 0); } finally { s.engine.dispose(); }
});
test('multiple segments skip independently; disposal removes listeners and invalidates undo', () => {
  const s = setup([segment(), segment(50, 70)]);
  s.video.currentTime = 10; s.video.emit(); s.video.currentTime = 55; s.video.emit();
  assert.equal(s.events.length, 2); s.engine.dispose();
  s.events[1]?.undo(); assert.equal(s.video.currentTime, 70.1);
  s.video.currentTime = 10; s.video.emit(); assert.equal(s.events.length, 2);
});
test('playback speed changes reschedule the one-shot timer', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const s = setup();
  try {
    s.video.currentTime = 5; s.video.playbackRate = 2; s.video.emit('ratechange');
    t.mock.timers.tick(2499); assert.equal(s.events.length, 0);
    s.video.currentTime = 10; t.mock.timers.tick(1); assert.equal(s.video.currentTime, 30.1);
  } finally { s.engine.dispose(); t.mock.timers.reset(); }
});
test('Undo expires after seven seconds and cannot rewind later playback', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const s = setup();
  try {
    s.video.currentTime = 15; s.video.emit();
    t.mock.timers.tick(7001);
    s.events[0]?.undo(); assert.equal(s.video.currentTime, 30.1);
  } finally { s.engine.dispose(); t.mock.timers.reset(); }
});
