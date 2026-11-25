export type TransportPlan = { id:string; mode:'rail'|'bus'|'transfer'|'taxi'|'other'; title:string; from:string; to:string; date:string; time:string; timezone:string; contact:string; note:string; flightId:string };
export function isTransportPlan(value: unknown): value is TransportPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v=value as TransportPlan;
  const text=(x:unknown,max=300): x is string => typeof x === 'string' && x.length <= max;
  if (!text(v.id,200) || !v.id || !['rail','bus','transfer','taxi','other'].includes(v.mode) || !text(v.title) || !v.title.trim() || !text(v.from) || !text(v.to) || !text(v.date) || !text(v.time) || !text(v.timezone) || !text(v.contact) || !text(v.note,1000) || !text(v.flightId,200)) return false;
  if (v.date && (!/^\d{4}-\d\d-\d\d$/.test(v.date) || !Number.isFinite(Date.parse(`${v.date}T00:00:00Z`)) || new Date(`${v.date}T00:00:00Z`).toISOString().slice(0,10) !== v.date)) return false;
  if (v.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)) return false;
  if (v.timezone) {try {new Intl.DateTimeFormat('en',{timeZone:v.timezone});} catch {return false;}}
  return true;
}
