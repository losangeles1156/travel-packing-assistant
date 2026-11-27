import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CROSS_BORDER_ITEM_LIMIT, crossBorderItemFromExpense, expenseTotals, isExpense, linkExpenseItems, type Expense, type CrossBorderItem } from '../domain/expenses';
import { expenseReturnCategories, prohibitedReturnCategories } from '../domain/returnItems';
import { prepareReceiptImage } from '../services/receiptImage';
import ExpenseExchange from './ExpenseExchange';
import ReceiptTextImport from './ReceiptTextImport';
import type { ReceiptRequest } from '../domain/receiptText';
import type { ExchangeRate } from '../domain/expenses';
import type { TripDisruption } from '../domain/tripDisruptions';

const categories: Record<Expense['category'],string>={food:'餐飲',transport:'交通',lodging:'住宿',shopping:'購物',other:'其他'};
const empty = ():Omit<Expense,'id'> => ({title:'',amount:'',currency:'TWD',date:'',category:'other',disruptionId:'',receipt:'unknown',note:''});
type RiskAlert = {expenseId:string;labels:string[];category:CrossBorderItem['category']};
export default function TripExpenses({expenses,items,disruptions,rates,onRatesChange,onChange,defaultDestination,checkoutRequest=0,receiptRequest}:{key?:string;checkoutRequest?:number;receiptRequest?:ReceiptRequest|null;expenses:Expense[];items:CrossBorderItem[];disruptions:TripDisruption[];rates:ExchangeRate[];defaultDestination:CrossBorderItem['destination'];onRatesChange:(rates:ExchangeRate[])=>void;onChange:(next:Expense[],items:CrossBorderItem[])=>void}) {
 const [open,setOpen]=useState(false),[editing,setEditing]=useState(''),[draft,setDraft]=useState(empty),[notice,setNotice]=useState('');
 const [riskAlert,setRiskAlert]=useState<RiskAlert|null>(null);
 const riskAlertRef=useRef<HTMLDivElement>(null);
 const [receiptImage,setReceiptImage]=useState<string|undefined>(undefined), [imageBusy,setImageBusy]=useState(false), [imageError,setImageError]=useState('');
 const imageRequest=useRef(0);
 const resetImage=()=>{imageRequest.current++;setReceiptImage(undefined);setImageBusy(false);setImageError('');};
 const chooseImage=async(file:File|undefined)=>{if(!file)return;const request=++imageRequest.current;setImageBusy(true);setImageError('');try{const image=await prepareReceiptImage(file);if(request===imageRequest.current)setReceiptImage(image);}catch(error){if(request===imageRequest.current)setImageError(error instanceof Error?error.message:'無法處理圖片。');}finally{if(request===imageRequest.current)setImageBusy(false);}};
 const [selectedItems,setSelectedItems]=useState<string[]>([]);
 const openNew = (category:Expense['category']='other')=>{
   resetImage();setDraft({...empty(),category});setSelectedItems([]);setEditing('');setOpen(true);setNotice('');setReceiptSeed(null);
 };
 const [receiptSeed,setReceiptSeed]=useState<ReceiptRequest|null>(null);
 const startReceipt=(seed:ReceiptRequest)=>{openNew('shopping');setReceiptSeed(seed);};
 useEffect(()=>{ if (receiptRequest) startReceipt(receiptRequest); },[receiptRequest?.id]);
 const lastCheckout = useRef(checkoutRequest);
 useEffect(()=>{
   if (checkoutRequest === lastCheckout.current) return;
   lastCheckout.current = checkoutRequest;
   if (!open) openNew('shopping');
 },[checkoutRequest]);
 const linked = useMemo(()=>{
   const groups = new Map<string,CrossBorderItem[]>();
   for (const item of items) {
     if (!item.expenseId) continue;
     const group = groups.get(item.expenseId) ?? [];
     group.push(item);
     groups.set(item.expenseId,group);
   }
   return groups;
 },[items]);
 const riskExpense = riskAlert && !open && !linked.has(riskAlert.expenseId) ? expenses.find(item=>item.id===riskAlert.expenseId) : undefined;
 useEffect(()=>{ if (riskExpense) riskAlertRef.current?.focus(); },[riskExpense?.id]);
 const resolveRisk=(expense:Expense,intent:'local'|'undecided')=>{
   if (!riskAlert) return;
   if (items.length>=CROSS_BORDER_ITEM_LIMIT) { setNotice('跨境物品清單已達上限。'); return; }
   onChange(expenses,[...items,crossBorderItemFromExpense(expense,defaultDestination,riskAlert.category,intent)]);
   setRiskAlert(null);
   setNotice(intent==='local' ? `已記下「${expense.title}」會在當地吃完，不列入入境檢核。` : `已將「${expense.title}」加入跨境物品檢核，可在下方「旅遊記帳」分頁確認。`);
 };
 const set=(key:keyof Omit<Expense,'id'>,value:string)=>setDraft(previous=>({...previous,[key]:value}));
 const save=()=>{if(!editing && expenses.length>=2000){setNotice('每趟旅程最多記錄 2,000 筆支出。');return;}if(imageBusy){setNotice('圖片仍在處理，請稍候。');return;}const {returnItem: _oldReturnItem, receiptImage: _oldReceiptImage, ...base}=draft;const entry={...base,...(receiptImage?{receiptImage}:{}),title:draft.title.trim(),currency:draft.currency.trim().toUpperCase(),note:draft.note.trim(),id:editing || globalThis.crypto?.randomUUID?.() || `expense-${Date.now()}-${Math.random().toString(36).slice(2)}`};if(!isExpense(entry)){setNotice('請確認名稱、金額（最多兩位小數）、三碼幣別與日期。');return;}const nextItems=linkExpenseItems(items,entry.id,selectedItems);const risks=expenseReturnCategories(entry).filter(risk=>prohibitedReturnCategories.has(risk.id));onChange(editing ? expenses.map(item=>item.id===editing?entry:item):[...expenses,entry],nextItems);setRiskAlert(risks.length && !nextItems.some(item=>item.expenseId===entry.id) ? {expenseId:entry.id,labels:risks.map(risk=>risk.label),category:risks[0].id as CrossBorderItem['category']} : null);setOpen(false);setEditing('');setDraft(empty());setSelectedItems([]);resetImage();setNotice('已更新支出，請等待本機儲存完成。');};
 return <section className="trip-documents trip-expenses" aria-label="旅途記帳"><div className="trip-documents-heading"><div><h2>旅途記帳</h2><p>記下旅途支出，保留變動相關單據的提醒。</p></div></div>
 {expenses.length ? <><div className="expense-totals" aria-label="各幣別支出合計">{expenseTotals(expenses).map(total=><div key={total.currency}><span>{total.currency}</span><strong>{total.amount}</strong></div>)}</div><p className="expense-caption">各幣別分開加總；下方可使用自行記錄的匯率估算。</p><div className="trip-document-list">{[...expenses].reverse().map(item=>{const event=disruptions.find(d=>d.id===item.disruptionId);return <article className="trip-document-card" key={item.id}><div><span className="trip-document-type">{categories[item.category]}</span><h3>{item.title}</h3><p>{item.currency} {item.amount} · {item.date || '日期未記錄'}</p>{item.disruptionId && <p>關聯變動：{event ? `${event.original.title} · ${event.type==='cancelled'?'取消':event.type==='rescheduled'?'改期':'延誤'}` : '原變動紀錄已刪除，請重新確認'}</p>}<p>單據：{item.receipt==='kept'?'已保留':item.receipt==='needed'?'待保留':'未記錄'}</p>{item.note && <p>{item.note}</p>}{item.receiptImage && <details className="receipt-preview"><summary>查看單據影像</summary><img src={item.receiptImage} alt={`${item.title} 的單據影像`} loading="lazy" /></details>}{linked.has(item.id) && <p>連結物品：{linked.get(item.id)?.map(product=>product.title).join('、')}</p>}</div><div className="trip-document-actions"><button type="button" aria-label={`編輯 ${item.title}`} onClick={()=>{setDraft({...item});resetImage();setReceiptImage(item.receiptImage);setSelectedItems(linked.get(item.id)?.map(product=>product.id) ?? []);setEditing(item.id);setOpen(true);setNotice('');}}>編輯</button><button type="button" aria-label={`刪除 ${item.title}`} onClick={()=>{if(window.confirm('確定刪除這筆支出及其單據影像？已連結的跨境物品會保留。')){onChange(expenses.filter(e=>e.id!==item.id),linkExpenseItems(items,item.id,[]));if(editing===item.id){setOpen(false);setEditing('');setDraft(empty());}setNotice('已刪除支出，請等待本機儲存完成。');}}}>刪除</button></div></article>})}</div></> : <p className="trip-documents-empty">尚未記錄旅途支出。</p>}
 <ExpenseExchange expenses={expenses} rates={rates} onChange={onRatesChange} />
 <div className="trip-document-add"><button type="button" onClick={()=>openNew()}>＋ 新增支出</button><button type="button" className="receipt-capture-button" onClick={()=>startReceipt({id:Date.now(),text:''})}><i className="fa-solid fa-camera" aria-hidden="true" /> 拍收據記帳</button></div>
 {open && <div className="trip-document-editor"><h3>{editing?'編輯支出':'新增支出'}</h3><ReceiptTextImport key={`${editing || 'new'}-${receiptSeed?.id ?? 0}`} seed={receiptSeed} form={{title:draft.title,amount:draft.amount,currency:draft.currency,date:draft.date,note:draft.note,category:draft.category}} onApply={next=>setDraft(previous=>({...previous,...next,category:next.category as Expense['category']}))} /><div className="trip-document-fields"><label>支出名稱<input value={draft.title} maxLength={200} onChange={e=>set('title',e.target.value)} /></label><label>金額<input value={draft.amount} inputMode="decimal" placeholder="例如 1250 或 12.50" onChange={e=>set('amount',e.target.value)} /></label><label>幣別（三碼）<input value={draft.currency} maxLength={3} placeholder="例如 TWD、JPY" onChange={e=>set('currency',e.target.value.toUpperCase())} /></label><label>日期（選填）<input type="date" value={draft.date} onChange={e=>set('date',e.target.value)} /></label><label>分類<select value={draft.category} onChange={e=>set('category',e.target.value)}>{Object.entries(categories).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label><label>關聯航班變動（選填）<select value={draft.disruptionId} onChange={e=>set('disruptionId',e.target.value)}><option value="">不關聯</option>{draft.disruptionId && !disruptions.some(d=>d.id===draft.disruptionId) && <option value={draft.disruptionId}>原變動紀錄已刪除</option>}{disruptions.map(event=><option key={event.id} value={event.id}>{event.original.title} · {event.type==='cancelled'?'取消':event.type==='rescheduled'?'改期':'延誤'} · {event.newDate||'日期未確認'}</option>)}</select></label><label>單據狀態<select value={draft.receipt} onChange={e=>set('receipt',e.target.value)}><option value="unknown">未記錄</option><option value="needed">待保留</option><option value="kept">已保留</option></select></label><label>備註（選填）<textarea value={draft.note} maxLength={500} onChange={e=>set('note',e.target.value)} /></label></div><fieldset className="return-item-fields"><legend>連結這筆支出的物品</legend>
 {items.some(item=>!item.expenseId || item.expenseId===editing) ? items.filter(item=>!item.expenseId || item.expenseId===editing).map(item=>
   <label className="return-toggle" key={item.id}><input type="checkbox" checked={selectedItems.includes(item.id)} onChange={e=>{
     const checked = e.target.checked;
     setSelectedItems(previous=>checked ? [...previous,item.id] : previous.filter(id=>id!==item.id));
   }} /> {item.title}</label>
 ) : <p>可先在「旅遊記帳」分頁新增商品，再回來連結。</p>}
 </fieldset><div className="receipt-editor"><h4>單據影像（選填）</h4><p>支援 JPEG、PNG、WebP；原圖不超過 15 MB。圖片會在本機縮小轉為 JPEG，請確認文字仍可辨識。影像包含在未加密備份中。</p><label>選擇單據圖片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void chooseImage(e.target.files?.[0]);e.target.value='';}} /></label>{imageBusy && <p role="status">正在處理圖片…</p>}{imageError && <p role="alert">{imageError}</p>}{receiptImage && <div><img src={receiptImage} alt="待儲存的單據預覽" /><button type="button" onClick={resetImage}>移除這張單據</button></div>}{!receiptImage && draft.receiptImage && <p>儲存後將移除此單據影像。</p>}</div><p>單據狀態由你自行設定；是否可理賠須向保險公司確認。</p><div className="trip-document-add"><button type="button" disabled={imageBusy} onClick={save}>儲存支出</button><button type="button" onClick={()=>{resetImage();setOpen(false);setNotice('');}}>取消</button></div></div>}
 {riskExpense && riskAlert && <div ref={riskAlertRef} tabIndex={-1} className="cb-prohibited-banner expense-risk-alert" aria-labelledby="expense-risk-title"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /><div>
   <strong id="expense-risk-title">「{riskExpense.title}」可能含有不能帶回台灣的品項</strong>
   <p className="cb-risk-tags">{riskAlert.labels.map(label=><span key={label} className="cb-risk-tag cb-risk-danger">{label}</span>)}</p>
   <p>新鮮蔬果、肉類及肉製品通常禁止帶入台灣。請在當地吃完，或確認可以攜帶後再帶回。</p>
   <div className="expense-risk-actions"><button type="button" onClick={()=>resolveRisk(riskExpense,'local')}>會在當地吃完</button><button type="button" onClick={()=>resolveRisk(riskExpense,'undecided')}>加入跨境檢核</button><button type="button" onClick={()=>setRiskAlert(null)}>稍後再說</button></div>
 </div></div>}
 {notice && <p role="status" className="trip-document-notice">{notice}</p>}</section>;
}
