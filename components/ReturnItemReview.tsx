import React from 'react';
import { nextBorderCheck } from '../domain/returnItems';
import type { ReturnItem } from '../domain/expenses';

const categoryLabels: Record<ReturnItem['category'],string> = {
  unknown: '尚未確認', animal: '動物產品或含動物成分', plant: '植物或農產品',
  medicine: '藥品', alcohol_tobacco: '菸酒', other: '其他',
};
const destinations = {unknown:'尚未確認',TW:'臺灣',JP:'日本',other:'其他地區'};
const sourceLinks = {
  TW: [
    ['臺灣海關：旅客申報須知','https://web.customs.gov.tw/taipei/singlehtml/3130?cntId=cus2_157042_3130'],
    ['臺灣防檢署：動物產品檢疫','https://www.aphia.gov.tw/ws.php?id=18065'],
    ['臺灣防檢署：植物產品檢疫','https://www.aphia.gov.tw/ws.php?id=10733'],
  ],
  JP: [
    ['日本海關：旅客通關','https://www.customs.go.jp/english/summary/passenger.htm'],
    ['日本動物檢疫所：動物產品','https://www.maff.go.jp/aqs/english/product/import.html'],
    ['日本植物防疫所：旅客須知','https://www.maff.go.jp/pps/j/pqaqinfo_en.html'],
  ],
};

export function ReturnItemFields({value,onChange}: {value: ReturnItem; onChange:(value:ReturnItem)=>void}) {
  return <fieldset className="return-item-fields"><legend>查核資料</legend>
    <div className="trip-document-fields">
      <label>實際入境地<select value={value.destination} onChange={e=>onChange({...value,destination:e.target.value as ReturnItem['destination']})}>
        {Object.entries(destinations).map(([code,label])=><option value={code} key={code}>{label}</option>)}
      </select></label>
    </div>
    <details><summary>補充成分、產地與數量</summary>
      <div className="trip-document-fields">
        <label>物品類別<select value={value.category} onChange={e=>onChange({...value,category:e.target.value as ReturnItem['category']})}>
          {Object.entries(categoryLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>成分或內容（選填）<input maxLength={500} value={value.ingredients} onChange={e=>onChange({...value,ingredients:e.target.value})} /></label>
        <label>產地（選填）<input maxLength={200} value={value.origin} onChange={e=>onChange({...value,origin:e.target.value})} /></label>
        <label>數量與單位（選填）<input maxLength={100} placeholder="例如 2 包" value={value.quantity} onChange={e=>onChange({...value,quantity:e.target.value})} /></label>
      </div>
    </details>
  </fieldset>;
}

export function ReturnItemReview({item,title}: {item:ReturnItem;title:string}) {
  const links = item.destination === 'TW' || item.destination === 'JP' ? sourceLinks[item.destination] : [];
  return <div className="return-review">
    <h4>入境{item.destination === 'unknown' ? '' : destinations[item.destination]} · 待查證</h4>
    <p>{nextBorderCheck(title,item)}</p>
    {(item.ingredients || item.origin || item.quantity) && <details><summary>查看已記資料</summary>
      <dl>
        {item.ingredients && <><dt>成分或內容</dt><dd>{item.ingredients}</dd></>}
        {item.origin && <><dt>產地</dt><dd>{item.origin}</dd></>}
        {item.quantity && <><dt>數量</dt><dd>{item.quantity}</dd></>}
      </dl>
    </details>}
    {links.length > 0 && <details><summary>查看官方入口</summary><ul>{links.map(([label,url])=>
      <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{label}</a></li>
    )}</ul></details>}
  </div>;
}
