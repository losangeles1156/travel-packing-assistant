import React, {useState} from 'react';
import {isTransportPlan,type TransportPlan} from '../domain/transportPlan';
import type {TripDocument} from '../domain/tripDocuments';

const modes = {rail:'鐵路',bus:'巴士',transfer:'預約接送',taxi:'計程車',other:'其他'} as const;
const blank=(): TransportPlan => ({id:'',mode:'rail',title:'',from:'',to:'',date:'',time:'',timezone:'',contact:'',note:'',flightId:''});
export default function TransportPlans({documents,plans,onChange}:{key?:string;documents:TripDocument[];plans:TransportPlan[];onChange:(next:TransportPlan[])=>void}) {
  const [draft,setDraft]=useState<TransportPlan|null>(null);
  const [notice,setNotice]=useState('');
  const save=()=>{
    if (!draft) return;
    const event={...draft,id:draft.id || (globalThis.crypto?.randomUUID?.() ?? `transport-${Date.now()}-${Math.random().toString(36).slice(2)}`),title:draft.title.trim(),timezone:draft.timezone.trim()};
    if (!isTransportPlan(event)) {setNotice('請填寫交通名稱，並確認日期、時間及時區格式。');return;}
    const exists=plans.some(p=>p.id===event.id);
    if (!exists && plans.length >= 100) {setNotice('每趟旅程最多保存 100 筆交通安排。');return;}
    onChange(exists?plans.map(p=>p.id===event.id?event:p):[...plans,event]);setDraft(null);setNotice('已記錄交通安排，請等待資料保存完成。');
  };
  return <section className="trip-documents" aria-label="機場交通安排"><div className="trip-documents-heading"><div><h2>機場交通安排</h2><p>保存已知的交通或接送資料，方便旅程變動時聯絡確認。</p></div></div>
    {plans.length===0?<p className="trip-documents-empty">尚未記錄交通安排。</p>:<div className="trip-document-list">{plans.map(plan=><article className="trip-document-card" key={plan.id}><div><span className="trip-document-type">{modes[plan.mode]}</span><h3>{plan.title}</h3><p>{[plan.from,plan.to].filter(Boolean).join(' → ') || '地點未填'}</p><p>{[plan.date || '日期未填',plan.time,plan.timezone || '時區未填'].filter(Boolean).join(' ')}</p><p>聯絡方式：{plan.contact || '未填'}</p>{plan.note && <p>備註：{plan.note}</p>}<p className="trip-document-meta">{plan.flightId ? `關聯航班：${documents.find(d=>d.id===plan.flightId)?.title ?? '原航班已刪除，請重新確認'}` : '未關聯航班'} · 非即時資訊</p></div><div className="trip-document-actions"><button type="button" aria-label={`編輯交通 ${plan.title}`} onClick={()=>{setDraft({...plan});setNotice('');}}>編輯</button><button type="button" aria-label={`刪除交通 ${plan.title}`} onClick={()=>{if(window.confirm(`確定刪除「${plan.title}」？`)) {onChange(plans.filter(p=>p.id!==plan.id));setNotice('已刪除，請等待資料保存完成。');}}}>刪除</button></div></article>)}</div>}
    <div className="trip-document-add"><button type="button" onClick={()=>{setDraft(blank());setNotice('');}}>＋ 新增交通安排</button></div>
    {draft && <div className="trip-document-editor"><h3>{draft.id?'修改':'新增'}交通安排</h3><p>請自行核對班次、價格、接送安排與營運狀態；本工具不提供即時查詢或預約。</p><div className="trip-document-fields">
      <label>交通方式<select value={draft.mode} onChange={e=>setDraft({...draft,mode:e.target.value as TransportPlan['mode']})}>{Object.entries(modes).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label>交通名稱<input value={draft.title} maxLength={300} onChange={e=>setDraft({...draft,title:e.target.value})} /></label>
      <label>出發地<input value={draft.from} maxLength={300} onChange={e=>setDraft({...draft,from:e.target.value})} /></label><label>目的地<input value={draft.to} maxLength={300} onChange={e=>setDraft({...draft,to:e.target.value})} /></label>
      <label>交通日期<input type="date" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})} /></label><label>交通時間<input type="time" value={draft.time} onChange={e=>setDraft({...draft,time:e.target.value})} /></label><label>交通時區（選填）<input value={draft.timezone} maxLength={300} placeholder="例如 Asia/Tokyo" onChange={e=>setDraft({...draft,timezone:e.target.value})} /></label>
      <label>聯絡方式<input value={draft.contact} maxLength={300} onChange={e=>setDraft({...draft,contact:e.target.value})} /></label><label>關聯航班（選填）<select value={draft.flightId} onChange={e=>setDraft({...draft,flightId:e.target.value})}><option value="">未關聯</option>{draft.flightId && !documents.some(d=>d.id===draft.flightId) && <option value={draft.flightId}>原航班已刪除</option>}{documents.filter(d=>d.kind==='flight').map(f=><option value={f.id} key={f.id}>{f.title} {f.flightNumber} {f.startDate}</option>)}</select></label><label>備註<textarea value={draft.note} maxLength={1000} onChange={e=>setDraft({...draft,note:e.target.value})} /></label></div>
      <p>資料保存在本機，備份未加密；請勿輸入付款或護照資料。</p><div className="trip-document-add"><button type="button" onClick={save}>確認交通安排</button><button type="button" onClick={()=>{setDraft(null);setNotice('');}}>取消</button></div></div>}
    {notice && <p role="status" className="trip-document-notice">{notice}</p>}
  </section>;
}
