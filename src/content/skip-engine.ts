import type { Preferences, SponsorSegment } from '../lib/types';
import { LIMITS } from '../detection/rules';

export interface SkipEvent { segment: SponsorSegment; previousTime: number; undo: () => void }
export interface SkipUI {
  skipped(event: SkipEvent): void;
  suggest(segment: SponsorSegment | null, skip: (target?: number) => void): void;
}
/** One event-driven clock, with a one-shot timer for the next segment boundary. */
export class SkipEngine {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly ignored: Set<string>;
  private readonly listeners = ['timeupdate', 'play', 'pause', 'seeking', 'seeked', 'ratechange', 'loadedmetadata', 'durationchange', 'ended', 'emptied'];
  private disposed = false;
  private undoGeneration = 0;
  private segments: SponsorSegment[];
  constructor(
    private video: HTMLVideoElement,
    segments: SponsorSegment[],
    private preferences: Preferences,
    private safe: () => boolean,
    private ui: SkipUI,
    ignored = new Set<string>(),
  ) {
    this.ignored = ignored;
    this.segments = [...segments].sort((a, b) => a.start - b.start);
    for (const event of this.listeners) video.addEventListener(event, this.tick);
    this.tick();
  }
  private auto(segment: SponsorSegment): boolean {
    return segment.decision === 'auto' && (segment.source === 'sponsorblock' ? this.preferences.autoSkipKnown : this.preferences.autoSkipLocal);
  }
  private valid(segment: SponsorSegment): boolean {
    return !this.ignored.has(segment.id) && segment.start < this.video.duration
      && (segment.end === null || segment.end <= this.video.duration + 0.25)
      && (!segment.videoDuration || Math.abs(segment.videoDuration - this.video.duration) <= 2);
  }
  tick = (): void => {
    clearTimeout(this.timer);
    if (this.disposed || !this.preferences.enabled || !this.safe() || this.video.ended || this.video.seeking) {
      this.ui.suggest(null, () => {});
      return;
    }
    const time = this.video.currentTime;
    const active = this.segments.find(s => this.valid(s) && time >= s.start && time < (s.end ?? s.start + LIMITS.absoluteMax));
    if (active) {
      if (this.auto(active) && active.end !== null && !this.video.paused) {
        this.skip(active, active.end);
        return;
      }
      if (this.preferences.showSuspected) this.ui.suggest(active, target => {
        const end = active.end ?? target;
        if (end !== undefined && end !== null) this.skip(active, end);
      });
      else this.ui.suggest(null, () => {});
    } else this.ui.suggest(null, () => {});
    if (this.video.paused || this.video.playbackRate <= 0) return;
    const next = this.segments.find(s => this.valid(s) && s.start > time);
    if (next) this.timer = setTimeout(this.tick, Math.min(2147483647, Math.max(20, ((next.start - time) / this.video.playbackRate) * 1000)));
  };
  private skip(segment: SponsorSegment, end: number): void {
    if (this.disposed || !this.safe() || !this.valid(segment) || !Number.isFinite(end) || end <= this.video.currentTime || end > this.video.duration) return;
    const previousTime = this.video.currentTime;
    const target = Math.min(end + LIMITS.epsilon, this.video.duration);
    // Do not seek into an unloaded/unseekable part of a stream.
    let seekable = false;
    for (let i = 0; i < this.video.seekable.length; i++) {
      if (target >= this.video.seekable.start(i) && target <= this.video.seekable.end(i)) seekable = true;
    }
    if (!seekable) return;
    try { this.video.currentTime = target; } catch { return; }
    this.ignored.add(segment.id);
    this.ui.suggest(null, () => {});
    const until = Date.now() + LIMITS.undoMs;
    const generation = ++this.undoGeneration;
    this.ui.skipped({ segment, previousTime, undo: () => {
      if (this.disposed || generation !== this.undoGeneration || Date.now() > until || !this.safe()) return;
      this.undoGeneration++;
      // Keep this segment ignored for this visit, including video element replacements.
      this.video.currentTime = segment.start;
      this.tick();
    } });
    this.tick();
  }
  dispose(): void {
    this.disposed = true;
    this.undoGeneration++;
    clearTimeout(this.timer);
    for (const event of this.listeners) this.video.removeEventListener(event, this.tick);
    this.ui.suggest(null, () => {});
  }
}
