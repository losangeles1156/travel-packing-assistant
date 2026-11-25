import type { InputMap } from './guardian';
export type ReturnCategory = 'animal' | 'plant' | 'medicine' | 'alcohol_tobacco' | 'currency';
const patterns: {id:ReturnCategory;label:string;pattern:RegExp}[] = [
  {id:'animal',label:'動物產品',pattern:/肉類|豬肉|牛肉|雞肉|羊肉|肉乾|肉鬆|香腸|火腿|雞蛋|蛋黃|鮮魚/},
  {id:'plant',label:'植物及農產品',pattern:/水果|種子|植株|鮮花|蔬菜|農產品|盆栽/},
  {id:'medicine',label:'藥品',pattern:/藥品|處方藥|藥物|成藥/},
  {id:'alcohol_tobacco',label:'菸酒',pattern:/酒類|啤酒|清酒|威士忌|香菸|菸品|雪茄/},
  {id:'currency',label:'現金與貴重物',pattern:/現金|外幣|黃金|旅行支票/},
];
export function suggestReturnCategories(text: string) {
  return patterns.filter(x => x.pattern.test(text)).map(({id,label})=>({id,label}));
}
export function classifyReturnItems(inputs: InputMap) {
  const read=(key:string)=>{const i=inputs[key];return i?.source==='user' && Number.isFinite(Date.parse(i.confirmedAt)) && typeof i.value==='string' ? i.value.trim() : '';};
  const items=read('returnItems'), destination=read('returnDestination');
  const categories=items ? suggestReturnCategories(items) : [];
  return {destinationKnown:!!destination,itemsKnown:!!items,categories,action:'文字分類不完整，無論是否列出類別，仍須向入境地海關與檢疫機關確認品項、數量及申報要求。'};
}

/** Product words guide the next question. The answers do not decide clearance. */
export function nextBorderCheck(title:string, item:import('./expenses').ReturnItem) {
  if (item.destination === 'unknown') return '先確認實際入境地；轉機若需入境，另查轉機地規定。';
  if (item.destination === 'other') return '請查實際入境地的海關與檢疫機關；目前未收錄此路線的查核入口。';
  const words = title+' '+item.ingredients;
  const hints = suggestReturnCategories(words);
  if ((item.category === 'animal' || hints.some(hint=>hint.id==='animal') || /泡麵|拉麵|ラーメン|肉|ポーク|ビーフ|チキン|エキス|ジャーキー/.test(words)) && !item.ingredients.trim()) {
    return '查看包裝成分與配料包，保存原文或照片；商品風味名稱只能當作查詢線索。';
  }
  if ((item.category === 'alcohol_tobacco' || hints.some(hint=>hint.id==='alcohol_tobacco') || /日本酒|焼酎|ウイスキー/.test(words)) && !item.quantity.trim()) {
    return '先補品項與總數量，例如每瓶容量與瓶數，再查入境地的申報要求。';
  }
  if (item.category === 'plant' || hints.some(hint=>hint.id==='plant')) {
    return item.origin.trim() ? '依實際品項、產地及加工方式向入境地檢疫機關查證。' : '先確認包裝標示的產地與實際品項，再查入境檢疫。';
  }
  if (item.category === 'unknown' && !hints.length && !item.ingredients.trim()) return '先查看成分或商品類別。未辨識出分類的物品仍列為待查證。';
  return '請用確認的品項、成分、產地與數量向入境地主管機關查證。';
}
