/** Empty means unknown; a non-empty zone must be accepted by Intl on this device. */
export function isValidTimeZone(value: string): boolean {
  if (!value || value !== value.trim() || value.length > 80) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; }
  catch { return false; }
}
