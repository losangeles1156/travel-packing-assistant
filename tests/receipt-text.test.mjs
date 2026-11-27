import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync(new URL('../domain/receiptText.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {parseReceiptText,applyReceiptDraft,readSharedReceipt}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const names=d=>d.items.map(i=>i.name);

test('日本便利商店收據：全形數字、輕減稅率標記、小計稅額找零不算品項',()=>{
 const d=parseReceiptText(`ファミリーマート 新宿東口店
TEL 03-1234-5678
2026年11月25日(水) 14:32
おにぎり 鮭　　　￥１６０※
和牛 切り落とし　 ￥３，２８０※
いちご 1パック　 ￥９８０※
2個 @150
緑茶 ¥300
小計 ¥4,720
(内消費税等 ¥349)
合計 ¥4,720
お預り ¥5,000
お釣り ¥280`);
 assert.equal(d.store,'ファミリーマート 新宿東口店');assert.equal(d.date,'2026-11-25');assert.equal(d.currency,'JPY');assert.equal(d.total,'4720');
 assert.deepEqual(names(d),['おにぎり 鮭','和牛 切り落とし','いちご 1パック','緑茶']);assert.deepEqual(d.missing,[]);
});
test('合計在下一行、令和年號、反斜線當日圓',()=>{const d=parseReceiptText('ドラッグストア\n令和8年11月3日\n目薬 \\1,280\nお買上げ合計\n\\1,280');assert.equal(d.date,'2026-11-03');assert.equal(d.total,'1280');assert.equal(d.currency,'JPY');assert.deepEqual(names(d),['目薬']);});
test('韓國收據',()=>{const d=parseReceiptText('올리브영 명동점\n2026.11.20 18:05\n마스크팩 12,000원\n육포 9,500원\n부가세 1,955원\n합계 21,500원');assert.equal(d.currency,'KRW');assert.equal(d.total,'21500');assert.equal(d.date,'2026-11-20');assert.deepEqual(names(d),['마스크팩','육포']);});
test('泰國收據的佛曆年份與小數金額',()=>{const d=parseReceiptText('7-Eleven\n25/11/2569 10:11\nมะม่วง 45.00\nน้ำ 12.50\nยอดรวม 57.50 บาท');assert.equal(d.date,'2026-11-25');assert.equal(d.currency,'THB');assert.equal(d.total,'57.50');assert.deepEqual(names(d),['มะม่วง','น้ำ']);});
test('越南收據以點作千分位',()=>{const d=parseReceiptText('Circle K\n20/11/2026\nBánh mì 25.000đ\nTổng cộng 50.000đ');assert.equal(d.currency,'VND');assert.equal(d.total,'50000');assert.equal(d.date,'2026-11-20');});
test('辨識不到的欄位列為缺少，不猜測',()=>{const d=parseReceiptText('ありがとうございました\n商品A 500');assert.equal(d.total,undefined);assert.equal(d.date,undefined);assert.ok(d.missing.includes('total'));assert.ok(d.missing.includes('date'));assert.equal(d.store,undefined);});
test('不合法日期與超長文字',()=>{assert.equal(parseReceiptText('2026/02/30\n合計 ¥100').date,undefined);assert.throws(()=>parseReceiptText('a'.repeat(10001)));});
test('套用時只填空白欄位，保留使用者已填的值',()=>{
 const draft={store:'ローソン',date:'2026-11-25',currency:'JPY',total:'1500',items:[{name:'和牛',amount:'1000'},{name:'いちご',amount:'500'}],missing:[]};
 const empty={title:'',amount:'',currency:'TWD',date:'',note:'',category:'other'};
 const a=applyReceiptDraft(empty,draft);assert.deepEqual(a.next,{title:'ローソン',amount:'1500',currency:'JPY',date:'2026-11-25',note:'品項：和牛、いちご',category:'shopping'});assert.deepEqual(a.kept,[]);
 const b=applyReceiptDraft({...empty,title:'晚餐採買',amount:'1600',note:'朋友代墊'},draft);assert.equal(b.next.title,'晚餐採買');assert.equal(b.next.amount,'1600');assert.equal(b.next.currency,'TWD');assert.deepEqual(b.kept,['名稱','金額','幣別']);assert.equal(b.next.note,'朋友代墊\n品項：和牛、いちご');
});
test('品項過多時截斷備註，不超過 500 字',()=>{const items=Array.from({length:80},(_,i)=>({name:`商品名稱很長的品項${i}`,amount:'100'}));const r=applyReceiptDraft({title:'',amount:'',currency:'JPY',date:'',note:'',category:'shopping'},{items,missing:[]});assert.ok(r.next.note.length<=500);assert.match(r.next.note,/等 80 項$/);});
test('從分享網址取出收據文字，保留其他參數',()=>{
 assert.equal(readSharedReceipt('?share=abc'),null);
 assert.deepEqual(readSharedReceipt('?receipt_title=%E6%94%B6%E6%93%9A&receipt_text=%E5%90%88%E8%A8%88+%C2%A5100&share=abc'),{text:'合計 ¥100',rest:'share=abc'});
 assert.deepEqual(readSharedReceipt('?receipt_title=Lens&receipt_url=https%3A%2F%2Fexample.com'),{text:'Lens\nhttps://example.com',rest:''});
 assert.equal(readSharedReceipt('?receipt_text='+'a'.repeat(20000)).text.length,10000);
});
