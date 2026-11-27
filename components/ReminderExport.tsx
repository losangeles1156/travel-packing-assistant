import React, { useState } from 'react';
import { listRepository } from '../infrastructure/listRepository';
import { getActiveListId } from '../services/listStorageService';
import { createCalendar, sameReminderSnapshot, scheduleReminders, type Reminder } from '../domain/reminders';

type Preview = { id:string; updatedAt:string; destination:string; departureZone:string; returnZone:string; reminders:Reminder[] };
export default function ReminderExport({flush}:{flush:()=>Promise<void>}) {
  const [zone,setZone]=useState('');
  const [returnZone,setReturnZone]=useState('');
  const [preview,setPreview]=useState<Preview|null>(null);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const prepare=async()=>{
    setBusy(true); setMessage('');setPreview(null);
    try {
      await flush(); const id=getActiveListId();
      if(!id) throw new Error('請先建立或開啟一趟旅程。');
      const list=await listRepository.get(id); if(!list) throw new Error('找不到目前旅程。');
      if (list.guardian?.cancelled) throw new Error('旅程已取消；既有外部日曆提醒需自行刪除。');
      const departureZone = zone.trim() || list.trip.departureTimezone || '';
      const arrivalZone = returnZone.trim() || list.trip.returnTimezone || '';
      const reminders=scheduleReminders({id:list.id,start:list.trip.startDate,end:list.trip.endDate,timezone:departureZone,returnTimezone:arrivalZone,clock:new Date(),guardian:list.guardian});
      if(!reminders.length) throw new Error('目前沒有可匯出的提醒。');
      setPreview({id,updatedAt:list.updatedAt,destination:list.trip.destination,departureZone,returnZone:arrivalZone,reminders});
    }catch(e){setMessage(e instanceof Error ? e.message : '無法預覽提醒。');}finally{setBusy(false)}
  };
  const download=async()=>{
    if (!preview) return;
    setBusy(true);setMessage('');
    try {
      await flush();
      if (getActiveListId() !== preview.id) throw new Error('目前旅程已變更，請重新預覽。');
      const list=await listRepository.get(preview.id);
      if (!list || list.updatedAt !== preview.updatedAt || list.guardian?.cancelled) throw new Error('旅程資料已變更，請重新預覽。');
      const latest=scheduleReminders({id:list.id,start:list.trip.startDate,end:list.trip.endDate,timezone:preview.departureZone,returnTimezone:preview.returnZone,clock:new Date(),guardian:list.guardian});
      if (!sameReminderSnapshot(preview.reminders,latest)) throw new Error('提醒時點已變更，請重新預覽。');
      const modified=Date.parse(list.updatedAt); const sequence=Math.min(2147483647,Math.max(0,Math.floor(modified/1000)));
      const blob=new Blob([createCalendar(preview.reminders,new Date(),sequence)],{type:'text/calendar;charset=utf-8'});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='journey-reminders.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      setMessage(`已準備 ${preview.reminders.length} 項日曆提醒。`);setPreview(null);
    }catch(e){setMessage(e instanceof Error ? e.message : '無法匯出提醒。');setPreview(null);}finally{setBusy(false)}
  };
  return <details className="max-w-5xl mx-auto px-4 pt-3 no-print"><summary className="cursor-pointer text-sm font-bold">匯出日曆提醒</summary>
    <p className="text-sm mt-2">提醒為全天日曆快照，匯入方式與通知由日曆服務決定；旅程變更後須重新匯出，可能產生重複項目。</p>
    <label className="block text-sm mt-2">出發地時區（留空使用已存時區）<input className="border rounded p-2 ml-2" value={zone} onChange={e=>{setZone(e.target.value);setPreview(null)}} /></label>
    <label className="block text-sm mt-2">回程地時區（留空使用已存時區）<input className="border rounded p-2 ml-2" value={returnZone} onChange={e=>{setReturnZone(e.target.value);setPreview(null)}} /></label>
    <p className="text-xs mt-1">請使用 IANA 時區，例如 Asia/Taipei、Asia/Tokyo；兩地相同時也需分別設定。</p>
    <button className="border rounded p-2 mt-2" disabled={busy} onClick={()=>void prepare()}>預覽提醒</button>
    {preview && <div className="border rounded p-3 mt-2 text-sm"><p>旅程：{preview.destination}；出發地時區：{preview.departureZone}；回程地時區：{preview.returnZone}</p><p>共 {preview.reminders.length} 項全天提醒，請確認旅程與時區。</p><ul className="list-disc pl-5">{preview.reminders.map(item=><li key={item.uid}>{item.date}：{item.title}</li>)}</ul><button className="border rounded p-2 mt-2" disabled={busy} onClick={()=>void download()}>確認並匯出日曆</button></div>}
    {message && <p role="status" className="text-sm mt-2">{message}</p>}
  </details>;
}
