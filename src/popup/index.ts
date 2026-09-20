import { bindSettings, announce } from '../ui/settings';
import { getPreferences } from '../storage/preferences';
import type { VideoStatus } from '../lib/types';

const clock = (time: number) => Math.floor(time / 60) + ':' + String(Math.floor(time % 60)).padStart(2, '0');
async function initialize(): Promise<void> {
  await bindSettings();
  document.getElementById('options')!.addEventListener('click', () => { void chrome.runtime.openOptionsPage(); });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return;
  const tabId = tab.id;
  const reload = document.getElementById('reload-tab') as HTMLButtonElement;
  const retry = document.getElementById('retry-video') as HTMLButtonElement;
  const select = document.getElementById('channel-mode') as HTMLSelectElement;
  let current: VideoStatus | null = null;
  let channelId = '';
  let refreshing = false;
  reload.addEventListener('click', async () => {
    try { await chrome.tabs.reload(tabId); window.close(); }
    catch { announce('Unable to reload this tab. Refresh YouTube manually.'); }
  });
  retry.addEventListener('click', async () => {
    if (!current?.videoId) return;
    retry.disabled = true;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'cache:invalidate', videoId: current.videoId });
      if (!result?.ok) throw new Error('Cache reset failed');
      await chrome.tabs.sendMessage(tabId, { type: 'video:refresh' });
      announce('Checking this video again.');
      await refresh();
    } catch { announce('Could not reconnect. Reload the YouTube tab.'); reload.hidden = false; }
    finally { retry.disabled = false; }
  });
  select.addEventListener('change', async () => {
    if (!channelId) return;
    select.disabled = true;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'channel:update', channelId, mode: select.value });
      announce(result?.ok ? 'Channel preference saved.' : 'Unable to save.');
    } catch { announce('Unable to save.'); }
    finally { select.disabled = false; }
  });
  async function refresh(): Promise<void> {
    if (refreshing) return;
    refreshing = true;
    try {
      current = await chrome.tabs.sendMessage(tabId, { type: 'video:status' }) as VideoStatus;
      if (!current) throw new Error('No content script');
      reload.hidden = true;
      retry.hidden = !current.videoId;
      document.getElementById('video-status')!.textContent = current.message;
      document.getElementById('playback-status')!.textContent = current.playbackMessage ?? '';
      document.getElementById('segment-ranges')!.textContent = (current.ranges ?? []).slice(0, 6).map(s => (s.source === 'sponsorblock' ? 'SponsorBlock' : 'Local') + ': ' + clock(s.start) + '–' + (s.end === null ? 'end unknown' : clock(s.end))).join(' • ');
      const count = current.known + current.local;
      document.getElementById('segment-count')!.textContent = current.videoId ? count + ' sponsor segment' + (count === 1 ? '' : 's') + ' found' + (current.suspected ? ' • ' + current.suspected + ' suspected' : '') : 'Open a YouTube watch video';
      document.getElementById('channel-section')!.hidden = !current.channelId;
      if (current.channelId !== channelId) {
        channelId = current.channelId;
        document.getElementById('channel-name')!.textContent = current.channelName || 'This channel';
        select.value = (await getPreferences()).excludedChannels[channelId] ?? 'enabled';
      }
    } catch {
      current = null;
      document.getElementById('segment-count')!.textContent = 'Not connected to this tab';
      document.getElementById('video-status')!.textContent = 'On YouTube? Reload the video tab after installing or updating Sponsor Skipper.';
      document.getElementById('playback-status')!.textContent = '';
      document.getElementById('segment-ranges')!.textContent = '';
      document.getElementById('channel-section')!.hidden = true;
      reload.hidden = false; retry.hidden = true;
    } finally { refreshing = false; }
  }
  await refresh();
  // Only while the popup is open; reads state without polling SponsorBlock.
  const timer = setInterval(() => { void refresh(); }, 1000);
  window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
}
void initialize().catch(() => announce('Unable to load preferences.'));
