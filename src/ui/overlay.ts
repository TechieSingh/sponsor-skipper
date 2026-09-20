import type { Preferences, SponsorSegment } from '../lib/types';
import type { SkipEvent, SkipUI } from '../content/skip-engine';
import { LIMITS } from '../detection/rules';

export class Overlay implements SkipUI {
  private host = document.createElement('div');
  private shadow = this.host.attachShadow({ mode: 'closed' });
  private toast = document.createElement('div');
  private suggestion = document.createElement('div');
  private timer: ReturnType<typeof setTimeout> | undefined;
  private current: string | null = null;
  constructor(private player: HTMLElement, private preferences: Preferences, private video: HTMLVideoElement) {
    this.host.setAttribute('data-sponsor-skipper', '');
    const style = document.createElement('style');
    style.textContent = `:host{position:absolute!important;bottom:76px!important;left:18px!important;z-index:2147483646!important;max-width:calc(100% - 36px)!important;pointer-events:none!important;font:13px/1.5 system-ui,sans-serif!important;color:#fff!important} .card{display:flex;align-items:center;flex-wrap:wrap;gap:12px;background:#172522f5;border:1px solid #4a796c;border-radius:10px;padding:10px 14px;margin-top:8px;box-shadow:0 4px 18px #0004;pointer-events:auto} .card:empty{display:none}button{font:inherit;color:#adf5d7;background:transparent;border:0;cursor:pointer;padding:3px 4px}button:hover{text-decoration:underline}button:focus-visible,input:focus-visible{outline:2px solid #adf5d7;outline-offset:3px}input{width:80px;background:#fff;color:#15221c;border:0;border-radius:4px;padding:5px;font:inherit}label{display:flex;gap:8px;align-items:center}small{flex-basis:100%;color:#ddd}`;
    this.toast.className = 'card';
    this.toast.setAttribute('role', 'status');
    this.suggestion.className = 'card';
    this.shadow.append(style, this.toast, this.suggestion);
    player.append(this.host);
  }
  private button(label: string, click: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = label;
    button.addEventListener('click', click);
    return button;
  }
  skipped(event: SkipEvent): void {
    clearTimeout(this.timer);
    if (!this.preferences.showNotifications) return;
    this.toast.replaceChildren(document.createTextNode('Skipped sponsor •'), this.button('Undo', () => { event.undo(); this.toast.replaceChildren(); }));
    this.timer = setTimeout(() => this.toast.replaceChildren(), LIMITS.undoMs);
  }
  suggest(segment: SponsorSegment | null, skip: (target?: number) => void): void {
    if (this.current === (segment?.id ?? null)) return;
    this.current = segment?.id ?? null;
    this.suggestion.replaceChildren();
    if (!segment) return;
    this.suggestion.append(this.button(segment.source === 'sponsorblock' ? 'Skip sponsor' : 'Skip suspected sponsor', () => {
      if (segment.end !== null) { skip(); return; }
      const label = document.createElement('label');
      label.textContent = 'Seek forward (seconds)';
      const input = document.createElement('input');
      input.type = 'number'; input.min = '1'; input.max = String(Math.floor(this.video.duration - this.video.currentTime)); input.required = true;
      label.append(input);
      const note = document.createElement('small');
      note.textContent = 'Sponsor end is uncertain. Choose how far to seek.';
      this.suggestion.replaceChildren(note, label, this.button('Seek', () => {
        if (input.reportValidity() && input.valueAsNumber > 0) skip(this.video.currentTime + input.valueAsNumber);
      }));
      input.focus();
    }));
  }
  dispose(): void { clearTimeout(this.timer); this.host.remove(); this.current = null; }
  ensureAttached(): void { if (!this.host.isConnected) this.player.append(this.host); }
}
