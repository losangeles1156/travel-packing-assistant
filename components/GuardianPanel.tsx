import React, { useEffect, useState } from 'react';
import { evaluateGate, initialRules, needsGateAttention, updateConfirmedInputs, updateGateDraft, hasUnrecordedGateInputs, recordGateReview, setTripCancelled, type GateId, type GuardianState, type GuardianTask, type TaskStatus, type Applicability } from '../domain/guardian';
import { evaluateConnectivity } from '../domain/connectivity';
import { addCalendarDays } from '../utils/date';
import DepartureCalculator from './DepartureCalculator';
import LocalExtraction from './LocalExtraction';
import { classifyReturnItems } from '../domain/returnItems';
import { scheduleReminders } from '../domain/reminders';
import { officialSources, sourceReviewState } from '../domain/sources';

type Field = { key: string; label: string; hint?: string };
const sections: { id: GateId; title: string; fields: Field[] }[] = [
  {id:'G1',title:'證件與入境',fields:[{key:'nationality',label:'國籍'},{key:'destination',label:'目的地'},{key:'transit',label:'轉機地點或無轉機'}]},
  {id:'G2',title:'行動通訊',fields:[{key:'device',label:'裝置型號'},{key:'compatibility',label:'相容性確認結果',hint:'不確定時可填「待確認」'},{key:'connectionPlan',label:'上網方式與啟用條件'},{key:'networkNeed',label:'網路需求（選填）',hint:'例如導航、視訊或分享網路'},{key:'purchaseStatus',label:'方案購買狀態（選填）'},{key:'activationTiming',label:'方案計時起點（選填）'}]},
  {id:'G3',title:'行李準備',fields:[{key:'airline',label:'航空公司'},{key:'cabin',label:'艙等'},{key:'luggageItems',label:'需確認的物品及條件'}]},
  {id:'G4',title:'出發與機場交通',fields:[{key:'flightTime',label:'航班日期與時間'},{key:'flightTimezone',label:'航班時間所屬時區'},{key:'terminal',label:'航廈'},{key:'departurePoint',label:'出發地'},{key:'groundTransport',label:'已確認的交通與備案'},{key:'buffer',label:'預留緩衝時間'},{key:'lodgingContact',label:'住宿聯絡方式（選填）'},{key:'lodgingCheckIn',label:'住宿最晚入住時間（選填）',hint:'請自行核對當地日期、時間及時區'},{key:'lodgingNotes',label:'住宿或交通中斷備忘（選填）'}]},
  {id:'G5',title:'回程與海關檢疫',fields:[{key:'returnDestination',label:'回程入境地'},{key:'returnItems',label:'物品分類與數量'}]},
  {id:'G6',title:'旅後回顧',fields:[{key:'feedback',label:'自願回饋'}]},
];
const statusLabels: Record<TaskStatus,string> = {todo:'未處理',in_progress:'處理中',done:'完成',snoozed:'暫緩',skipped:'略過'};
const gateIcons: Record<GateId,string> = {G1:'fa-passport',G2:'fa-signal',G3:'fa-suitcase-rolling',G4:'fa-plane-departure',G5:'fa-box-open',G6:'fa-heart'};
function Card({ section, state, onChange, suggestions }: {suggestions:Record<string,string>;key?: string;section:typeof sections[number];state:GuardianState;onChange:(next:GuardianState)=>void}) {
  const savedDraft = state.drafts?.[section.id];
  const draft = savedDraft?.values ?? Object.fromEntries(section.fields.map(f => [f.key,String(state.inputs[f.key]?.value ?? '')]));
  const available = Object.fromEntries(section.fields.filter(f=>!draft[f.key] && suggestions[f.key]).map(f=>[f.key,suggestions[f.key]]));
  const note = savedDraft?.note ?? state.tasks[section.id]?.note ?? '';
  const changeDraft = (values: Record<string,string>, nextNote: string) => onChange(updateGateDraft(state, section.id, values, nextNote));
  const [notice, setNotice] = useState('');
  const task: GuardianTask = state.tasks[section.id] ?? {status:'todo',needsReview:false,note:'',applicability:'unknown'};
  const [finding] = evaluateGate(section.id,state.inputs,initialRules,new Date(),task.applicability ?? 'unknown');
  const missingLabels = section.fields.filter(field => finding.missingFields.includes(field.key)).map(field => field.label);
  const connectivity = section.id === 'G2' ? evaluateConnectivity(state.inputs) : null;
  const returnCheck = section.id === 'G5' ? classifyReturnItems(state.inputs) : null;
  const sources = officialSources.filter(source => finding.sourceRefs.includes(source.id));
  const sourceNotice = sources.some(source => sourceReviewState(source,new Date()) === 'review_due') ? '部分參考入口已到內部複核期限，請留意來源可能有變動。' : sources.some(source => sourceReviewState(source,new Date()) === 'unknown') ? '部分參考入口的查閱時間無法確認。' : '';
  const lastConfirmed = section.fields.map(field => state.inputs[field.key]?.confirmedAt).filter(Boolean).sort().at(-1);
  const saveInputs = () => { const values = Object.fromEntries(section.fields.map(field => [field.key, draft[field.key] ?? ''])); onChange(updateConfirmedInputs(state,values,new Date().toISOString())); setNotice('已記錄輸入；仍須自行核對來源。'); };
  const saveTask = (status:TaskStatus, applicability:Applicability = task.applicability ?? 'unknown', reviewed = false) => {
    if ((status==='snoozed' || status==='skipped') && !note.trim()) { setNotice('請先填寫暫緩或略過原因。'); return; }
    if (applicability === 'not_applicable' && !note.trim()) { setNotice('請先填寫不適用的原因。'); return; }
    const snoozedUntil = draft.snoozedUntil || task.snoozedUntil || '';
    if (status === 'snoozed' && !addCalendarDays(snoozedUntil,0)) { setNotice('請先填寫有效的暫緩期限。'); return; }
    if (reviewed && hasUnrecordedGateInputs(state, section.id)) { setNotice('資料有尚未記錄的變更，請先記錄這些資料再重新檢視。'); return; }
    const next = {...state,tasks:{...state.tasks,[section.id]:{status,applicability,needsReview:reviewed ? false : task.needsReview,note:note.trim(),...(status === 'snoozed' ? {snoozedUntil} : {})}}};
    onChange(reviewed ? recordGateReview(next,section.id,new Date()) : next);
    setNotice(reviewed ? '已記錄重新檢視；這不代表官方已確認。' : '已記錄處理狀態；待複核事項需另行重新檢視。');
  };
  return <details className="guardian-card"><summary className="guardian-card-summary cursor-pointer font-bold"><span className="guardian-card-icon"><i className={`fa-solid ${gateIcons[section.id]}`} aria-hidden="true"></i></span><span className="guardian-card-copy"><strong>{section.title}</strong><span>{statusLabels[task.status]} · {finding.evidenceState==='missing' ? '缺資料' : '待確認'} · {finding.applicability === 'applicable' ? '適用' : finding.applicability === 'not_applicable' ? '不適用' : '適用性未判定'}{task.needsReview ? ' · 輸入變更待複核' : ''}</span></span><i className="fa-solid fa-chevron-down guardian-chevron" aria-hidden="true"></i></summary>
    <div className="mt-3 space-y-3 text-sm"><p>{finding.impact}</p>{missingLabels.length > 0 && <p>缺少資料：{missingLabels.join('、')}</p>}<p>下一步：{finding.actions[0]}</p>{connectivity && <ul className="list-disc pl-5">{connectivity.actions.map(action=><li key={action}>{action}</li>)}</ul>}{returnCheck && <div><p>可能需要查證的分類：{returnCheck.categories.length ? returnCheck.categories.map(c=>c.label).join('、') : '尚無法從已記錄文字分類'}</p><p>{returnCheck.action}</p>{!returnCheck.destinationKnown && <p>入境地尚未記錄，無法提供適用於目的地的確認入口。</p>}</div>}<p>依據：尚未核實符合個人條件的規定。填寫及完成狀態不代表符合規定。</p>{finding.sourceRefs.length > 0 && <details className="guardian-sources"><summary>查看官方參考入口</summary><p>其他地區請查當地主管機關；開啟可能需要網路：</p><ul className="list-disc pl-5">{officialSources.filter(source=>finding.sourceRefs.includes(source.id)).map(source=><li key={source.id}><a className="underline text-blue-700" href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a>（{source.scope}；入口查閱 {source.checkedOn}；{sourceReviewState(source,new Date()) === 'review_due' ? '入口待重新查閱' : sourceReviewState(source,new Date()) === 'unknown' ? '入口時間待確認' : '僅查閱入口'}）</li>)}</ul><p>查閱日期不代表規定現仍有效，亦不代表已核對個人條件；請以官方最新資訊為準。</p></details>}<p>資料記錄時間（裝置時區）：{lastConfirmed ? new Date(lastConfirmed).toLocaleString() : '尚未記錄'}</p>
      {sourceNotice && <p>{sourceNotice}</p>}
      {Object.keys(available).length > 0 && <button type="button" onClick={()=>changeDraft({...draft,...available},note)}>帶入旅程資料到空白欄位</button>}
      {section.fields.map(field => <label key={field.key} className="block font-semibold">{field.label}{field.hint && <span className="font-normal">（{field.hint}）</span>}
        {field.key==='compatibility' ? <select className="block border rounded p-2 w-full" value={draft[field.key] ?? ''} onChange={e=>changeDraft({...draft,[field.key]:e.target.value},note)}><option value="">尚未選擇</option><option>待確認</option><option>支援</option><option>不支援</option>{draft[field.key] && !['待確認','支援','不支援'].includes(draft[field.key]) && <option value={draft[field.key]}>{draft[field.key]}</option>}</select> : field.key==='feedback' ? <select className="block border rounded p-2 w-full" value={draft[field.key] ?? ''} onChange={e=>changeDraft({...draft,[field.key]:e.target.value},note)}><option value="">不填寫</option>{['有幫助','無幫助','時機不對','資訊錯誤','不清楚'].map(x=><option key={x}>{x}</option>)}</select> : field.key==='purchaseStatus' || field.key==='activationTiming' ? <select className="block border rounded p-2 w-full" value={draft[field.key] ?? ''} onChange={e=>changeDraft({...draft,[field.key]:e.target.value},note)}><option value="">尚未記錄</option>{(field.key==='purchaseStatus' ? ['未購買','已購買','待確認'] : ['安裝後','抵達連線後','指定日期','待確認']).map(x=><option key={x}>{x}</option>)}</select> : <input className="block border rounded p-2 w-full" value={draft[field.key] ?? ''} maxLength={500} onChange={e=>changeDraft({...draft,[field.key]:e.target.value},note)} />}</label>)}
      <button className="border rounded px-3 py-2" type="button" onClick={saveInputs}>記錄這些資料</button>
      {section.id === 'G4' && <DepartureCalculator values={draft} onChange={values=>changeDraft(values,note)} />}
      <label className="block font-semibold">備註或暫緩／略過／不適用原因<input className="block border rounded p-2 w-full" value={note} maxLength={500} onChange={e=>changeDraft(draft,e.target.value)} /></label>
      <label className="block font-semibold">暫緩至（選擇暫緩時必填）<input type="date" className="block border rounded p-2 w-full" value={draft.snoozedUntil ?? task.snoozedUntil ?? ''} onChange={e=>changeDraft({...draft,snoozedUntil:e.target.value},note)} /></label>
      <label className="block font-semibold">是否適用<select className="block border rounded p-2 w-full" value={task.applicability ?? 'unknown'} onChange={e=>saveTask(task.status,e.target.value as Applicability)}><option value="unknown">尚無法判斷</option><option value="applicable">適用</option><option value="not_applicable">不適用（須填原因）</option></select></label>
      <label className="block font-semibold">處理狀態<select className="block border rounded p-2 w-full" value={task.status} onChange={e=>saveTask(e.target.value as TaskStatus)}>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <button className="border rounded px-3 py-2" type="button" onClick={()=>saveTask(task.status,task.applicability ?? 'unknown',true)}>記錄備註與重新檢視</button>
      {!!state.runs?.[section.id]?.length && <details className="guardian-sources"><summary>查看重新檢視紀錄（{state.runs[section.id]!.length}）</summary><p>僅保留最近 20 筆，包含當時已記錄的資料，也會納入未加密備份；不代表已符合規定。</p>{[...state.runs[section.id]!].reverse().map(run => <details key={run.id}><summary>{new Date(run.recordedAt).toLocaleString()}：{run.evidenceState === 'missing' ? '資料未齊' : run.evidenceState === 'review_due' ? '來源待複核' : '仍需查證'}，規則版本 {run.ruleVersion}</summary><ul className="list-disc pl-5">{Object.entries(run.inputs).map(([key,input]) => <li key={key}>{section.fields.find(field => field.key === key)?.label ?? key}：{String(input?.value ?? '')}</li>)}</ul>{run.missingFields.length > 0 && <p>當時缺少：{run.missingFields.map(key=>section.fields.find(field=>field.key===key)?.label ?? key).join('、')}</p>}</details>)}</details>}
      {notice && <p role="status">{notice}</p>}
    </div></details>;
}
export default function GuardianPanel({ suggestions, state, onChange, onConfigureTimezone, trip }: {suggestions:Record<string,string>;key?: string;state:GuardianState;onChange:(next:GuardianState)=>void;onConfigureTimezone:()=>void;trip:{id:string;start:string;end:string;departureTimezone:string;returnTimezone:string}}) {
  const [clock,setClock] = useState(() => new Date());
  useEffect(() => { const timer=window.setInterval(()=>setClock(new Date()),60000); return ()=>window.clearInterval(timer); },[]);
  const pending = sections.filter(section => needsGateAttention(state, section.id, clock));
  let nextLabel = '請先設定出發地與回程地時區，才能顯示時點。';
  if (state.cancelled) nextLabel = '旅程已取消，不安排新提醒。';
  else if (trip.departureTimezone && trip.returnTimezone) {
    try {
      const upcoming = scheduleReminders({id:trip.id,start:trip.start,end:trip.end,timezone:trip.departureTimezone,returnTimezone:trip.returnTimezone,clock,guardian:state});
      nextLabel = upcoming.length ? `${upcoming[0].date}：${upcoming[0].title}` : '目前沒有可排程的提醒；仍請自行查證旅程資料。';
    } catch { nextLabel = '無法判定提醒時點，請確認日期與時區。'; }
  }
  return <section className="guardian-section max-w-4xl mx-auto mb-6" aria-label="旅程檢查"><div className="guardian-heading"><div><h2>旅程準備</h2><p>一步一步，準備好重要的事。</p></div><span>{pending.length} 項需要留意</span></div><div className="guardian-next"><span className="guardian-next-icon"><i className="fa-regular fa-calendar" aria-hidden="true"></i></span><div><p className="guardian-next-label">接下來</p><p>{nextLabel}</p>{!state.cancelled && (!trip.departureTimezone || !trip.returnTimezone) && <button className="timezone-action" type="button" onClick={onConfigureTimezone}>設定時區</button>}</div></div><p className="guardian-explainer">展開項目記錄你的準備進度；完成僅代表你的處理紀錄，規定仍需自行查證。</p><LocalExtraction state={state} onChange={onChange} /><div className="space-y-2">{sections.map(section=><Card suggestions={suggestions} key={section.id} section={section} state={state} onChange={onChange} />)}</div><details className="trip-cancel"><summary>旅程狀態：{state.cancelled ? '已取消' : '進行中'}</summary><p>取消後不再匯出新提醒；已匯入外部日曆的提醒需自行刪除。</p><button type="button" className="border rounded p-2 mt-2" onClick={() => { if (window.confirm(state.cancelled ? '恢復旅程並將已有檢查標記待複核？' : '標記旅程已取消？已匯出的日曆不會自動刪除。')) onChange(setTripCancelled(state,!state.cancelled)); }}>{state.cancelled ? '恢復旅程' : '取消旅程'}</button></details></section>;
}
