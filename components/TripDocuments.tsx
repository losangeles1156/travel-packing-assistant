import React, { useState } from 'react';
import { documentError, emptyDocumentFields, parseDocumentText, type DocumentFields, type DocumentKind, type TripDocument } from '../domain/tripDocuments';
import { disruptionGuidance, type DisruptionKind } from '../domain/disruptionGuidance';

export default function TripDocuments({ documents, onChange }: { key?: string; documents: TripDocument[]; onChange: (next: TripDocument[], kind: DocumentKind) => void }) {
  const [kind, setKind] = useState<DocumentKind | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [fields, setFields] = useState<DocumentFields>(emptyDocumentFields);
  const [source, setSource] = useState<'manual' | 'pasted'>('manual');
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');
  const [scenario, setScenario] = useState<{id: string; kind: DisruptionKind} | null>(null);
  const start = (next: DocumentKind, doc?: TripDocument) => {
    setKind(next); setEditing(doc?.id ?? null); setFields(doc ? { title:doc.title,flightNumber:doc.flightNumber,from:doc.from,to:doc.to,startDate:doc.startDate,startTime:doc.startTime,startZone:doc.startZone,endDate:doc.endDate,endTime:doc.endTime,endZone:doc.endZone,address:doc.address,contact:doc.contact,reference:doc.reference ?? '' } : emptyDocumentFields());
    setSource(doc?.source ?? 'manual'); setText(''); setNotice('');
  };
  const save = () => {
    if (!kind) return;
    const cleaned = Object.fromEntries(Object.entries(fields).map(([key,value]) => [key,String(value).trim()])) as DocumentFields;
    const error = documentError(kind, cleaned);
    if (error) { setNotice(error); return; }
    if (!editing && documents.length >= 100) { setNotice('每趟旅程最多記錄 100 筆資料。'); return; }
    const existing = documents.find(d => d.id === editing);
    const now = new Date().toISOString();
    const id = existing?.id ?? (globalThis.crypto?.randomUUID?.() ?? `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const doc: TripDocument = { ...cleaned, id, kind, source, createdAt: existing?.createdAt ?? now, updatedAt: now };
    onChange(existing ? documents.map(d => d.id === existing.id ? doc : d) : [...documents, doc], kind);
    setKind(null); setText(''); setNotice('已確認記錄，請等待旅程資料保存完成。');
  };
  const remove = (doc: TripDocument) => { if (window.confirm(`確定刪除「${doc.title}」？`)) { onChange(documents.filter(d => d.id !== doc.id),doc.kind); setNotice('已刪除該筆資料，請等待保存完成。'); } };
  const labels: {key:keyof DocumentFields;label:string;type?:string}[] = kind === 'flight' ? [
    {key:'title',label:'航空公司或航班名稱'}, {key:'flightNumber',label:'航班號碼（選填）'}, {key:'reference',label:'訂位代號（選填）'}, {key:'from',label:'出發機場'}, {key:'to',label:'抵達機場'},
    {key:'startDate',label:'出發日期',type:'date'}, {key:'startTime',label:'出發時間',type:'time'}, {key:'startZone',label:'出發時區（選填）'},
    {key:'endDate',label:'抵達日期',type:'date'}, {key:'endTime',label:'抵達時間',type:'time'}, {key:'endZone',label:'抵達時區（選填）'},
  ] : [ {key:'title',label:'住宿名稱'}, {key:'address',label:'住宿地址'}, {key:'contact',label:'聯絡方式（選填）'}, {key:'reference',label:'訂房編號（選填）'},
    {key:'startDate',label:'入住日期',type:'date'}, {key:'startTime',label:'入住時間（選填）',type:'time'}, {key:'startZone',label:'入住時區（選填）'},
    {key:'endDate',label:'退房日期',type:'date'}, {key:'endTime',label:'退房時間（選填）',type:'time'}, {key:'endZone',label:'退房時區（選填）'} ];
  return <section className="trip-documents" aria-label="航班與住宿">
    <div className="trip-documents-heading"><div><h2>航班與住宿</h2><p>把旅程重要資訊放在一起，隨時查看。</p></div></div>
    {documents.length === 0 ? <p className="trip-documents-empty">還沒有記錄航班或住宿。</p> : <div className="trip-document-list">{documents.map(doc => <article className="trip-document-card" key={doc.id}>
      <div><span className="trip-document-type">{doc.kind === 'flight' ? '航班' : '住宿'}</span><h3>{doc.title}{doc.kind === 'flight' && doc.flightNumber ? ` ${doc.flightNumber}` : ''}</h3><p>{doc.kind === 'flight' ? [doc.from,doc.to].filter(Boolean).join(' → ') || '機場待補充' : doc.address || '地址待補充'}</p><p>{doc.startDate || '日期待補充'}{doc.startTime ? ` ${doc.startTime}` : ''}{doc.endDate ? ` → ${doc.endDate}` : ''}</p>{doc.reference && <p>{doc.kind === 'flight' ? '訂位代號' : '訂房編號'}：<span className="booking-reference">{doc.reference}</span></p>}<p className="trip-document-meta">{doc.source === 'pasted' ? '文字擷取後由你確認' : '由你記錄'} · 非即時資訊</p></div>
      <details><summary>查看詳細資訊</summary><p>{doc.kind === 'flight' ? '出發' : '入住'}：{[doc.startDate, doc.startTime, doc.startZone || '時區未填'].filter(Boolean).join(' ')}</p><p>{doc.kind === 'flight' ? '抵達' : '退房'}：{[doc.endDate, doc.endTime, doc.endZone || '時區未填'].filter(Boolean).join(' ')}</p>{doc.contact && <p>聯絡方式：{doc.contact}</p>}</details>
      <div className="trip-document-actions"><button type="button" aria-label={`編輯 ${doc.title}`} onClick={()=>start(doc.kind,doc)}>編輯</button><button type="button" aria-label={`刪除 ${doc.title}`} onClick={()=>remove(doc)}>刪除</button></div>
      {doc.kind === 'flight' && <details><summary>航班有變動時怎麼辦？</summary><p>選擇情境查看準備方向；這不是航班即時狀態，也不會替你記錄變動。</p><div className="trip-document-add"><button type="button" aria-pressed={scenario?.id === doc.id && scenario.kind === 'delay'} onClick={()=>setScenario({id:doc.id,kind:'delay'})}>航班延誤</button><button type="button" aria-pressed={scenario?.id === doc.id && scenario.kind === 'cancellation'} onClick={()=>setScenario({id:doc.id,kind:'cancellation'})}>航班取消</button></div>{scenario?.id === doc.id && <div aria-live="polite">{disruptionGuidance(scenario.kind,documents).map(item=><p key={item.title}><strong>{item.title}：</strong>{item.action}</p>)}</div>}</details>}
    </article>)}</div>}
    <div className="trip-document-add"><button type="button" onClick={()=>start('flight')}>＋ 新增航班</button><button type="button" onClick={()=>start('lodging')}>＋ 新增住宿</button></div>
    {kind && <div className="trip-document-editor"><h3>{editing ? '修改' : '新增'}{kind === 'flight' ? '航班' : '住宿'}</h3><p>請自行核對資訊；系統不會連線查詢航班或訂房狀態。時區不明可留空。</p>
      {!editing && <details><summary>貼上訂單文字擷取草稿</summary><p>只辨識「欄位：內容」的明確資料，例如「{kind === 'flight' ? '出發日期' : '入住日期'}：2026-12-01」。請勿貼入護照、付款資料或密碼；原文不會保存。</p><label>訂單文字<textarea value={text} maxLength={10000} onChange={e=>setText(e.target.value)} /></label><button type="button" onClick={()=>{ try { const parsed = parseDocumentText(kind,text); setFields(parsed); setSource('pasted'); setNotice('已產生草稿，請逐欄核對後確認加入。'); } catch (e) { setNotice(e instanceof Error ? e.message : '無法讀取文字。'); } }}>擷取草稿</button></details>}
      <div className="trip-document-fields">{labels.map(field=><label key={field.key}>{field.label}<input type={field.type ?? 'text'} maxLength={300} value={fields[field.key]} onChange={e=>setFields({...fields,[field.key]:e.target.value})} /></label>)}</div>
      <p>按確認後才加入旅程；重新整理前請先確認。資料不是即時狀態，備份檔未加密。</p><div className="trip-document-add"><button type="button" onClick={save}>{editing ? '確認修改' : '確認加入旅程'}</button><button type="button" onClick={()=>{setKind(null);setText('');setNotice('已取消，未加入這筆資料。');}}>取消</button></div>
    </div>}
    {notice && <p role="status" className="trip-document-notice">{notice}</p>}
  </section>;
}
