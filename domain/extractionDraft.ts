import { initialRules, updateConfirmedInputs, type GuardianState, type GateId } from './guardian';

const allowed = new Set(['nationality','destination','transit','device','compatibility','connectionPlan','airline','cabin','luggageItems','flightTime','flightTimezone','terminal','departurePoint','groundTransport','buffer','returnDestination','returnItems']);
export type DraftField = { field:string; value:string; start:number; end:number };
export type ExtractionDraft = { fields:DraftField[] };

/** Validate untrusted output against exactly the user-selected source; never execute it. */
export function validateExtraction(value:unknown, source:string):ExtractionDraft {
  if (typeof source !== 'string' || source.length > 10000) throw new Error('輸入文字過長');
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(value,'fields') || Object.keys(value).some(k=>k!=='fields')) throw new Error('草稿格式不正確');
  const fields=(value as {fields?:unknown}).fields;
  if (!Array.isArray(fields) || fields.length > 20) throw new Error('草稿欄位不正確');
  const seen=new Set<string>();
  const checked=fields.map((field:unknown):DraftField=>{
    if (!field || typeof field!=='object' || Array.isArray(field)) throw new Error('欄位格式不正確');
    if (['field','value','start','end'].some(k=>!Object.hasOwn(field,k)) || Object.keys(field).some(k=>!['field','value','start','end'].includes(k))) throw new Error('草稿包含不支援內容');
    const f=field as DraftField;
    if (typeof f.field!=='string' || !allowed.has(f.field) || seen.has(f.field) || typeof f.value!=='string' || !f.value.trim() || f.value.length>500 || !Number.isInteger(f.start) || !Number.isInteger(f.end) || f.start<0 || f.end<=f.start || f.end>source.length || source.slice(f.start,f.end)!==f.value) throw new Error('草稿欄位無法由原文確認');
    seen.add(f.field); return {field:f.field,value:f.value,start:f.start,end:f.end};
  });
  return {fields:checked};
}

/** Explicit selection is required; existing confirmed values need explicit replacement. */
export function acceptExtraction(state:GuardianState, draft:ExtractionDraft, source:string, selected:string[], replace:string[], now:string):GuardianState {
  const checked=validateExtraction(draft,source);
  if (!Array.isArray(selected) || !Array.isArray(replace) || new Set(selected).size!==selected.length || new Set(replace).size!==replace.length || selected.some(key=>!checked.fields.some(f=>f.field===key)) || replace.some(key=>!selected.includes(key))) throw new Error('選取欄位不正確');
  const permitted=new Set(replace);
  const values:Record<string,string>={};
  const gates:GateId[] = ['G1','G2','G3','G4','G5','G6'];
  for (const f of checked.fields) {
    if (!selected.includes(f.field)) continue;
    if (state.inputs[f.field] && !permitted.has(f.field)) throw new Error('已確認欄位需要明確同意才能取代');
    for (const gate of gates) {
      const keys=initialRules.filter(rule=>rule.gate===gate).flatMap(rule=>[...rule.required,...(rule.watch ?? [])]);
      const draftValues=state.drafts?.[gate]?.values;
      if(keys.includes(f.field) && draftValues && f.field in draftValues && draftValues[f.field].trim()!==String(state.inputs[f.field]?.value ?? '').trim()) throw new Error('此欄位有尚未記錄的草稿，請先處理');
    }
    values[f.field]=f.value;
  }
  const updated=updateConfirmedInputs(state,values,now);
  if(!updated.drafts) return updated;
  const drafts={...updated.drafts};
  for(const gate of gates){
    const old=drafts[gate]; if(!old) continue;
    const keys=initialRules.filter(rule=>rule.gate===gate).flatMap(rule=>[...rule.required,...(rule.watch ?? [])]);
    const matched=Object.entries(values).filter(([key])=>keys.includes(key));
    if(matched.length) drafts[gate]={...old,values:{...old.values,...Object.fromEntries(matched)}};
  }
  return {...updated,drafts};
}

/** Fixture-only adapter: receives prebuilt data and performs no network or AI call. */
export function mockExtraction(source:string, fixture:unknown):ExtractionDraft {
  return validateExtraction(fixture,source);
}

/** Extract exact labelled lines only; ambiguous duplicates are omitted, never guessed. */
export function extractLocalLabels(source:string):ExtractionDraft {
  if(source.length>10000)throw new Error('輸入文字過長');
  const labels:Record<string,string>={'國籍':'nationality','目的地':'destination','轉機地點或無轉機':'transit','裝置型號':'device','相容性確認結果':'compatibility','上網方式與啟用條件':'connectionPlan','航空公司':'airline','艙等':'cabin','需確認的物品及條件':'luggageItems','航班日期與時間':'flightTime','航班時間所屬時區':'flightTimezone','航廈':'terminal','出發地':'departurePoint','已確認的交通與備案':'groundTransport','預留緩衝時間':'buffer','回程入境地':'returnDestination','物品分類與數量':'returnItems'};
  const result=new Map<string,DraftField>(); const conflicts=new Set<string>();
  const lines=source.matchAll(/[^\r\n]+/g);
  for(const line of lines){
    const match=/^\s*([^:：]+)[:：]\s*(.*?)\s*$/.exec(line[0]);
    if(!match)continue;
    const key=labels[match[1].trim()], value=match[2];if(!key || !value || value.length>500)continue;
    if(result.has(key)||conflicts.has(key)){result.delete(key);conflicts.add(key);continue;}
    const local=line[0].lastIndexOf(value);const start=(line.index??0)+local;
    result.set(key,{field:key,value,start,end:start+value.length});
  }
  return validateExtraction({fields:[...result.values()]},source);
}
