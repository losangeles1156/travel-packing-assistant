import React, { useState } from 'react';
import type { ListSnapshot } from '../services/listStorageService';
import type { TripDocument } from '../domain/tripDocuments';
import type { TravelProtection } from '../domain/travelProtection';

type Area = 'shopping' | 'packing' | 'documents' | 'disruptions' | 'transport' | 'protection' | 'checks' | 'expenses' | 'emergency';
type Situation = 'flight' | 'transport' | 'lodging' | 'network' | 'documents_lost' | 'medical';
const situations: { id: Situation; label: string; icon: string; description: string; action: string; area: Area }[] = [
  { id: 'flight', label: '航班變動', icon: 'fa-plane', description: '記下已確認的延誤或取消，再檢視交通與其他安排。', action: '記錄航班變動', area: 'disruptions' },
  { id: 'transport', label: '交通中斷', icon: 'fa-train', description: '查看已記錄的機場交通與聯絡方式，自行確認替代安排。', action: '查看交通安排', area: 'transport' },
  { id: 'lodging', label: '住宿問題', icon: 'fa-bed', description: '先查看住宿地址與聯絡方式，再向住宿方確認。', action: '查看住宿資料', area: 'documents' },
  { id: 'network', label: '網路問題', icon: 'fa-wifi', description: '查看上網期限、延長方式與備用網路的紀錄。', action: '查看通訊準備', area: 'protection' },
  { id: 'documents_lost', label: '證件遺失', icon: 'fa-passport', description: '護照遺失請先向當地警察報案並取得報案證明，再聯絡駐外館處補發；信用卡請向發卡銀行掛失，並聯絡保險公司確認理賠。', action: '查看駐外館處電話', area: 'emergency' },
  { id: 'medical', label: '生病就醫', icon: 'fa-kit-medical', description: '向旅館或駐外館處詢問醫院資訊並儘速就醫，同時聯絡保險公司安排後續就醫與理賠。駐外館處無法代墊醫療費用。', action: '查看保險與館處電話', area: 'emergency' },
];

export default function JourneyOverview({ documents, protection, weights, borderReviewCount, onNavigate }: { borderReviewCount:number; weights?:ListSnapshot['luggageWeights']; documents: TripDocument[]; protection?: TravelProtection; onNavigate: (area: Area) => void }) {
  const [situation, setSituation] = useState<Situation | null>(null);
  const selected = situations.find(item => item.id === situation);
  const ordered = [...documents].sort((a, b) => (a.startDate || '9999').localeCompare(b.startDate || '9999'));
  const groups = ordered.reduce<{ date: string; items: TripDocument[] }[]>((all, doc) => {
    const date = doc.startDate || '日期待確認';
    const group = all.find(item => item.date === date);
    if (group) group.items.push(doc); else all.push({ date, items: [doc] });
    return all;
  }, []);
  const flights = documents.filter(doc => doc.kind === 'flight').length;
  const stays = documents.filter(doc => doc.kind === 'lodging').length;
  return <section className="journey-dashboard" aria-label="旅程總覽">
    <div className="dashboard-heading"><div><p className="dashboard-kicker">YOUR JOURNEY</p><h2>旅程守護</h2><p>把重要安排與需要確認的事，放在容易找到的地方。</p></div><i className="fa-regular fa-compass" aria-hidden="true" /></div>
    <button type="button" className="dashboard-emergency" onClick={() => onNavigate('emergency')}><i className="fa-solid fa-kit-medical" aria-hidden="true" /><span><strong>緊急資訊卡</strong><small>住宿地址、保險與駐外館處電話，離線也能看</small></span><span aria-hidden="true">›</span></button>
    <section className="dashboard-card dashboard-ready" aria-label="出發前待確認"><h3>出發前待確認</h3>
      {!flights && <button onClick={()=>onNavigate('documents')}>補上航班資料 →</button>}
      {!stays && <button onClick={()=>onNavigate('documents')}>確認住宿安排 →</button>}
      {(!protection || protection.method==='unknown' || (protection.method==='esim' && protection.compatibility!=='supported')) && <button onClick={()=>onNavigate('protection')}>確認上網方式與裝置相容性 →</button>}
      {([['手提',weights?.carryActual,weights?.carryLimit],['託運',weights?.checkedActual,weights?.checkedLimit]] as const).map(([label,actual,limit]) =>
        actual===undefined || limit===undefined || actual>limit ? <button key={label} onClick={()=>onNavigate('packing')}>{label}{actual===undefined || limit===undefined ? '重量或票券限額待填' : '超過限額 '+Number((actual-limit).toFixed(2))+' 公斤'} →</button> : null)}
      <button type="button" onClick={()=>onNavigate('shopping')}><span>跨境物品檢核</span><strong>{borderReviewCount ? `${borderReviewCount} 件待確認` : '查看跨境物品'}</strong><span aria-hidden="true">›</span></button>
      <small>依目前記錄列出，完整檢查可至旅程檢查查看。</small></section>
    <div className="dashboard-grid">
      <section className="dashboard-card dashboard-itinerary" aria-label="已記錄的旅程安排">
        <div className="dashboard-card-heading"><div><span className="dashboard-card-label">旅程安排</span><h3>重要資訊</h3></div><button type="button" onClick={() => onNavigate('documents')}>管理資料 <span aria-hidden="true">→</span></button></div>
        {groups.length ? <div className="journey-timeline" aria-label="旅程時間軸">{groups.map(group => <div className="timeline-day" key={group.date}>
          <h4>{group.date}</h4><ul className="dashboard-agenda">{group.items.map(doc => <li key={doc.id}>
            <span className="dashboard-agenda-icon"><i className={`fa-solid ${doc.kind === 'flight' ? 'fa-plane' : 'fa-bed'}`} aria-hidden="true" /></span>
            <span><strong>{doc.title}{doc.kind === 'flight' && doc.flightNumber ? ` ${doc.flightNumber}` : ''}</strong><small>{doc.kind === 'flight' ? '出發航班' : '住宿入住'} · {doc.startTime || '時間待確認'} · {doc.startZone || '時區待確認'}</small>{doc.kind === 'flight' && (doc.from || doc.to) && <small>{doc.from || '出發地待確認'} → {doc.to || '抵達地待確認'}</small>}</span>
          </li>)}</ul></div>)}</div> : <div className="dashboard-empty"><p>先記下航班與住宿，旅途中需要時就能找到。</p><button type="button" onClick={() => onNavigate('documents')}>新增航班或住宿 <span aria-hidden="true">→</span></button></div>}
        <p className="dashboard-footnote">依記錄的當地日期分組，同日項目不代表先後順序；資料並非即時狀態。</p>
      </section>
      <section className="dashboard-card dashboard-ready" aria-label="守護準備概況">
        <div className="dashboard-card-heading"><div><span className="dashboard-card-label">出發前，慢慢確認</span><h3>守護準備</h3></div><i className="fa-solid fa-shield-heart" aria-hidden="true" /></div>
        <button type="button" onClick={() => onNavigate('documents')}><span>航班與住宿</span><strong>{flights || stays ? `${flights} 筆航班・${stays} 筆住宿` : '尚未記錄'}</strong><span aria-hidden="true">›</span></button>
        <button type="button" onClick={() => onNavigate('protection')}><span>行動上網</span><strong>{protection?.method && protection.method !== 'unknown' ? '已記錄方式' : '尚未記錄方式'}</strong><span aria-hidden="true">›</span></button>
        <button type="button" onClick={() => onNavigate('protection')}><span>旅遊保險</span><strong>{protection?.insurer ? '已記錄保險公司' : '尚未記錄保險公司'}</strong><span aria-hidden="true">›</span></button>
        <button type="button" onClick={() => onNavigate('expenses')}><span>旅途記帳</span><strong>查看旅程支出</strong><span aria-hidden="true">›</span></button>
        <button type="button" onClick={() => onNavigate('checks')}><span>旅程檢查</span><strong>查看確認事項</strong><span aria-hidden="true">›</span></button>
      </section>
    </div>
    <section className="dashboard-help" aria-label="遇到狀況">
      <div className="dashboard-help-heading"><div><span className="dashboard-card-label">旅途中，需要時再打開</span><h3>遇到狀況？</h3><p>選擇目前的情況，找到相關紀錄與下一步。</p></div><i className="fa-regular fa-life-ring" aria-hidden="true" /></div>
      <div className="dashboard-situations">{situations.map(item => <button type="button" key={item.id} aria-pressed={situation === item.id} onClick={() => setSituation(situation === item.id ? null : item.id)}><i className={`fa-solid ${item.icon}`} aria-hidden="true" /><span>{item.label}</span></button>)}</div>
      {selected && <div className="dashboard-situation-detail"><p>{selected.description}</p><button type="button" onClick={() => onNavigate(selected.area)}>{selected.action} <span aria-hidden="true">→</span></button></div>}
      <p className="dashboard-footnote">不會自動監測航班或交通，請向相關業者確認最新資訊。</p>
    </section>
  </section>;
}
