/** Remove matching legacy keys only. Throws if the legacy index is corrupted. */
export function removeLegacyData(storage: Storage, id?: string): void {
  const indexKey = 'tpa_lists_index_v1';
  const activeKey = 'tpa_lists_active_v1';
  const raw = storage.getItem(indexKey);
  let index: unknown[] = [];
  if (raw) {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some(x => !x || typeof x !== 'object' || typeof (x as {id?: unknown}).id !== 'string')) throw new Error('舊清單索引損壞，無法安全刪除');
    index = parsed;
  }
  if (id) {
    storage.setItem(indexKey, JSON.stringify(index.filter(x => (x as {id:string}).id !== id)));
    if (storage.getItem(activeKey) === id) storage.removeItem(activeKey);
    storage.removeItem(`tpa_list_v1_${id}`);
    storage.removeItem('tpa_trip_details');
  } else {
    const keys: string[] = [];
    for (let n = 0; n < storage.length; n++) { const key = storage.key(n); if (key?.startsWith('tpa_list_v1_')) keys.push(key); }
    for (const key of keys) storage.removeItem(key);
    storage.removeItem(indexKey); storage.removeItem(activeKey); storage.removeItem('tpa_trip_details');
  }
}

/** Clear only this application's prefixed data in the selected storage area. */
export function clearAppStorage(storage: Storage): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith('tpa_')) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}
