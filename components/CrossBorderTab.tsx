import React, { useMemo, useState } from 'react';
import { carryIntentLabels, CROSS_BORDER_ITEM_LIMIT, emptyReturnItem, isCrossBorderItem, needsBorderReview, type CrossBorderItem, type Expense } from '../domain/expenses';
import { suggestReturnCategories } from '../domain/returnItems';
import { ReturnItemFields, ReturnItemReview } from './ReturnItemReview';

type RiskExpense = {
  expense: Expense;
  categories: { id: string; label: string }[];
  linked: boolean;
};

const STRICT_CATEGORIES = new Set(['animal', 'plant']);

export default function CrossBorderTab({ expenses, items, defaultDestination, onChange }: {
  expenses: Expense[];
  items: CrossBorderItem[];
  defaultDestination: CrossBorderItem['destination'];
  onChange: (items: CrossBorderItem[]) => void;
}) {
  const [draft, setDraft] = useState<CrossBorderItem>();
  const [notice, setNotice] = useState('');

  const riskyExpenses = useMemo<RiskExpense[]>(() => {
    const results: RiskExpense[] = [];
    for (const expense of expenses) {
      const categories = suggestReturnCategories(expense.title);
      if (!categories.length) continue;
      const linked = items.some(item => item.expenseId === expense.id);
      results.push({ expense, categories, linked });
    }
    return results;
  }, [expenses, items]);

  const hasProhibited = riskyExpenses.some(r =>
    r.categories.some(c => STRICT_CATEGORIES.has(c.id))
  );
  const borderReviewItems = items.filter(needsBorderReview);

  function createFromExpense(expense: Expense) {
    if (items.length >= CROSS_BORDER_ITEM_LIMIT) { setNotice('跨境物品清單已達上限。'); return; }
    const id = 'item:' + (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const categories = suggestReturnCategories(expense.title);
    const category = categories[0]?.id as CrossBorderItem['category'] ?? 'unknown';
    const newItem: CrossBorderItem = { ...emptyReturnItem(), destination: defaultDestination, category, id, title: expense.title, intent: 'undecided', expenseId: expense.id };
    onChange([...items, newItem]);
    setNotice(`已將「${expense.title}」加入跨境物品清單。`);
  }

  function editItem(item?: CrossBorderItem) { setNotice(''); setDraft(item); }

  function saveItem(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const existing = items.find(i => i.id === draft.id);
    if (draft.id && !existing) { setNotice('這件物品已不在清單中。'); return; }
    if (!draft.id && items.length >= CROSS_BORDER_ITEM_LIMIT) { setNotice('跨境物品清單已達上限。'); return; }
    const item = { ...draft, expenseId: existing?.expenseId ?? draft.expenseId, title: draft.title.trim(), id: draft.id || 'item:' + (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`) };
    if (!isCrossBorderItem(item)) { setNotice('請輸入物品名稱並確認資料格式。'); return; }
    onChange(existing ? items.map(prev => prev.id === item.id ? item : prev) : [...items, item]);
    editItem();
    setNotice('已更新跨境物品。');
  }

  function deleteItem(item: CrossBorderItem) {
    if (!window.confirm('確定刪除這件物品？相關支出會保留。')) return;
    onChange(items.filter(i => i.id !== item.id));
    if (draft?.id === item.id) editItem();
  }

  function newManualItem() {
    editItem({ ...emptyReturnItem(), destination: defaultDestination, title: '', id: '', intent: 'undecided' });
  }

  return <div className="cross-border-tab">
    {hasProhibited && <div className="cb-prohibited-banner" role="alert">
      <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
      <div><strong>注意：消費紀錄中包含可能禁止攜帶入境的品項</strong>
      <p>新鮮水果、生鮮肉類等動植物產品嚴格禁止攜帶入境台灣。請確認購買的物品是否可攜帶過境，避免誤觸法規。</p></div>
    </div>}

    <section className="trip-documents" aria-label="消費紀錄風險偵測">
      <div className="trip-documents-heading"><div><h2>消費紀錄風險偵測</h2><p>根據旅途記帳自動偵測可能需要申報或禁止攜帶的物品。</p></div></div>
      {riskyExpenses.length > 0 ? <div className="trip-document-list">
        {riskyExpenses.map(({ expense, categories, linked }) => <article className="trip-document-card" key={expense.id}><div>
          <h3>{expense.title}</h3>
          <p>{expense.currency} {expense.amount} · {expense.date || '日期未記錄'}</p>
          <p className="cb-risk-tags">{categories.map(c => <span key={c.id} className={`cb-risk-tag ${STRICT_CATEGORIES.has(c.id) ? 'cb-risk-danger' : 'cb-risk-warning'}`}>{c.label}</span>)}</p>
          {linked ? <p className="cb-status-linked"><i className="fa-solid fa-circle-check" aria-hidden="true" /> 已加入跨境物品清單</p>
           : <p className="cb-status-unlinked">尚未確認是否攜帶過境</p>}
        </div>
        {!linked && <div className="trip-document-actions"><button type="button" onClick={() => createFromExpense(expense)}>加入檢核</button></div>}
        </article>)}
      </div> : expenses.length > 0
        ? <p className="trip-documents-empty">目前的消費紀錄中未偵測到需要特別注意的物品。</p>
        : <p className="trip-documents-empty">尚未記錄旅途支出。請在「我的旅程」頁面記帳，系統會自動偵測需要注意的物品。</p>}
    </section>

    <section className="trip-documents" aria-label="跨境物品清單">
      <div className="trip-documents-heading"><div><h2>跨境物品清單</h2><p>{borderReviewItems.length ? `${borderReviewItems.length} 件待確認` : '目前沒有待確認的物品'}</p></div></div>
      {draft && <form className="trip-document-editor" onSubmit={saveItem}>
        <h3>{draft.id ? '編輯物品' : '新增物品'}</h3>
        <div className="trip-document-fields">
          <label>商品名稱<input value={draft.title} maxLength={200} required onChange={e => setDraft({ ...draft, title: e.target.value })} /></label>
          <label>預計怎麼處理<select value={draft.intent} onChange={e => setDraft({ ...draft, intent: e.target.value as CrossBorderItem['intent'] })}>
            {Object.entries(carryIntentLabels).map(([intent, label]) => <option key={intent} value={intent}>{label}</option>)}
          </select></label>
        </div>
        <ReturnItemFields value={draft} onChange={details => setDraft({ ...draft, ...details })} />
        {draft.title.trim() && needsBorderReview(draft) && <ReturnItemReview item={draft} title={draft.title} />}
        <div className="trip-document-add"><button type="submit">儲存物品</button><button type="button" onClick={() => editItem()}>取消</button></div>
      </form>}
      {items.length > 0 && <div className="trip-document-list">
        {[...items.filter(needsBorderReview), ...items.filter(i => !needsBorderReview(i))].map(item => <article className="trip-document-card" key={item.id}><div>
          <h3>{item.title}</h3>
          <p>{carryIntentLabels[item.intent]} · {item.expenseId ? '已連結支出' : '手動新增'}</p>
          {needsBorderReview(item) && <ReturnItemReview item={item} title={item.title} />}
        </div><div className="trip-document-actions">
          <button type="button" aria-label={`編輯 ${item.title}`} onClick={() => editItem(item)}>編輯</button>
          <button type="button" aria-label={`刪除 ${item.title}`} onClick={() => deleteItem(item)}>刪除</button>
        </div></article>)}
      </div>}
      {!items.length && !draft && <p className="trip-documents-empty">目前沒有跨境物品紀錄。</p>}
      {!draft && <div className="trip-document-add"><button type="button" onClick={newManualItem}>＋ 手動新增物品</button></div>}
    </section>

    {notice && <p role="status" className="trip-document-notice">{notice}</p>}

    <section className="trip-documents" aria-label="入境注意事項">
      <div className="trip-documents-heading"><div><h2>入境注意事項</h2><p>以下為台灣入境一般參考，實際依目的地海關與檢疫機關公告為準。</p></div></div>
      <div className="cb-info-grid">
        <div className="cb-info-card cb-info-danger">
          <h3><i className="fa-solid fa-ban" aria-hidden="true" /> 嚴格禁止攜帶入境</h3>
          <ul><li>新鮮水果、蔬菜</li><li>生鮮肉類（含加工肉製品需確認）</li><li>活體動物、植物</li><li>未經檢疫核准的動植物產品</li><li>土壤</li></ul>
        </div>
        <div className="cb-info-card cb-info-caution">
          <h3><i className="fa-solid fa-circle-exclamation" aria-hidden="true" /> 需申報或限量</h3>
          <ul><li>菸酒（超過免稅額需申報）</li><li>藥品（個人用量限制）</li><li>現金（等值超過新台幣 10 萬需申報）</li><li>加工食品（部分需檢疫證明）</li></ul>
        </div>
      </div>
    </section>
  </div>;
}
