import React, { useState } from 'react';
import { acceptExtraction, extractLocalLabels, type ExtractionDraft } from '../domain/extractionDraft';
import { initialRules, type GateId, type GuardianState } from '../domain/guardian';

const labels:Record<string,string>={nationality:'國籍',destination:'目的地',transit:'轉機地點或無轉機',device:'裝置型號',compatibility:'相容性確認結果',connectionPlan:'上網方式與啟用條件',airline:'航空公司',cabin:'艙等',luggageItems:'需確認的物品及條件',flightTime:'航班日期與時間',flightTimezone:'航班時間所屬時區',terminal:'航廈',departurePoint:'出發地',groundTransport:'已確認的交通與備案',buffer:'預留緩衝時間',returnDestination:'回程入境地',returnItems:'物品分類與數量'};
const gates:GateId[]=['G1','G2','G3','G4','G5','G6'];
function fieldToken(state:GuardianState,field:string):string {
 return JSON.stringify({input:state.inputs[field] ?? null,drafts:gates.filter(gate=>initialRules.some(rule=>rule.gate===gate&&[...rule.required,...(rule.watch??[])].includes(field))).map(gate=>({gate,value:state.drafts?.[gate]?.values?.[field] ?? null}))});
}
export default function LocalExtraction({state,onChange}:{state:GuardianState;onChange:(state:GuardianState)=>void}) {
 const [text,setText]=useState(''),[draft,setDraft]=useState<ExtractionDraft|null>(null),[selected,setSelected]=useState<string[]>([]),[replace,setReplace]=useState<string[]>([]),[baseline,setBaseline]=useState<Record<string,string>>({}),[notice,setNotice]=useState('');
 const clear=()=>{setText('');setDraft(null);setSelected([]);setReplace([]);setBaseline({});setNotice('');};
 const parse=()=>{try{const next=extractLocalLabels(text);setDraft(next);setSelected([]);setReplace([]);setBaseline(Object.fromEntries(next.fields.map(field=>[field.field,fieldToken(state,field.field)])));setNotice(next.fields.length?'請核對原文並勾選需要記錄的欄位。':'沒有找到可辨識且不重複的欄位；可依範例調整，或手動填寫。');}catch{setDraft(null);setNotice('文字過長或格式不正確；最多 10,000 字。');}};
 const apply=()=>{if(!draft||!selected.length){setNotice('請先選擇要記錄的欄位。');return;}if(selected.some(key=>baseline[key]!==fieldToken(state,key))){setNotice('旅程檢查資料已變更，請重新擷取並核對。');setDraft(null);return;}try{const next=acceptExtraction(state,draft,text,selected,replace,new Date().toISOString());onChange(next);clear();setNotice('已記錄所選資料，請等待本機儲存完成；相關事項仍需查證。');}catch(error){setNotice(error instanceof Error ? error.message : '無法記錄資料，請重新核對。');}};
 const toggle=(value:string,values:string[],setter:(v:string[])=>void)=>setter(values.includes(value)?values.filter(item=>item!==value):[...values,value]);
 return <details className="local-extraction" onToggle={event=>{if(!event.currentTarget.open)clear();}}><summary>貼上文字，整理檢查資料</summary><p>只在這個瀏覽器比對明確標記的欄位，不使用 AI 或連線。避免貼上護照號碼、付款資訊等敏感資料；原文不會加入旅程或備份。</p><p>範例：每行輸入「國籍：臺灣」、「目的地：日本」或「航空公司：測試航空」。重複標籤不會擷取。</p>
 <label>要整理的文字<textarea maxLength={10000} value={text} onChange={event=>{setText(event.target.value);setDraft(null);setSelected([]);setReplace([]);setNotice('');}} placeholder={'國籍：臺灣\n目的地：日本'} /></label><button type="button" onClick={parse}>產生本機草稿</button>
 {draft && draft.fields.length>0 && <div className="local-extraction-results"><h3>核對原文並選擇欄位</h3>{draft.fields.map(field=>{const existing=state.inputs[field.field];return <div className="local-extraction-row" key={field.field}><label><input type="checkbox" checked={selected.includes(field.field)} onChange={()=>{if(selected.includes(field.field))setReplace(replace.filter(key=>key!==field.field));toggle(field.field,selected,setSelected);}} /> <strong>{labels[field.field]}</strong>：{field.value}</label><p>原文內容：{text.slice(field.start,field.end)}</p>{existing && <><p>目前已記錄：{String(existing.value)}</p><label><input type="checkbox" disabled={!selected.includes(field.field)} checked={selected.includes(field.field)&&replace.includes(field.field)} onChange={()=>toggle(field.field,replace,setReplace)} /> 同意取代{labels[field.field]}的既有值</label></>}</div>})}<button type="button" onClick={apply}>確認記錄所選欄位</button></div>}
 {notice && <p role="status">{notice}</p>}</details>;
}
