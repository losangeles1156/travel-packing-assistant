export const formatDateLocal = (date: Date) => {
  const offsetMinutes = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offsetMinutes * 60 * 1000);
  return localDate.toISOString().split('T')[0];
};

export const getDefaultTripDates = () => {
  const today = new Date();
  const next = new Date(today);
  next.setDate(today.getDate() + 4);
  return { start: formatDateLocal(today), end: formatDateLocal(next) };
};


/** Calendar dates are not instants: parse and calculate in UTC without device timezone. */
const calendarEpoch = (value: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 100 || year > 9999) return null;
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? time : null;
};
export const addCalendarDays = (value: string, days: number): string | null => {
  const time = calendarEpoch(value);
  if (time === null || !Number.isInteger(days)) return null;
  const result = new Date(time + days * 86400000);
  if (!Number.isFinite(result.getTime()) || result.getUTCFullYear() > 9999 || result.getUTCFullYear() < 100) return null;
  return result.toISOString().slice(0, 10);
};
export const inclusiveCalendarDays = (start: string, end: string): number => {
  const first = calendarEpoch(start), last = calendarEpoch(end);
  return first === null || last === null || last < first ? 0 : (last - first) / 86400000 + 1;
};
