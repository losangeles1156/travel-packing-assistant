import type { InputMap } from './guardian';
export type ReturnCategory = 'animal' | 'plant' | 'medicine' | 'alcohol_tobacco' | 'currency';
const fruitNames = [
  '水果','草莓','芒果','蘋果','葡萄','哈密瓜','西瓜','香瓜','蜜瓜','甜瓜','水蜜桃','白桃','桃子','櫻桃','柿','水梨','梨子','洋梨',
  '奇異果','柑橘','橘子','柳橙','橙子','檸檬','香蕉','鳳梨','榴槤','山竹','荔枝','龍眼','木瓜','芭樂','番石榴','火龍果','百香果',
  '藍莓','李子','枇杷','釋迦','蓮霧','椰子','酪梨','柚子',
  'いちご','イチゴ','苺','りんご','リンゴ','林檎','ぶどう','ブドウ','マスカット','メロン','みかん','ミカン','蜜柑','マンゴー',
  'さくらんぼ','サクランボ','バナナ','キウイ',
  '과일','딸기','사과','귤','포도','망고','바나나','복숭아','수박','멜론','체리','블루베리',
].join('|');
// Flavors, processed foods and look-alike products (蘋果手機, 柿の種) are not fresh produce.
const notFresh = '汁|醬|乾|酒|派|酥|糖|果凍|味|蛋糕|大福|巧克力|餅|布丁|冰|茶|牛奶|奶|優格|蜜餞|罐頭|洋芋片|油|醋|胡椒|手機|電腦|平板|耳機|手錶|'
  + 'の|ジュース|ジャム|ゼリー|ケーキ|チョコ|キャンディ|飴|グミ|ワイン|サワー|ミルク|オレ|ティー|プリン|タルト|パイ|クッキー|サンド|'
  + '맛|주|잼|젤리|우유|초콜릿|사탕|칩|와인';
const freshProduce = new RegExp(`(?<!乾燥|糖漬|ドライ)(?:${fruitNames})(?!\\s*(?:${notFresh}))|蔬菜|野菜|야채|채소|種子|植株|鮮花|農產品|盆栽|土壤|球根|花苗|苗木|씨앗`);
const patterns: {id:ReturnCategory;label:string;pattern:RegExp}[] = [
  {id:'animal',label:'動物產品',pattern:/肉類|[豬猪牛雞鸡羊鴨鵝豚鶏]肉|和牛|牛舌(?!餅)|牛排|豬排|豬骨|豚骨|とんこつ|培根|臘肉|臘腸|肉乾|肉鬆|肉脯|肉燥|肉醬|肉粽|肉包|叉燒|烤鴨|鴨舌(?!帽)|雞腿|雞翅|香腸|火腿|雞蛋(?!糕)|鴨蛋|皮蛋|鹹蛋|溫泉蛋|蛋黃|鮮魚|ハム(?!スター)|ソーセージ|ベーコン|ジャーキー|ビーフ|ポーク|チキン|卵|たまご(?!っち)|玉子|고기|육포|소시지|베이컨|계란|달걀/},
  {id:'plant',label:'植物及農產品',pattern:freshProduce},
  {id:'medicine',label:'藥品',pattern:/藥品|處方藥|藥物|成藥|藥膏|[眼冒痛胃腸中]藥|薬/},
  {id:'alcohol_tobacco',label:'菸酒',pattern:/酒類|啤酒|清酒|威士忌|葡萄酒|紅酒|燒酎|焼酎|日本酒|ワイン|ウイスキー|소주|막걸리|香菸|菸品|雪茄|タバコ|たばこ|담배/},
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
