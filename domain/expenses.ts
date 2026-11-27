export type ReturnItem = { destination:'unknown'|'TW'|'JP'|'other'; ingredients:string; origin:string; quantity:string; category:'unknown'|'animal'|'plant'|'medicine'|'alcohol_tobacco'|'other' };
export const emptyReturnItem = ():ReturnItem => ({destination:'unknown',ingredients:'',origin:'',quantity:'',category:'unknown'});
export function isReturnItem(value:unknown):value is ReturnItem {
 if (!value || typeof value!=='object' || Array.isArray(value)) return false;
 const v=value as ReturnItem; const bounded=(x:unknown,n:number)=>typeof x==='string' && x.length<=n;
 return ['unknown','TW','JP','other'].includes(v.destination) && ['unknown','animal','plant','medicine','alcohol_tobacco','other'].includes(v.category) && bounded(v.ingredients,500) && bounded(v.origin,200) && bounded(v.quantity,100);
}
export type Expense = { id:string; title:string; amount:string; currency:string; date:string; category:'food'|'transport'|'lodging'|'shopping'|'other'; disruptionId:string; receipt:'unknown'|'kept'|'needed'; note:string; returnItem?:ReturnItem; receiptImage?:string };
/** JPEG data only; SVG and active content are never accepted. */
export function isReceiptImage(value:unknown):value is string {
 if(typeof value!=='string' || value.length>700_000 || value.length<40 || !value.startsWith('data:image/jpeg;base64,/9j/')) return false;
 const payload=value.slice('data:image/jpeg;base64,'.length);
 return payload.length % 4===0 && /^[A-Za-z0-9+/]+={0,2}$/.test(payload);
}
export function isExpense(value:unknown):value is Expense {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v=value as Expense;
  const text=(x:unknown,n:number):x is string => typeof x==='string' && x.length<=n;
  if ((v.receiptImage !== undefined && !isReceiptImage(v.receiptImage)) || (v.returnItem !== undefined && !isReturnItem(v.returnItem)) || !text(v.id,200)||!v.id || !text(v.title,200)||!v.title.trim() || !text(v.amount,15)||!/^\d{1,10}(\.\d{1,2})?$/.test(v.amount) || !text(v.currency,3)||! /^[A-Z]{3}$/.test(v.currency) || !text(v.date,10) || !['food','transport','lodging','shopping','other'].includes(v.category) || !text(v.disruptionId,200) || !['unknown','kept','needed'].includes(v.receipt) || !text(v.note,500)) return false;
  return !v.date || (/^\d{4}-\d{2}-\d{2}$/.test(v.date) && Number.isFinite(Date.parse(`${v.date}T00:00:00Z`)) && new Date(`${v.date}T00:00:00Z`).toISOString().slice(0,10)===v.date);
}
const toCents=(amount:string)=>{const [whole,fraction='']=amount.split('.');return BigInt(whole)*100n+BigInt((fraction+'00').slice(0,2));};
const fromCents=(cents:bigint)=>`${cents/100n}.${String(cents%100n).padStart(2,'0')}`;
/** Decimal arithmetic in cents; currencies remain separate and no exchange rate is implied. */
export function expenseTotals(expenses:Expense[]):{currency:string;amount:string}[] {
  const totals=new Map<string,bigint>();
  for(const expense of expenses)totals.set(expense.currency,(totals.get(expense.currency)||0n)+toCents(expense.amount));
  return [...totals].sort(([a],[b])=>a.localeCompare(b)).map(([currency,cents])=>({currency,amount:fromCents(cents)}));
}

export type ExchangeRate = {base:string;target:string;rate:string;date:string;source:string};
export function isExchangeRate(value:unknown):value is ExchangeRate {
 if(!value || typeof value!=='object' || Array.isArray(value))return false;
 const v=value as ExchangeRate;
 if(typeof v.base!=='string'||typeof v.target!=='string'||! /^[A-Z]{3}$/.test(v.base)||! /^[A-Z]{3}$/.test(v.target)||v.base===v.target||typeof v.rate!=='string'||!/^\d{1,6}(\.\d{1,8})?$/.test(v.rate)||!/[1-9]/.test(v.rate)||typeof v.source!=='string'||!v.source.trim()||v.source.length>200||typeof v.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v.date))return false;
 const t=Date.parse(`${v.date}T00:00:00Z`);return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===v.date;
}
/** Convert a two-decimal source total with exact arithmetic; round the result half up. */
export function estimateExchange(amount:string, rate:string):string {
 if(!/^\d{1,14}(\.\d{1,2})?$/.test(amount)||!/^\d{1,6}(\.\d{1,8})?$/.test(rate)||!/[1-9]/.test(rate))throw new Error('金額或匯率格式不正確');
 const [whole,decimal='']=amount.split('.'),[rateWhole,rateFraction='']=rate.split('.');
 const cents=BigInt(whole)*100n+BigInt((decimal+'00').slice(0,2));
 const scale=10n**BigInt(rateFraction.length), rateUnits=BigInt(rateWhole)*scale+BigInt(rateFraction || '0');
 const estimated=(cents*rateUnits+scale/2n)/scale;
 return `${estimated/100n}.${String(estimated%100n).padStart(2,'0')}`;
}

export const CROSS_BORDER_ITEM_LIMIT = 5000;
export const carryIntentLabels = {
  undecided: '尚未決定',
  carry: '帶過境',
  local: '在當地使用',
  leave: '不攜帶',
} as const;

export type CrossBorderItem = ReturnItem & {
  id: string;
  title: string;
  intent: keyof typeof carryIntentLabels;
  expenseId?: string;
  packageImage?: string;
};
export function crossBorderItemFromExpense(expense:Pick<Expense,'id'|'title'>, destination:ReturnItem['destination'], category:ReturnItem['category'], intent:CrossBorderItem['intent']):CrossBorderItem {
  const id = 'item:' + (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return { ...emptyReturnItem(), destination, category, id, title: expense.title, intent, expenseId: expense.id };
}

export function isCrossBorderItem(value: unknown): value is CrossBorderItem {
  if (!isReturnItem(value)) return false;
  const item = value as CrossBorderItem;
  return typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 210 &&
    typeof item.title === 'string' && item.title.trim().length > 0 && item.title.length <= 200 &&
    typeof item.intent === 'string' && Object.hasOwn(carryIntentLabels, item.intent) &&
    (item.expenseId === undefined || (typeof item.expenseId === 'string' && item.expenseId.length > 0 && item.expenseId.length <= 200)) &&
    (item.packageImage === undefined || isReceiptImage(item.packageImage));
}

export function migrateExpenseItems(expenses: Expense[], items: CrossBorderItem[] = []) {
  if (!expenses.some(expense => expense.returnItem)) return { expenses, items };
  const migrated = [...items];
  const ids = new Set(items.map(item => item.id));
  const payments = expenses.map(expense => {
    const { returnItem, ...payment } = expense;
    if (!returnItem) return expense;
    const id = 'legacy:' + expense.id;
    if (!ids.has(id)) {
      migrated.push({ ...returnItem, id, title: expense.title.trim(), expenseId: expense.id, intent: 'carry' });
      ids.add(id);
    }
    return payment;
  });
  return { expenses: payments, items: migrated };
}

export function linkExpenseItems(items: CrossBorderItem[], expenseId: string, selected: string[]): CrossBorderItem[] {
  const ids = new Set(selected);
  return items.map(item => {
    if (ids.has(item.id) && !item.expenseId) return { ...item, expenseId };
    if (item.expenseId !== expenseId || ids.has(item.id)) return item;
    const { expenseId: _, ...unlinked } = item;
    return unlinked;
  });
}

/** Shopping that may come home, in TWD via the user's own rates. A payment drops out only when every linked item stays abroad. */
export function shoppingTotalInTwd(expenses:Expense[], items:CrossBorderItem[], rates:ExchangeRate[]) {
  const staysAbroad=(expense:Expense)=>{const linked=items.filter(item=>item.expenseId===expense.id);return linked.length>0 && linked.every(item=>item.intent==='local'||item.intent==='leave');};
  const counted=expenses.filter(expense=>expense.category==='shopping' && !staysAbroad(expense));
  let cents=0n,converted=0;const missingRates:string[]=[];
  for(const total of expenseTotals(counted)){
    const rate=rates.find(r=>r.base===total.currency && r.target==='TWD');
    if(total.currency!=='TWD' && !rate){missingRates.push(total.currency);continue;}
    cents+=toCents(rate ? estimateExchange(total.amount,rate.rate) : total.amount);
    converted++;
  }
  return {count:counted.length, twd:converted ? fromCents(cents) : null, missingRates};
}

export function needsBorderReview(item: CrossBorderItem) {
  return item.intent === 'carry' || item.intent === 'undecided';
}
