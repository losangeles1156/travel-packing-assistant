/** Read every legacy list key, including entries orphaned from the old five-list index.
 * Secrets, analytics identifiers and administrator settings are deliberately excluded. */
export function buildLegacyBackup(storage: Storage, now = new Date()) {
  const data: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key || !(key.startsWith('tpa_list_v1_') || key === 'tpa_lists_index_v1' || key === 'tpa_lists_active_v1' || key === 'tpa_trip_details')) continue;
    const value = storage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return { format: 'travel-packing-legacy-backup', version: 1, exportedAt: now.toISOString(), count: Object.keys(data).filter(k => k.startsWith('tpa_list_v1_')).length, data };
}
