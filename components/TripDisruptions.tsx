import React, { useEffect, useState } from 'react';
import { isTripDisruption, snapshotFlight, type DisruptionType, type TripDisruption } from '../domain/tripDisruptions';
import type { TripDocument } from '../domain/tripDocuments';
import { fieldActions } from '../domain/fieldActions';
import { useMemo } from 'react';
import type { TransportPlan } from '../domain/transportPlan';
import type { Expense } from '../domain/expenses';
import type { TravelProtection } from '../domain/travelProtection';
import DisruptionContext from './DisruptionContext';

const labels: Record<DisruptionType, string> = {delay:'延誤', cancelled:'取消', rescheduled:'改期'};
export default function TripDisruptions({ documents, disruptions, transportPlans, protection, expenses, onNavigate, onChange, openRequest = 0 }: { protection?: TravelProtection; expenses: Expense[]; onNavigate: (area: 'documents'|'transport'|'protection'|'expenses') => void; openRequest?: number; key?: string; documents: TripDocument[]; disruptions: TripDisruption[]; transportPlans: TransportPlan[]; onChange: (next: TripDisruption[]) => void }) {
  const actionsByEvent = useMemo(() => new Map(disruptions.map(event => [event.id, fieldActions(event,transportPlans,documents,protection)])), [disruptions,transportPlans,documents,protection]);
  function actionList(event: TripDisruption) {
    const actions = actionsByEvent.get(event.id) ?? [];
    const pending = actions.filter(action => event.handled?.[action.id] !== action.evidence);
    return <section aria-label="航班變動待辦"><h4>{pending.length ? '下一步：'+pending[0].title : '這筆變動的待辦已處理'}</h4>
      {actions.map(action => <label key={action.id} className="block py-2"><input type="checkbox"
        checked={event.handled?.[action.id] === action.evidence} onChange={e => {
          const handled = {...event.handled};
          if (e.target.checked) handled[action.id] = action.evidence;
          else delete handled[action.id];
          onChange(disruptions.map(item => item.id === event.id ? {...item,handled} : item));
        }} /> {action.title}<small className="block">{action.detail}</small></label>)}</section>;
  }
  const [open,setOpen] = useState(false);
  useEffect(() => { if (openRequest > 0) setOpen(true); }, [openRequest]);
  const [flightId,setFlightId] = useState('');
  const [type,setType] = useState<DisruptionType>('delay');
  const [newDate,setNewDate] = useState('');
  const [newTime,setNewTime] = useState('');
  const [newZone,setNewZone] = useState('');
  const [source,setSource] = useState('');
  const [note,setNote] = useState('');
  const [notice,setNotice] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const flights = documents.filter(d => d.kind === 'flight');
  const save = () => {
    const flight = flights.find(f => f.id === flightId);
    if (!flight) {setNotice('請先選擇這次變動的航班。'); return;}
    if (disruptions.length >= 100) {setNotice('每趟旅程最多保存 100 筆變動紀錄。'); return;}
    const event: TripDisruption = { id:globalThis.crypto?.randomUUID?.() ?? `change-${Date.now()}-${Math.random().toString(36).slice(2)}`, flightId, type, original:snapshotFlight(flight), newDate, newTime, newZone:newZone.trim(), source:source.trim(), note:note.trim(), confirmedAt:new Date().toISOString() };
    if (!isTripDisruption(event)) {setNotice('請填寫資訊來源，並確認日期、時間及時區格式。'); return;}
    onChange([...disruptions,event]); setOpen(false); setFlightId(''); setNewDate(''); setNewTime(''); setNewZone(''); setSource(''); setNote(''); setNotice('已記錄變動，請等待資料保存完成。');
  };
  return <section className="trip-documents" aria-label="旅程變動">
    <div className="trip-documents-heading"><div><h2>旅程變動</h2><p>記下你確認的消息，保留當時的航班資料與應變方向。</p></div></div>
    {disruptions.length === 0 ? <p className="trip-documents-empty">目前沒有變動紀錄。</p> : <div className="trip-document-list">{[...disruptions].reverse().map(event=><article className="trip-document-card" key={event.id}>
      <div><span className="trip-document-type">{labels[event.type]}</span><h3>{event.original.title}{event.original.flightNumber ? ` ${event.original.flightNumber}` : ''}</h3><p>原出發：{[event.original.startDate || '日期未填',event.original.startTime,event.original.startZone || '時區未填'].filter(Boolean).join(' ')}</p><p>新出發：{[event.newDate || '日期未確認',event.newTime,event.newZone || '時區未填'].filter(Boolean).join(' ')}</p><p>來源：{event.source}</p><p>記錄時間：{new Date(event.confirmedAt).toLocaleString()}（本裝置時間顯示）</p>{event.note && <p>備註：{event.note}</p>}<p className="trip-document-meta">由你記錄，非即時狀態；原資料為當時快照。</p></div>
      {actionList(event)}
      <details><summary>查看原航班資料</summary><p>{[event.original.from,event.original.to].filter(Boolean).join(' → ') || '機場未填'}</p><p>原抵達：{[event.original.endDate || '日期未填',event.original.endTime,event.original.endZone || '時區未填'].filter(Boolean).join(' ')}</p></details>
      <details onToggle={e => { const open = e.currentTarget.open; setExpanded(previous => { const next = new Set(previous); if (open) next.add(event.id); else next.delete(event.id); return next; }); }}><summary>查看需要確認的事項</summary>
        {expanded.has(event.id) && <><DisruptionContext event={event} documents={documents} plans={transportPlans} protection={protection} expenses={expenses} onNavigate={onNavigate} /></>}
      </details>
      <div className="trip-document-actions"><button type="button" aria-label={`刪除 ${event.original.title} 的變動紀錄`} onClick={()=>{if(window.confirm('確定刪除這筆變動紀錄？')) {onChange(disruptions.filter(d=>d.id !== event.id)); setNotice('已刪除紀錄，請等待資料保存完成。');}}}>刪除紀錄</button></div>
    </article>)}</div>}
    <div className="trip-document-add"><button type="button" onClick={()=>{setOpen(true);setNotice('');}}>＋ 記錄航班變動</button></div>
    {open && <div className="trip-document-editor"><h3>記錄航班變動</h3><p>請根據航空公司或其他來源自行核對；不會自動查詢或修改原航班。未知的時間可以留空。</p><div className="trip-document-fields">
      <label>選擇航班<select value={flightId} onChange={e=>setFlightId(e.target.value)}><option value="">請選擇</option>{flights.map(f=><option key={f.id} value={f.id}>{f.title}{f.flightNumber ? ` ${f.flightNumber}` : ''} {f.startDate}</option>)}</select></label>
      <label>變動類型<select value={type} onChange={e=>setType(e.target.value as DisruptionType)}><option value="delay">延誤</option><option value="cancelled">取消</option><option value="rescheduled">改期</option></select></label>
      <label>新出發日期（選填）<input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)} /></label><label>新出發時間（選填）<input type="time" value={newTime} onChange={e=>setNewTime(e.target.value)} /></label><label>新出發時區（選填）<input value={newZone} maxLength={300} placeholder="例如 Asia/Tokyo" onChange={e=>setNewZone(e.target.value)} /></label>
      <label>資訊來源<input value={source} maxLength={300} placeholder="例如航空公司通知" onChange={e=>setSource(e.target.value)} /></label><label>備註（選填）<textarea value={note} maxLength={1000} onChange={e=>setNote(e.target.value)} /></label></div>
      {!flights.length && <p>請先在「航班與住宿」新增航班。</p>}<p>記錄時間以本裝置時間建立；資料與備份未加密，請勿輸入付款或護照資料。</p><div className="trip-document-add"><button type="button" onClick={save}>確認記錄變動</button><button type="button" onClick={()=>{setOpen(false);setNotice('');}}>取消</button></div></div>}
    {notice && <p role="status" className="trip-document-notice">{notice}</p>}
  </section>;
}
