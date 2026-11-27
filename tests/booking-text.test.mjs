import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync(new URL('../domain/bookingText.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {parseBookingText,findDates}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const pick=(d,keys)=>Object.fromEntries(keys.map(k=>[k,d.fields[k]]));
const F=['title','flightNumber','from','to','startDate','startTime','endDate','endTime'];

test('中文電子機票：兩段航班各自讀取，不互相借用日期，也不擷取訂位代號',()=>{
 const drafts=parseBookingText(`長榮航空 電子機票行程單
訂位代號：ABC123
航班 BR198
2026/12/01 08:50 台北桃園 (TPE) → 東京成田 (NRT) 13:05
航班 BR197
2026/12/05 14:30 東京成田 (NRT) → 台北桃園 (TPE) 17:30`);
 assert.deepEqual(drafts.map(d=>d.kind),['flight','flight']);
 assert.deepEqual(pick(drafts[0],F),{title:'長榮航空',flightNumber:'BR198',from:'TPE',to:'NRT',startDate:'2026-12-01',startTime:'08:50',endDate:'',endTime:'13:05'});
 assert.deepEqual(pick(drafts[1],F),{title:'長榮航空',flightNumber:'BR197',from:'NRT',to:'TPE',startDate:'2026-12-05',startTime:'14:30',endDate:'',endTime:'17:30'});
 assert.equal(JSON.stringify(drafts).includes('ABC123'),false);
 assert.deepEqual(drafts[0].missing,['抵達日期']);
});
test('英文行程單：日期與時間分行，航廈編號不當成航班',()=>{
 const drafts=parseBookingText(`Your trip to Tokyo
Booking reference: XYZ789
Flight JL 802
Mon, 01 Dec 2026
Taipei (TPE) T1 09:30
Tokyo Narita (NRT) 13:45
Online check-in opens 24 hours before departure.`);
 assert.equal(drafts.length,1);
 assert.deepEqual(pick(drafts[0],F),{title:'日本航空',flightNumber:'JL802',from:'TPE',to:'NRT',startDate:'2026-12-01',startTime:'09:30',endDate:'',endTime:'13:45'});
});
test('日期列在航班上一行的格式',()=>{const d=parseBookingText('2026/12/03\nMM 626 KIX → TPE 10:20 12:30');assert.equal(d.length,1);assert.deepEqual(pick(d[0],['flightNumber','from','to','startDate','startTime','endTime']),{flightNumber:'MM626',from:'KIX',to:'TPE',startDate:'2026-12-03',startTime:'10:20',endTime:'12:30'});});

const S=['title','startDate','startTime','endDate','endTime','address','contact'];
test('Booking.com 英文住宿確認信',()=>{
 const d=parseBookingText(`Your booking at Hotel Gracery Shinjuku is confirmed
Check-in: Monday, 1 December 2026 (from 15:00)
Check-out: Friday, 5 December 2026 (until 11:00)
Address: 1-19-1 Kabukicho, Shinjuku-ku, Tokyo
Phone: +81 3-6833-1111
Confirmation number: 1234567890`);
 assert.deepEqual(d.map(x=>x.kind),['lodging']);
 assert.deepEqual(pick(d[0],S),{title:'Hotel Gracery Shinjuku',startDate:'2026-12-01',startTime:'15:00',endDate:'2026-12-05',endTime:'11:00',address:'1-19-1 Kabukicho, Shinjuku-ku, Tokyo',contact:'+81 3-6833-1111'});
 assert.equal(JSON.stringify(d).includes('1234567890'),false);assert.deepEqual(d[0].missing,[]);
});
test('Agoda 中文住宿確認信',()=>{
 const d=parseBookingText(`您在 新宿華盛頓酒店 的預訂已確認
入住日期：2026年12月1日（星期一）15:00 後
退房日期：2026年12月5日（星期五）11:00 前
地址：東京都新宿區西新宿3-2-9
電話：+81-3-3343-3111
預訂編號：987654321`);
 assert.deepEqual(pick(d[0],S),{title:'新宿華盛頓酒店',startDate:'2026-12-01',startTime:'15:00',endDate:'2026-12-05',endTime:'11:00',address:'東京都新宿區西新宿3-2-9',contact:'+81-3-3343-3111'});
 assert.equal(JSON.stringify(d).includes('987654321'),false);
});
test('日本旅館日文確認信（全形冒號）',()=>{
 const d=parseBookingText(`ご予約内容
宿泊施設：京都ホテルオークラ
チェックイン：2026年12月2日 15:00
チェックアウト：2026年12月4日 11:00
住所：京都府京都市中京区河原町御池
TEL：075-211-5111`);
 assert.deepEqual(pick(d[0],S),{title:'京都ホテルオークラ',startDate:'2026-12-02',startTime:'15:00',endDate:'2026-12-04',endTime:'11:00',address:'京都府京都市中京区河原町御池',contact:'075-211-5111'});
});
test('收據、一般文字與機票上的線上報到說明都不會被當成訂位',()=>{
 assert.deepEqual(parseBookingText('ローソン 梅田店\n2026年11月26日 21:10\nいちご 1パック ¥980※\n合計 ¥980'),[]);
 assert.deepEqual(parseBookingText('TICKET NO 6951234567890\nPlease arrive 2 hours early.'),[]);
 assert.deepEqual(parseBookingText('Online check-in opens 24 hours before departure.\nSee you on board!'),[]);
 assert.throws(()=>parseBookingText('a'.repeat(10001)));
});
test('日期格式與不合法日期',()=>{assert.deepEqual(findDates('Dec 1, 2026 / 2026年12月2日 / 03 Dec 2026 / 2026-02-30'),['2026-12-01','2026-12-02','2026-12-03']);});
test('機票與住宿在同一段文字時，航班不會讀到下方住宿的日期',()=>{
 const d=parseBookingText('樂桃航空 預約確認\n2026/12/03\nMM 626 KIX → TPE 10:20 12:30\n\nYour booking at Hotel Granvia Osaka is confirmed\nCheck-in: Monday, 1 December 2026 (from 15:00)\nCheck-out: Wednesday, 3 December 2026 (until 11:00)');
 assert.deepEqual(d.map(x=>x.kind),['flight','lodging']);
 assert.deepEqual(pick(d[0],['flightNumber','startDate','startTime','endTime']),{flightNumber:'MM626',startDate:'2026-12-03',startTime:'10:20',endTime:'12:30'});
 assert.deepEqual(pick(d[1],['title','startDate','endDate']),{title:'Hotel Granvia Osaka',startDate:'2026-12-01',endDate:'2026-12-03'});
});
