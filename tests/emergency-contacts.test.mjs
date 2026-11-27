import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync(new URL('../domain/emergencyContacts.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {consularOffices,officesForTrip,findPhone,tollFreeHotline,mofaHotline,localEmergency}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const names=r=>r.primary.map(o=>o.name);
test('京都對應大阪辦事處，不會因「東京都」含「京都」而配到東京',()=>{assert.deepEqual(names(officesForTrip('JP','京都')),['台北駐大阪經濟文化辦事處']);assert.equal(officesForTrip('JP','京都').others.length,5);});
test('目的地或住宿地址都能對應館處',()=>{assert.deepEqual(names(officesForTrip('JP','東京')),['台北駐日經濟文化代表處（東京）']);assert.deepEqual(names(officesForTrip('JP','日本旅遊 北海道札幌市中央區')),['台北駐日經濟文化代表處札幌分處']);assert.deepEqual(names(officesForTrip('KR','濟州島')),['駐韓國台北代表部釜山辦事處']);});
test('轄區界線不明確或對應不到時列出該國全部館處',()=>{assert.equal(officesForTrip('VN','峴港').primary.length,2);assert.equal(officesForTrip('JP','日本').primary.length,6);assert.deepEqual(officesForTrip('US','紐約').primary,[]);});
test('館處電話皆為國際格式且數字完整',()=>{assert.equal(consularOffices.length,12);for(const o of consularOffices){assert.ok(o.phones.length);for(const p of o.phones)assert.match(p.tel,/^\+\d{10,13}$/);assert.match(o.url,/^https:\/\/www\.boca\.gov\.tw\//);}assert.equal(mofaHotline.phone.tel,'+886800085095');});
test('越南不適用全球免付費專線',()=>{assert.equal(tollFreeHotline.VN,undefined);assert.ok(tollFreeHotline.JP.numbers.length===2);});
test('從自由文字擷取可撥打的號碼',()=>{assert.deepEqual(findPhone('+81-3-1234-5678（24 小時）'),{display:'+81-3-1234-5678',tel:'+81312345678'});assert.deepEqual(findPhone('飯店櫃台 03-1234-5678'),{display:'03-1234-5678',tel:'0312345678'});assert.equal(findPhone('請用 LINE 聯絡'),null);assert.equal(findPhone('房號 1203'),null);});
test('五國當地緊急電話都有官方出處且可撥打',()=>{
 for(const c of ['JP','KR','SG','TH','VN']){const e=localEmergency[c];assert.ok(e.lines.length>=2);assert.match(e.source.url,/^https:\/\//);for(const l of e.lines)assert.match(l.phone.tel,/^\+?\d{3,13}$/);}
 const tel=c=>localEmergency[c].lines.map(l=>l.phone.tel);
 assert.deepEqual(tel('JP').slice(0,2),['110','119']);assert.deepEqual(tel('KR').slice(0,2),['112','119']);assert.deepEqual(tel('SG'),['999','995']);assert.deepEqual(tel('TH'),['191','1669','1155']);assert.deepEqual(tel('VN').slice(0,3),['113','114','115']);
 assert.equal(localEmergency.JP.lines[2].phone.tel,'+815038162787');
});
