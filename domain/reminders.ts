import { addCalendarDays } from '../utils/date';
import { needsGateAttention } from './guardian';
import type { GateId, GuardianState } from './guardian';

export type Reminder = { gate: GateId; date: string; uid: string; title: string; overdue: boolean };
export function sameReminderSnapshot(left: readonly Reminder[], right: readonly Reminder[]): boolean {
  return left.length === right.length && left.every((item,index) => {
    const other=right[index];
    return item.gate===other.gate && item.date===other.date && item.uid===other.uid && item.title===other.title && item.overdue===other.overdue;
  });
}
const definitions: { gate:GateId; anchor:'start'|'end'; offset:number; title:string }[] = [
  {gate:'G1',anchor:'start',offset:-30,title:'確認證件與入境'}, {gate:'G1',anchor:'start',offset:-14,title:'複核證件與入境'},
  {gate:'G2',anchor:'start',offset:-21,title:'確認旅程通訊'}, {gate:'G2',anchor:'start',offset:-3,title:'複核旅程通訊'}, {gate:'G2',anchor:'start',offset:0,title:'抵達後檢查通訊'}, {gate:'G2',anchor:'end',offset:0,title:'回程前檢查通訊'},
  {gate:'G3',anchor:'start',offset:-7,title:'檢查行李'}, {gate:'G3',anchor:'start',offset:-1,title:'最後檢查行李'},
  {gate:'G4',anchor:'start',offset:-3,title:'確認機場交通'}, {gate:'G4',anchor:'start',offset:-1,title:'複核出發交通'},
  {gate:'G5',anchor:'end',offset:-1,title:'確認回程物品'}, {gate:'G6',anchor:'end',offset:1,title:'旅後回顧'},
];
function todayInZone(clock: Date, zone: string): string {
  if (!Number.isFinite(clock.getTime()) || !zone.trim()) throw new Error('請提供有效時間與旅程時區');
  let parts: Intl.DateTimeFormatPart[];
  try { parts = new Intl.DateTimeFormat('en-US', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(clock); }
  catch { throw new Error('旅程時區無效，請輸入例如 Asia/Tokyo'); }
  const get = (type: string) => parts.find(p=>p.type===type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function scheduleReminders(params: { id:string; start:string; end:string; timezone:string; returnTimezone:string; clock:Date; guardian?:GuardianState; cancelled?:boolean }): Reminder[] {
  if (!params.id || !addCalendarDays(params.start,0) || !addCalendarDays(params.end,0) || params.end < params.start) throw new Error('請先確認旅程日期');
  const startToday = todayInZone(params.clock,params.timezone);
  const returnToday = todayInZone(params.clock,params.returnTimezone);
  if (params.cancelled || params.guardian?.cancelled) return [];
  const out: Reminder[] = [];
  const late = new Set<GateId>();
  for (const item of definitions) {
    const today = item.anchor === 'start' ? startToday : returnToday;
    const task = params.guardian?.tasks[item.gate];
    if (task && params.guardian && !needsGateAttention(params.guardian,item.gate,params.clock)) continue;
    if (task?.status === 'snoozed' && !task.needsReview) {
      if (!task.snoozedUntil || !addCalendarDays(task.snoozedUntil,0) || task.snoozedUntil > today) continue;
      if (!late.has(item.gate)) {
        late.add(item.gate);
        out.push({gate:item.gate,date:today,uid:`${encodeURIComponent(params.id)}-${item.gate}-snooze@journey-guardian.local`,title:`暫緩到期：${item.title}`,overdue:true});
      }
      continue;
    }
    const due = addCalendarDays(params[item.anchor],item.offset);
    if (!due) throw new Error('提醒日期超出範圍');
    if (due < today) {
      if (returnToday > params.end || late.has(item.gate) || item.gate === 'G6') continue;
      late.add(item.gate);
      out.push({gate:item.gate,date:today,uid:`${encodeURIComponent(params.id)}-${item.gate}-late@journey-guardian.local`,title:`現在處理：${item.title}`,overdue:true});
    } else out.push({gate:item.gate,date:due,uid:`${encodeURIComponent(params.id)}-${item.gate}-${item.anchor}-${item.offset}@journey-guardian.local`,title:item.title,overdue:false});
  }
  return out.sort((a,b)=>a.date.localeCompare(b.date) || a.gate.localeCompare(b.gate) || a.uid.localeCompare(b.uid));
}
function escapeText(s: string) { return s.replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;'); }
function fold(line: string): string {
  const enc = new TextEncoder(); let result = ''; let length = 0;
  for (const char of line) { const n=enc.encode(char).length; if(length+n>75){result+='\r\n ';length=1;} result+=char;length+=n; }
  return result;
}
export function createCalendar(reminders: readonly Reminder[], clock: Date, sequence = 0): string {
  if (!Number.isFinite(clock.getTime()) || !Number.isInteger(sequence) || sequence < 0 || sequence > 2147483647) throw new Error('無效匯出時間或版本');
  const stamp=clock.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Journey Guardian//Reminder Snapshot//ZH-TW','CALSCALE:GREGORIAN'];
  for (const r of reminders) {
    const end=addCalendarDays(r.date,1); if (!end) throw new Error('提醒日期無效');
    lines.push('BEGIN:VEVENT',`UID:${escapeText(r.uid)}`,`DTSTAMP:${stamp}`,`SEQUENCE:${sequence}`,`DTSTART;VALUE=DATE:${r.date.replace(/-/g,'')}`,`DTEND;VALUE=DATE:${end.replace(/-/g,'')}`,`SUMMARY:${escapeText(r.title)}`,'DESCRIPTION:這是匯出當下的提醒快照。請自行查證規定及行程變更。','END:VEVENT');
  }
  return [...lines,'END:VCALENDAR',''].map(fold).join('\r\n');
}
