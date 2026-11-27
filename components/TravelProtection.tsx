import React, {useMemo, useState} from 'react';
import {compareExpiry, emptyProtection, isTravelProtection, type TravelProtection as Protection} from '../domain/travelProtection';
import type {TripDisruption} from '../domain/tripDisruptions';

export default function TravelProtection({value,disruptions,onChange}:{key?:string;value:Protection|undefined;disruptions:TripDisruption[];onChange:(next:Protection)=>void}) {
  const [draft,setDraft]=useState<Protection>(value ?? emptyProtection());
  const [editing,setEditing]=useState(false);
  const [eventId,setEventId]=useState('');
  const [notice,setNotice]=useState('');
  const current=value ?? emptyProtection();
  const event=disruptions.find(d=>d.id===eventId);
  const comparison=useMemo(()=>event?compareExpiry({date:current.expiryDate,time:current.expiryTime,zone:current.expiryZone},{type:event.type,date:event.newDate,time:event.newTime,zone:event.newZone}):'unknown',[event,current.expiryDate,current.expiryTime,current.expiryZone]);
  const set=(key:keyof Protection,content:string)=>setDraft(old=>({...old,[key]:content}));
  const save=()=>{const normalized=Object.fromEntries(Object.entries(draft).map(([k,v])=>[k,String(v).trim()])) as Protection;if(!isTravelProtection(normalized)){setNotice('請確認到期時間、時區及保險日期；結束日不能早於起始日。');return;}onChange(normalized);setDraft(normalized);setEditing(false);setNotice('資料已確認，請等待旅程保存完成。');};
  const field=(key:keyof Protection,label:string,type='text')=><label>{label}<input type={type} value={draft[key]} maxLength={1000} onChange={e=>set(key,e.target.value)} /></label>;
  return <section className="trip-documents" aria-label="通訊與保險守護"><div className="trip-documents-heading"><div><h2>通訊與保險守護</h2><p>記錄已確認的方案、客服與備援，旅程變動時方便查找。這裡的資料與下方旅程準備檢查分開記錄，請分別核對。</p></div></div>
    {!editing && <><div className="trip-document-list"><article className="trip-document-card"><div><span className="trip-document-type">行動上網</span><h3>{current.method==='esim'?'eSIM':current.method==='sim'?'實體 SIM':current.method==='roaming'?'國際漫遊':current.method==='wifi'?'Wi-Fi 分享器':current.method==='other'?'其他方式':'尚未選擇方式'}</h3><p>裝置：{current.device || '未記錄'}；eSIM 相容性：{current.compatibility==='supported'?'使用者確認支援':current.compatibility==='unsupported'?'使用者確認不支援':'未確認'}</p><p>地區：{current.region || '未記錄'}；流量：{current.dataAllowance || '未記錄'}</p><p>上網需求：{current.need || '未記錄'}；計時方式：{({unknown:'未確認',installation:'安裝後',first_connection:'首次連線後',fixed_date:'指定日期',other:'其他'})[current.activation]}</p><p>已確認到期：{[current.expiryDate,current.expiryTime,current.expiryZone].filter(Boolean).join(' ') || '未記錄'}</p><p>加購：{current.extension||'未記錄'}；客服：{current.networkContact||'未記錄'}</p><p>備援：{current.backup||'未記錄'}</p><p>{current.method==='esim' && current.compatibility==='unsupported'?'已記錄裝置不支援 eSIM，請改查實體 SIM、漫遊或其他備援。':current.method==='esim' && current.compatibility==='unknown'?'eSIM 尚未確認適用，請先向裝置或電信業者查證。':'方案內容、訊號及可否加購仍須向供應商確認。'}</p></div></article><article className="trip-document-card"><div><span className="trip-document-type">旅遊保險</span><h3>{current.insurer||'尚未記錄保險'}</h3><p>期間：{current.policyStart||'未記錄'} → {current.policyEnd||'未記錄'}</p><p>聯絡方式：{current.insuranceContact||'未記錄'}</p><p>條款重點：{current.policyNotes||'未記錄，請查證保單'}</p><p>事故準備：{current.incidentSteps||'請確認通報方式並保存必要單據'}</p></div></article></div>
      <p>航班變動比較的是你記錄的「新出發時間」，不代表實際抵達時間或保障結論。</p><label>選擇已記錄的航班變動<select value={eventId} onChange={e=>setEventId(e.target.value)}><option value="">請選擇</option>{disruptions.map(d=><option key={d.id} value={d.id}>{d.original.title} · {d.type==='cancelled'?'取消':d.type==='rescheduled'?'改期':'延誤'} · {d.newDate||'新日期未確認'}</option>)}</select></label>
      {event && <p role="status">{comparison==='unknown'?'無法比較：需有已確認的方案到期日期、時間、時區及非取消航班的新出發日期、時間、時區；夏令時間模糊時也須確認。':comparison==='at_or_before'?'已記錄的上網方案到期時間不晚於新出發時間；請先向供應商確認延長或備援。':'已記錄的方案到期時間晚於新出發時間；仍需確認實際抵達、延誤及有效範圍。'}</p>}
      <p>保障與理賠以保單及保險公司確認為準；系統不保證網路可用。資料保存在本機，備份未加密。</p><div className="trip-document-add"><button type="button" onClick={()=>{setDraft({...current});setEditing(true);setNotice('');}}>編輯守護資料</button></div></>}
    {editing && <div className="trip-document-editor"><h3>確認通訊與保險資料</h3><p>請依供應商及保單資料填寫；未知可留白。不要輸入付款資料、護照號碼或密碼。</p><div className="trip-document-fields">
      {field('device','裝置型號')}
      <label>eSIM 相容性<select value={draft.compatibility} onChange={e=>set('compatibility',e.target.value)}><option value="unknown">尚未確認</option><option value="supported">已確認支援</option><option value="unsupported">已確認不支援</option></select></label>
      {field('need','上網需求')}
      <label>上網方式<select value={draft.method} onChange={e=>set('method',e.target.value)}><option value="unknown">尚未確認</option><option value="esim">eSIM</option><option value="sim">實體 SIM</option><option value="roaming">漫遊</option><option value="wifi">Wi-Fi 分享器</option><option value="other">其他</option></select></label>
      {field('region','方案適用地區')}{field('dataAllowance','流量與超量限制')}
      <label>啟用計時方式<select value={draft.activation} onChange={e=>set('activation',e.target.value)}><option value="unknown">尚未確認</option><option value="installation">安裝後</option><option value="first_connection">首次連線後</option><option value="fixed_date">指定日期</option><option value="other">其他，請向供應商確認</option></select></label>
      {field('expiryDate','已確認到期日期','date')}{field('expiryTime','已確認到期時間','time')}{field('expiryZone','到期時區（例如 Asia/Tokyo）')}{field('extension','加購或延長方式')}{field('networkContact','網路供應商聯絡方式')}{field('backup','網路與離線聯絡備援')}
      {field('insurer','保險公司')}{field('policyStart','保險開始日期','date')}{field('policyEnd','保險結束日期','date')}{field('insuranceContact','保險公司聯絡方式')}{field('policyNotes','已確認的條款重點')}{field('incidentSteps','事故通報與單據準備')}
      </div><div className="trip-document-add"><button type="button" onClick={save}>確認守護資料</button><button type="button" onClick={()=>{setDraft({...current});setEditing(false);setNotice('');}}>取消</button></div></div>}
    {notice && <p role="status" className="trip-document-notice">{notice}</p>}
  </section>;
}
