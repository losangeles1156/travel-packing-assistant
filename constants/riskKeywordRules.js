/** 以品名提示需查證的事項；未輸入完整航線、物品規格及檢疫資料，不判定合規。 */
export const SUPPORTED_COUNTRIES = [
  {code:'JP',name:'日本'}, {code:'KR',name:'韓國'}, {code:'SG',name:'新加坡'},
  {code:'VN',name:'越南'}, {code:'TH',name:'泰國'},
];
export const SUPPORTED_DIRECTIONS = [{code:'OUTBOUND',name:'出境（去程）'},{code:'INBOUND',name:'入境（回程）'}];
export const RISK_RULESET_META = {version:'2026.11.13-verified-1',updatedAt:'2026-11-13',reviewedBy:'官方來源核對',notes:'來源有適用範圍，品名僅作線索；無即時更新或合規判定。'};
const airport='https://www.taoyuan-airport.com/security_check';
const caa='https://www.caa.gov.tw/NewsPublish-Content.aspx?a=381&lang=1&ngid=1&nid=2547';
const taiwanMeat='https://web.customs.gov.tw/taipei/singlehtml/3130?cntId=cus2_177199_3130';
const japanMeat='https://www.maff.go.jp/aqs/english/product/import.html';
const japanException='https://www.maff.go.jp/aqs/tetuzuki/product/shiteigai.html';
const twPlant='https://www.aphia.gov.tw/ws.php?id=10733';
const jpPlant='https://www.maff.go.jp/pps/j/pqaqinfo_en.html';
const rule=(v)=>({...v,countries:[],directions:[],appliesCountries:[],appliesDirections:[],updatedAt:'2026-11-13',synonyms:v.synonyms||[],exceptions:v.exceptions||[],penalty:'',confidence:null,exclusive:false});
export const RISK_KEYWORD_RULES=[
  rule({id:'power_bank_checked',appliesWhen:'checked',severity:'High',type:'MUST_CARRY_ON',consequenceLevel:'CONFISCATION',source:'桃園機場出境安檢；民航局行動電源公告',sourceUrls:[{label:'桃園機場出境安檢',url:airport},{label:'民航局行動電源公告',url:caa}],reason:'行動電源被放在託運區；桃園機場出境規定須隨身攜帶。',action:'請調整至隨身並確認容量、數量與航空公司規定；調整位置不代表已符合全部條件。',keywords:['行動電源','充電寶','power bank'],synonyms:['powerbank','portable charger','行充']}),
  rule({id:'power_bank_review',appliesWhen:'carry_on',severity:'Medium',type:'REVIEW',consequenceLevel:'NONE',source:'台灣民航局行動電源公告',sourceUrls:[{label:'台灣民航局行動電源公告',url:caa},{label:'桃園機場出境安檢',url:airport}],reason:'台灣民航局公告自 2026 年 4 月 8 日起，每人限帶 2 個行動電源；仍須確認容量與所搭航空公司規定。',action:'確認額定瓦時、數量與防短路方式；民航局提醒飛行中不可使用行動電源或為其充電，並請查核航司規定。',keywords:['行動電源','充電寶','power bank'],synonyms:['powerbank','portable charger','行充']}),
  rule({id:'specific_blades_carry',appliesWhen:'carry_on',severity:'Medium',type:'REVIEW',consequenceLevel:'NONE',source:'桃園機場出境安檢',sourceUrls:[{label:'桃園機場出境安檢',url:airport}],reason:'刀剪類應依種類、尺寸、出發機場及航司確認；桃園機場規定部分剪刀有尺寸條件。',action:'請確認刀刃長度、形式及出發機場規定，勿僅憑名稱判定。',keywords:['刀具','小刀','美工刀','瑞士刀','剪刀','指甲剪','刮鬍刀'],synonyms:['knife','blade','scissors','box cutter'],exceptions:['電動刮鬍刀']}),
  rule({id:'liquid_carry_review',appliesWhen:'carry_on',severity:'Medium',type:'REVIEW',consequenceLevel:'NONE',source:'桃園機場出境安檢',sourceUrls:[{label:'桃園機場出境安檢',url:airport}],reason:'桃園出境手提液體、凝膠與噴霧容器原則不得超過 100 毫升，並須依規定裝袋；必要藥品及嬰兒用品有申報條件。',action:'請核對容器容量、內容物、袋裝與醫療等例外；託運亦受物品性質及航空公司限制。',keywords:['液體','乳液','化妝水','洗髮精','沐浴乳','防曬','香水','藥水','噴霧','>100ml','超過100ml','超過 100ml'],synonyms:['liquid','lotion']}),
  rule({id:'animal_product_review',appliesWhen:'always',severity:'Medium',type:'REVIEW',consequenceLevel:'NONE',source:'台灣海關與日本動物檢疫所；實際依入境地與製程判定',sourceUrls:[{label:'台灣旅客肉製品與速食麵檢疫',url:taiwanMeat},{label:'日本動物產品入境',url:japanMeat},{label:'日本加工食品例外基準（日文）',url:japanException}],reason:'肉及含肉加工食品的檢疫條件依入境地、來源及製程而異；部分產品可能有例外，不能僅由品名判定。',action:'請確認成分、產地、製程和目的地檢疫條件；不確定先向主管機關查詢。',keywords:['肉乾','肉鬆','香腸','火腿','臘肉','生鮮肉','豬肉','牛肉','雞肉','含肉','泡麵'],synonyms:['meat jerky','sausage'],exceptions:['植物肉','素肉']}),
  rule({id:'plant_review',appliesWhen:'always',severity:'Medium',type:'REVIEW',consequenceLevel:'NONE',source:'台灣防檢署與日本植物防疫所；實際依入境地判定',sourceUrls:[{label:'台灣旅客植物檢疫',url:twPlant},{label:'日本植物防疫',url:jpPlant}],reason:'新鮮植物、蔬果及種子可能受禁止或檢疫限制；台灣鮮果與日本品項條件不同。',action:'請依入境地及產地確認禁止或檢疫規定，無法確認時洽主管機關。',keywords:['水果','蔬菜','種子','植株','盆栽','土壤'],synonyms:['fresh fruit','seed','soil'],exceptions:['水果糖','水果乾','植物奶','植物肉','植物性奶粉']}),
];
