import { addCalendarDays } from '../utils/date';

export type DepartureReferenceInput = { flightDate:string; flightTime:string; flightZone:string; departureZone:string; travelMinutes:number; bufferMinutes:number };
export type DepartureReference = { flightInstant:string; leaveInstant:string; leaveLocal:string; departureZone:string };
const partsFor = (date: Date, zone: string) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone:zone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' });
  const parts = f.formatToParts(date);
  const part = (type:string) => parts.find(p=>p.type===type)?.value ?? '';
  return { date:`${part('year')}-${part('month')}-${part('day')}`, time:`${part('hour')}:${part('minute')}`, second:part('second') };
};

/** Does not use live service, determine a route, or assert a safe arrival buffer. */
export function calculateDepartureReference(input: DepartureReferenceInput): DepartureReference {
  const {flightDate,flightTime,flightZone,departureZone,travelMinutes,bufferMinutes}=input;
  if (!addCalendarDays(flightDate,0) || !/^\d{2}:\d{2}$/.test(flightTime)) throw new Error('請提供有效的航班日期與時間。');
  const [hours,minutes] = flightTime.split(':').map(Number);
  if (hours>23 || minutes>59 || !flightZone.trim() || !departureZone.trim()) throw new Error('請確認時間及兩地時區。');
  if (!Number.isInteger(travelMinutes) || travelMinutes<=0 || travelMinutes>1440 || !Number.isInteger(bufferMinutes) || bufferMinutes<0 || bufferMinutes>1440) throw new Error('請輸入有效的交通分鐘數與預留分鐘數。');
  const [year,month,day] = flightDate.split('-').map(Number);
  const nominal=Date.UTC(year,month-1,day,hours,minutes);
  let formatter: Intl.DateTimeFormat;
  try { formatter=new Intl.DateTimeFormat('en-CA',{timeZone:flightZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}); partsFor(new Date(nominal),departureZone); }
  catch { throw new Error('時區無效，請使用例如 Asia/Tokyo 的時區名稱。'); }
  const matches: number[] = [];
  // Search the full civil UTC-offset range, rejecting non-existent and repeated local times.
  for(let delta=-14*60;delta<=14*60;delta++) {
    const candidate=nominal+delta*60000;
    const parts=formatter.formatToParts(new Date(candidate));
    const get=(type:string)=>parts.find(p=>p.type===type)?.value ?? '';
    if (`${get('year')}-${get('month')}-${get('day')}`===flightDate && `${get('hour')}:${get('minute')}`===flightTime && get('second')==='00') matches.push(candidate);
  }
  if (matches.length!==1) throw new Error(matches.length ? '此航班當地時間在夏令時間轉換時出現兩次，請向航空公司確認具體時間。' : '此航班當地時間不存在或無法換算，請重新確認日期、時間與時區。');
  const leave=new Date(matches[0]-(travelMinutes+bufferMinutes)*60000);
  const local=partsFor(leave,departureZone);
  return {flightInstant:new Date(matches[0]).toISOString(),leaveInstant:leave.toISOString(),leaveLocal:`${local.date} ${local.time}`,departureZone};
}
