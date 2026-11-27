import React, { useEffect, useRef, useState } from 'react';
import { carryIntentLabels, CROSS_BORDER_ITEM_LIMIT, emptyReturnItem, isCrossBorderItem, needsBorderReview, type CrossBorderItem } from '../domain/expenses';
import { prepareReceiptImage } from '../services/receiptImage';
import { ReturnItemFields, ReturnItemReview } from './ReturnItemReview';

const newItem = (destination: CrossBorderItem['destination']): CrossBorderItem => ({
  ...emptyReturnItem(), destination, title: '', id: '', intent: 'undecided',
});

export default function CrossBorderShopping({ items, defaultDestination, onChange, onCheckout }: {
  key?: string;
  items: CrossBorderItem[];
  onCheckout: () => void;
  defaultDestination: CrossBorderItem['destination'];
  onChange: (items: CrossBorderItem[]) => void;
}) {
  const [draft, setDraft] = useState<CrossBorderItem>();
  const [notice, setNotice] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const imageRequest = useRef(0);
  const nameInput = useRef<HTMLInputElement>(null);
  const draftId = draft?.id;
  useEffect(()=>{ if (draftId !== undefined) nameInput.current?.focus(); },[draftId]);

  function edit(item?: CrossBorderItem) {
    imageRequest.current++;
    setImageBusy(false);
    setNotice('');
    setDraft(item);
  }

  async function attachImage(file?: File) {
    if (!file) return;
    const request = ++imageRequest.current;
    setImageBusy(true);
    setNotice('');
    try {
      const packageImage = await prepareReceiptImage(file);
      if (request === imageRequest.current) setDraft(previous => previous && {...previous, packageImage});
    } catch (error) {
      if (request === imageRequest.current) setNotice(error instanceof Error ? error.message : '無法處理包裝照片。');
    } finally {
      if (request === imageRequest.current) setImageBusy(false);
    }
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || imageBusy) return;
    const existing = items.find(item=>item.id===draft.id);
    if (draft.id && !existing) { setNotice('這件物品已不在清單中，請重新新增。'); return; }
    if (!draft.id && items.length >= CROSS_BORDER_ITEM_LIMIT) { setNotice('此旅程的跨境物品清單已達上限。'); return; }
    const item = {...draft, expenseId: existing?.expenseId, title: draft.title.trim(), id: draft.id || 'item:'+(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)};
    if (!isCrossBorderItem(item)) { setNotice('請輸入物品名稱並確認資料格式。'); return; }
    onChange(existing ? items.map(previous=>previous.id===item.id ? item : previous) : [...items,item]);
    edit();
    setNotice('已更新跨境物品，請等待本機儲存完成。');
  }

  return <section className="trip-documents" aria-label="跨境物品">
    <div className="trip-documents-heading"><div><h2>跨境物品</h2><p>在店裡先查，結帳後可把物品連到同一筆支出。</p></div></div>
    {!draft && <div className="trip-document-add"><button type="button" onClick={()=>edit(newItem(defaultDestination))}>買前查一下</button>{items.some(item=>!item.expenseId) && <button type="button" onClick={onCheckout}>記一筆購物支出</button>}</div>}
    {draft && <form className="trip-document-editor" onSubmit={save}>
      <h3>{draft.id ? '編輯物品' : '買前查一下'}</h3>
      <div className="trip-document-fields">
        <label>商品名稱<input ref={nameInput} value={draft.title} maxLength={200} required onChange={e=>setDraft({...draft,title:e.target.value})} /></label>
        <label>預計怎麼處理<select value={draft.intent} onChange={e=>setDraft({...draft,intent:e.target.value as CrossBorderItem['intent']})}>
          {Object.entries(carryIntentLabels).map(([intent,label])=><option key={intent} value={intent}>{label}</option>)}
        </select></label>
      </div>
      <ReturnItemFields value={draft} onChange={details=>setDraft({...draft,...details})} />
      {draft.title.trim() && needsBorderReview(draft) && <ReturnItemReview item={draft} title={draft.title} />}
      <details className="receipt-editor"><summary>包裝照片（選填）</summary>
        <label>選擇包裝照片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void attachImage(e.target.files?.[0]);e.target.value='';}} /></label>
        {imageBusy && <p role="status">正在處理包裝照片…</p>}
        {draft.packageImage && <><img src={draft.packageImage} alt="包裝照片預覽" /><button type="button" onClick={()=>{imageRequest.current++;setImageBusy(false);setDraft({...draft,packageImage:undefined});}}>移除照片</button></>}
      </details>
      <div className="trip-document-add"><button type="submit" disabled={imageBusy}>儲存物品</button><button type="button" onClick={()=>edit()}>取消</button></div>
    </form>}
    {notice && <p role="status" className="trip-document-notice">{notice}</p>}
    {!items.length && !draft && <p className="trip-documents-empty">目前沒有跨境物品紀錄。</p>}
    {items.length > 0 && <div className="trip-document-list">
      {[...items.filter(needsBorderReview),...items.filter(item=>!needsBorderReview(item))].map(item=>
        <article className="trip-document-card" key={item.id}>
          <div><h3>{item.title}</h3><p>{carryIntentLabels[item.intent]} · {item.expenseId ? '已連結支出' : '未連結支出'}</p>
            {needsBorderReview(item) && <ReturnItemReview item={item} title={item.title} />}
            {item.packageImage && <details className="receipt-preview"><summary>查看包裝照片</summary><img src={item.packageImage} alt={item.title+'的包裝'} loading="lazy" /></details>}
          </div>
          <div className="trip-document-actions">
            <button type="button" aria-label={'編輯物品 '+item.title} onClick={()=>edit(item)}>編輯</button>
            <button type="button" aria-label={'刪除物品 '+item.title} onClick={()=>{
              if (!window.confirm('確定刪除這件物品？相關支出會保留。')) return;
              onChange(items.filter(previous=>previous.id!==item.id));
              if (draft?.id===item.id) edit();
            }}>刪除</button>
          </div>
        </article>
      )}
    </div>}
  </section>;
}
