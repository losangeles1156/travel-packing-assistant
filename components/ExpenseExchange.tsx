import React, { useState } from 'react';
import { estimateExchange, expenseTotals, isExchangeRate, type Expense, type ExchangeRate } from '../domain/expenses';

const empty = ():ExchangeRate => ({base:'',target:'TWD',rate:'',date:'',source:''});
export default function ExpenseExchange({expenses,rates,onChange}:{expenses:Expense[];rates:ExchangeRate[];onChange:(rates:ExchangeRate[])=>void}) {
 const [draft,setDraft]=useState<ExchangeRate>(empty),[message,setMessage]=useState('');
 const totals=expenseTotals(expenses);
 const matching=rates.find(r=>r.base===draft.base.toUpperCase() && r.target===draft.target.toUpperCase());
 const update=(key:keyof ExchangeRate,value:string)=>{setDraft(previous=>({...previous,[key]:key==='base'||key==='target'?value.toUpperCase():value}));setMessage('');};
 const save=()=>{const rate={...draft,base:draft.base.trim().toUpperCase(),target:draft.target.trim().toUpperCase(),source:draft.source.trim()};if(!isExchangeRate(rate)){setMessage('請確認不同的三碼幣別、正數匯率、有效日期及來源；匯率最多 8 位小數。');return;}const exists=rates.some(r=>r.base===rate.base&&r.target===rate.target);if(!exists&&rates.length>=50){setMessage('每趟旅程最多記錄 50 組匯率。');return;}onChange([...rates.filter(r=>r.base!==rate.base||r.target!==rate.target),rate]);setMessage('已更新匯率，請等待本機儲存完成。');};
 return <details className="expense-exchange"><summary>匯率估算（手動輸入）</summary><p>由你輸入每 1 單位原幣可換得的目標幣金額。系統不連線查詢、不自動更新，也不包含手續費或實際成交差額。</p><div className="trip-document-fields">
 <label>原幣（三碼）<input maxLength={3} value={draft.base} placeholder="例如 JPY" onChange={e=>update('base',e.target.value)} /></label><label>目標幣（三碼）<input maxLength={3} value={draft.target} placeholder="例如 TWD" onChange={e=>update('target',e.target.value)} /></label><label>每 1 原幣的匯率<input inputMode="decimal" value={draft.rate} placeholder="例如 0.21" onChange={e=>update('rate',e.target.value)} /></label><label>匯率日期<input type="date" value={draft.date} onChange={e=>update('date',e.target.value)} /></label><label>匯率來源<input maxLength={200} value={draft.source} placeholder="例如銀行牌告名稱" onChange={e=>update('source',e.target.value)} /></label></div>
 <div className="trip-document-add"><button type="button" onClick={save}>{matching?'更新這組匯率':'儲存匯率'}</button></div>{message && <p role="status">{message}</p>}
 {rates.length>0 && <div className="exchange-list"><h3>已記錄的匯率與估算</h3>{rates.map(rate=>{const total=totals.find(t=>t.currency===rate.base);return <article key={`${rate.base}-${rate.target}`}><strong>1 {rate.base} = {rate.rate} {rate.target}</strong><p>日期：{rate.date}；來源：{rate.source}（使用者輸入，請自行確認是否仍適用）</p><p>{total ? `${rate.base} ${total.amount} ≈ ${rate.target} ${estimateExchange(total.amount,rate.rate)}（估算，四捨五入至小數第 2 位）` : `目前沒有 ${rate.base} 支出可估算。`}</p><div className="trip-document-actions"><button type="button" aria-label={`編輯 ${rate.base} 換 ${rate.target} 匯率`} onClick={()=>{setDraft(rate);setMessage('');}}>編輯</button><button type="button" aria-label={`刪除 ${rate.base} 換 ${rate.target} 匯率`} onClick={()=>{if(window.confirm('確定刪除這組手動匯率？')){onChange(rates.filter(r=>r!==rate));setMessage('已刪除匯率，請等待本機儲存完成。');}}}>刪除</button></div></article>})}</div>}
 </details>;
}
