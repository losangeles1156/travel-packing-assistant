/** Official reference entries checked 2026-11-13; scope is explicitly part of each entry. */
export type VerifiedRegulation = {id:string;title:string;scope:string;summary:string;keywords:string[];sources:{label:string;url:string}[]};
export const regulationCheckedOn='2026-11-13';
const airport={label:'桃園機場：出境安檢',url:'https://www.taoyuan-airport.com/security_check'};
const caa={label:'民航局：行動電源公告',url:'https://www.caa.gov.tw/NewsPublish-Content.aspx?a=381&lang=1&ngid=1&nid=2547'};
export const verifiedRegulations:VerifiedRegulation[]=[
 {id:'power',title:'行動電源',scope:'台灣民航局公告、桃園機場出境參考',summary:'行動電源不得託運；民航局公告自 2026 年 4 月 8 日起每人限帶 2 個。民航局亦提醒飛行途中不可使用行動電源或為其充電；請另核對額定能量、防短路方式與航空公司規定。',keywords:['行動電源','充電寶','power bank','電池'],sources:[airport,caa]},
 {id:'battery',title:'備用電池與內建電池設備',scope:'桃園機場出境參考；具體容量及航空公司條件仍須確認',summary:'備用電池、行動電源與內建電池設備不可混為一談。桃園機場對充電式風扇、藍牙耳機及託運電子設備另有條件；請核對電池種類、設備型態與航司規定。',keywords:['電池','筆電','相機','耳機','風扇'],sources:[airport,{label:'民航局：旅客危險物品資料',url:'https://www.caa.gov.tw/Article.aspx?a=1350&lang=1'}]},
 {id:'liquid',title:'液體、凝膠與噴霧',scope:'桃園機場出境安檢參考',summary:'容器不得超過 100 毫升，須裝入不超過 1 公升的可重複密封透明袋。旅行必要的藥物、醫療及嬰兒用品有申報與同意條件；託運也要確認物品性質及航司規定。',keywords:['液體','乳液','洗髮精','沐浴乳','藥水','噴霧','香水'],sources:[airport]},
 {id:'sharp',title:'刀具與剪刀',scope:'桃園機場出境安檢參考',summary:'桃園機場列出刀類不得手提；一般剪刀刀刃 6 公分以內可隨身攜帶，可拆式剪刀另視為刀類。請依物品形態與實際出發機場確認，安檢判定及航司規定仍須遵守。',keywords:['刀','剪刀','指甲剪','刮鬍刀','scissors'],sources:[airport]},
 {id:'meat',title:'肉類與加工食品',scope:'入境台灣及日本；其他目的地請查當地檢疫機關',summary:'台灣對肉品有申報檢疫及證明條件，特定高溫滅菌食品有例外。日本多數肉品有禁止或檢疫限制，2026 年 7 月起部分符合特定製程的即席食品有排除基準；不能僅憑品名認定可攜帶。',keywords:['肉','泡麵','香腸','火腿','肉乾','肉鬆'],sources:[{label:'臺北關：肉品及速食麵入境',url:'https://web.customs.gov.tw/taipei/singlehtml/3130?cntId=cus2_177199_3130'},{label:'日本動物檢疫所：入境動物產品',url:'https://www.maff.go.jp/aqs/english/product/import.html'},{label:'日本動物檢疫所：加工品排除基準（日文）',url:'https://www.maff.go.jp/aqs/tetuzuki/product/shiteigai.html'}]},
 {id:'plant',title:'水果、植物與種子',scope:'入境台灣及日本；其他目的地請查當地檢疫機關',summary:'台灣禁止旅客攜帶新鮮水果入境，其他植物產品依種類及條件辦理檢疫。日本對蔬果、植物與種子也有檢疫與禁止限制；請先確認品項及產地。',keywords:['水果','植物','蔬菜','種子'],sources:[{label:'台灣防檢署：旅客植物檢疫',url:'https://www.aphia.gov.tw/ws.php?id=10733'},{label:'日本植物防疫所：旅客須知',url:'https://www.maff.go.jp/pps/j/pqaqinfo_en.html'}]},
 {id:'medicine',title:'藥品',scope:'日本入境參考；其他入境地請查當地主管機關',summary:'藥品是否可攜帶取決於成分、數量及管制分類；日本對部分管制藥品要求事先許可。請依實際成分查詢主管機關，不以一般品名判定。',keywords:['藥','medicine','處方'],sources:[{label:'日本厚生勞動省：自用藥品攜入',url:'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iyakuhin/kojinyunyu/topics/tp010401-1_00001.html'}]},
];
