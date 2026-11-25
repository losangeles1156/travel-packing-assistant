import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync(new URL('../domain/returnItems.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {classifyReturnItems,expenseReturnCategories,prohibitedReturnCategories}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const input=value=>({value,source:'user',confirmedAt:'2026-11-07T00:00:00Z'});
const cases=[['牛肉乾','animal'],['豬肉鬆','animal'],['雞蛋','animal'],['香腸','animal'],['火腿','animal'],['新鮮水果','plant'],['種子','plant'],['蔬菜','plant'],['盆栽','plant'],['鮮花','plant'],['處方藥','medicine'],['成藥','medicine'],['藥品','medicine'],['清酒','alcohol_tobacco'],['啤酒','alcohol_tobacco'],['香菸','alcohol_tobacco'],['雪茄','alcohol_tobacco'],['現金','currency'],['外幣','currency'],['黃金','currency'],['植物奶',null],['肉色襪子',null],['普通衣服',null],
  ['草莓一盒','plant'],['青森蘋果','plant'],['水蜜桃','plant'],['哈密瓜','plant'],['夕張メロン','plant'],['いちご','plant'],['シャインマスカット','plant'],['딸기','plant'],['귤 1kg','plant'],['北海道野菜','plant'],
  ['和牛','animal'],['松阪牛肉','animal'],['豚骨ラーメン','animal'],['ビーフジャーキー','animal'],['温泉卵','animal'],['소고기','animal'],['육포','animal'],
  ['目薬','medicine'],['感冒藥','medicine'],['葡萄酒','alcohol_tobacco'],['焼酎','alcohol_tobacco'],['소주','alcohol_tobacco'],
  ['蘋果手機',null],['草莓大福',null],['芒果乾',null],['乾燥芒果',null],['ドライマンゴー',null],['いちご大福',null],['柿の種',null],['白桃果凍',null],['水果糖',null],['딸기 우유',null],['鴨舌帽',null],['牛舌餅',null],['雞蛋糕',null],['たまごっち',null],['肉桂捲',null],['桃園機場',null]];
for(const [item,expected] of cases)test(`回程分類：${item}`,()=>{const r=classifyReturnItems({returnDestination:input('測試地'),returnItems:input(item)});assert.deepEqual(r.categories.map(x=>x.id),expected?[expected]:[]);assert.match(r.action,/仍須/)});
test('缺少目的地與未確認輸入仍維持待查證',()=>{const r=classifyReturnItems({returnItems:{value:'牛肉乾',source:'ai',confirmedAt:'2026-11-07T00:00:00Z'}});assert.equal(r.destinationKnown,false);assert.equal(r.itemsKnown,false);assert.deepEqual(r.categories,[]);assert.match(r.action,/仍須/)});
const prohibited=expense=>expenseReturnCategories(expense).filter(x=>prohibitedReturnCategories.has(x.id)).map(x=>x.id);
test('支出備註也會判斷禁止入境品項',()=>{assert.deepEqual(prohibited({title:'超市採買',note:'和牛 2 盒、いちご'}),['animal','plant']);assert.deepEqual(prohibited({title:'藥妝店',note:'目薬'}),[]);});
test('備註不會被當成標題的加工品字尾',()=>assert.deepEqual(prohibited({title:'草莓',note:'大福店旁的攤位'}),['plant']));
