import type { Preferences } from '../lib/types';
import { getPreferences, updatePreferences } from '../storage/preferences';

export function announce(text: string): void {
  const status = document.getElementById('save-status');
  if (status) status.textContent = text;
}
export async function bindSettings(): Promise<void> {
  const preferences = await getPreferences();
  for (const input of document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-pref]')) {
    const key = input.dataset.pref as keyof Preferences;
    if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = preferences[key] === true;
    else input.value = String(preferences[key]);
    input.addEventListener('change', async () => {
      input.disabled = true;
      try {
        const value = input instanceof HTMLInputElement && input.type === 'checkbox' ? input.checked : input.value;
        await updatePreferences({ [key]: value });
        announce('Saved on this device.');
      } catch { announce('Could not save. Please try again.'); }
      finally { input.disabled = false; }
    });
  }
}
