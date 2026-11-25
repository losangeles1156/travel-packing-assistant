export type DisruptionType = 'delay' | 'cancelled' | 'rescheduled';
export type FlightSnapshot = { title: string; flightNumber: string; from: string; to: string; startDate: string; startTime: string; startZone: string; endDate: string; endTime: string; endZone: string };
export type TripDisruption = { id: string; flightId: string; type: DisruptionType; original: FlightSnapshot; newDate: string; newTime: string; newZone: string; source: string; note: string; confirmedAt: string; handled?: Record<string,string> };

const keys: (keyof FlightSnapshot)[] = ['title','flightNumber','from','to','startDate','startTime','startZone','endDate','endTime','endZone'];
const bounded = (v: unknown, max = 300): v is string => typeof v === 'string' && v.length <= max;
const date = (s: string) => !s || (/^\d{4}-\d\d-\d\d$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0,10) === s);
const time = (s: string) => !s || /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const zone = (s: string) => { if (!s) return true; try { new Intl.DateTimeFormat('en', {timeZone:s}); return true; } catch { return false; } };

export function isTripDisruption(value: unknown): value is TripDisruption {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as TripDisruption;
  if (!bounded(v.id,200) || !v.id || !bounded(v.flightId,200) || !v.flightId || !['delay','cancelled','rescheduled'].includes(v.type) || !v.original || typeof v.original !== 'object' || Array.isArray(v.original) || !keys.every(k => bounded(v.original[k])) || !v.original.title.trim() || !bounded(v.newDate) || !bounded(v.newTime) || !bounded(v.newZone) || !bounded(v.source) || !v.source.trim() || !bounded(v.note,1000) || typeof v.confirmedAt !== 'string' || !Number.isFinite(Date.parse(v.confirmedAt))) return false;
  if (v.handled !== undefined && (!v.handled || typeof v.handled !== 'object' || Array.isArray(v.handled) || Object.entries(v.handled).some(([key, value]) => !/^(flight|network|arrangements|(?:transport|stay)-.{1,200})$/.test(key) || !bounded(value,12000)))) return false;
  const o=v.original;
  return date(o.startDate) && date(o.endDate) && time(o.startTime) && time(o.endTime) && zone(o.startZone) && zone(o.endZone) && date(v.newDate) && time(v.newTime) && zone(v.newZone);
}

export function snapshotFlight(flight: FlightSnapshot): FlightSnapshot {
  return Object.fromEntries(keys.map(key => [key, flight[key]])) as FlightSnapshot;
}
