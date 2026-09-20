import { isRecord, type Preferences } from '../lib/types';

export const DEFAULTS: Preferences = {
  enabled: true, sponsorBlock: true, localFallback: true,
  autoSkipKnown: true, autoSkipLocal: true, showSuspected: true,
  useHeatmap: true, showNotifications: true, mode: 'conservative',
  debug: false, excludedChannels: {},
};
export function sanitizePreferences(value: unknown): Preferences {
  const p = { ...DEFAULTS, excludedChannels: {} } as Preferences;
  if (!isRecord(value)) return p;
  for (const key of Object.keys(DEFAULTS) as (keyof Preferences)[]) {
    if (typeof DEFAULTS[key] === 'boolean' && typeof value[key] === 'boolean') {
      Object.assign(p, { [key]: value[key] });
    }
  }
  if (['conservative', 'balanced', 'aggressive'].includes(String(value.mode))) p.mode = value.mode as Preferences['mode'];
  if (isRecord(value.excludedChannels)) {
    for (const [id, mode] of Object.entries(value.excludedChannels).slice(0, 2000)) {
      if (/^UC[\w-]{22}$/.test(id) && (mode === 'all' || mode === 'local')) p.excludedChannels[id] = mode;
    }
  }
  return p;
}
export async function getPreferences(): Promise<Preferences> {
  return sanitizePreferences((await chrome.storage.local.get('preferences')).preferences);
}
export async function updatePreferences(patch: Partial<Preferences>): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'preferences:update', patch });
  if (!response?.ok) throw new Error('Unable to save preferences');
}
