import React from 'react';
import { shoppingTotalInTwd, type CrossBorderItem, type Expense, type ExchangeRate } from '../domain/expenses';
import { goodsDeclarationStatus, returnCheckGroups, TW_GOODS_DECLARATION_TWD } from '../domain/returnItems';
import { officialSources } from '../domain/sources';

const ntd = (amount: string | number) => `NT$${Math.round(Number(amount)).toLocaleString('zh-TW')}`;
const customs = officialSources.find(source => source.id === 'tw-customs');

export default function ReturnCheck({ expenses, items, rates, onIntent }: {
  expenses: Expense[];
  items: CrossBorderItem[];
  rates: ExchangeRate[];
  onIntent: (item: CrossBorderItem, intent: 'carry' | 'leave') => void;
}) {
  const { undecided, quarantine, alcoholTobacco } = returnCheckGroups(items);
  const goods = shoppingTotalInTwd(expenses, items, rates);
  const status = goods.count ? goods.twd === null ? 'unconverted' : goodsDeclarationStatus(goods.twd) : null;
  const todo = undecided.length + quarantine.length + alcoholTobacco.length + (status === 'over' ? 1 : 0);
  const goodsMessage = status === 'over' ? '已超過申報門檻，入境時要填申報單走紅線（應申報檯）。'
    : goods.missingRates.length ? '部分支出還沒換算，無法判斷是否超過申報門檻。'
    : status === 'near' ? '接近申報門檻，再買之前留意。' : '低於申報門檻。';

  return <section className="trip-documents return-check" aria-labelledby="return-check-title">
    <div className="trip-documents-heading"><div><h2 id="return-check-title">回台入境前檢查</h2><p>{todo ? `${todo} 項要在回程前確認` : '目前沒有需要在回程前處理的項目'}</p></div></div>

    {undecided.length > 0 && <div className="return-check-group">
      <h3>還沒決定要不要帶回（{undecided.length}）</h3>
      <ul>{undecided.map(item => <li key={item.id}><span>{item.title}</span><span className="return-check-actions">
        <button type="button" aria-label={`${item.title}：會帶回`} onClick={() => onIntent(item, 'carry')}>會帶回</button>
        <button type="button" aria-label={`${item.title}：不帶回`} onClick={() => onIntent(item, 'leave')}>不帶回</button>
      </span></li>)}</ul>
    </div>}

    {quarantine.length > 0 && <div className="return-check-group return-check-danger">
      <h3><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> 動植物產品須申報並接受檢疫</h3>
      <p>水果、種子、活植物及其生鮮產品、活動物及其產品，入境時要走紅線（應申報檯）申報，不能走綠線。</p>
      <ul>{quarantine.map(item => <li key={item.id}>{item.title}</li>)}</ul>
    </div>}

    {alcoholTobacco.length > 0 && <div className="return-check-group">
      <h3>菸酒數量</h3>
      <p>酒類合計逾 1.5 公升，或捲菸逾 200 支、雪茄逾 25 支、菸絲逾 1 磅、加熱菸逾 200 支，需要申報。</p>
      <ul>{alcoholTobacco.map(item => <li key={item.id}>{item.title}：{item.quantity.trim() || '數量未填，請在下方清單補上'}</li>)}</ul>
    </div>}

    {status && <div className={`return-check-group${status === 'over' ? ' return-check-danger' : ''}`}>
      <h3>購物總額試算</h3>
      <p className="return-check-total"><strong>{goods.twd === null ? '尚未換算' : `約 ${ntd(goods.twd)}`}</strong>／申報門檻：總值逾 {ntd(TW_GOODS_DECLARATION_TWD)}</p>
      <p>{goodsMessage}</p>
      {goods.missingRates.length > 0 && <p>{goods.missingRates.join('、')} 的支出還沒有換成 TWD 的匯率，未計入。可在「我的旅程」的匯率估算新增，例如 1 {goods.missingRates[0]} = ? TWD。</p>}
      <p className="return-check-note">依你記錄的購物支出與匯率估算；標記為不帶回或在當地使用的物品不計入。海關以完稅價格認定，結果僅供參考。</p>
    </div>}

    <p className="return-check-note">攜帶新臺幣逾 10 萬元、人民幣逾 2 萬元，或外幣等值逾美金 1 萬元，也需要申報。</p>
    {customs && <p className="return-check-note">以入境臺灣為準，數字依<a href={customs.url} target="_blank" rel="noopener noreferrer">{customs.label}</a>（{customs.checkedOn} 查閱）；入境其他地區請查當地規定。</p>}
  </section>;
}
