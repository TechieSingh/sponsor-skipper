import { announce, bindSettings } from '../ui/settings';
import { getPreferences } from '../storage/preferences';

async function renderChannels(): Promise<void> {
  const p = await getPreferences();
  const list = document.getElementById('exclusions')!;
  list.replaceChildren();
  for (const [channelId, mode] of Object.entries(p.excludedChannels)) {
    const row = document.createElement('li');
    const link = document.createElement('a');
    link.href = `https://www.youtube.com/channel/${channelId}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = channelId;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Remove';
    button.addEventListener('click', async () => {
      const result = await chrome.runtime.sendMessage({ type: 'channel:update', channelId, mode: 'enabled' });
      if (result?.ok) { await renderChannels(); announce('Channel enabled.'); }
      else announce('Unable to update channel.');
    });
    row.append(link, document.createTextNode(mode === 'all' ? ' — disabled ' : ' — local fallback off '), button);
    list.append(row);
  }
  if (!list.children.length) list.textContent = 'No channel exclusions. Use the popup while watching a video to add one.';
}
void bindSettings().then(renderChannels).catch(() => announce('Unable to load preferences.'));
document.getElementById('clear-cache')!.addEventListener('click', async () => {
  try {
    const result = await chrome.runtime.sendMessage({ type: 'cache:clear' });
    announce(result?.ok ? 'Local cache cleared. Reload the video to look up segments again.' : 'Unable to clear cache.');
  } catch { announce('Unable to clear cache.'); }
});
