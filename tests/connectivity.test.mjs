import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
const source=fs.readFileSync(new URL('../domain/connectivity.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {evaluateConnectivity}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const input=value=>({value,source:'user',confirmedAt:'2026-11-07T00:00:00Z'});
for(const [label,inputs,expected,state] of [
 ['無資料',{},'unknown','missing'],
 ['未知',{device:input('測試裝置'),compatibility:input('待確認')},'unknown','missing'],
 ['不支援',{device:input('測試裝置'),compatibility:input('不支援'),connectionPlan:input('待查詢')},'unsupported','needs_review'],
 ['支援',{device:input('測試裝置'),compatibility:input('支援'),connectionPlan:input('已購方案')},'supported','needs_review'],
 ['任意文字不可推定',{device:input('測試裝置'),compatibility:input('應該支援')},'unknown','missing'],
 ['缺裝置',{compatibility:input('支援'),connectionPlan:input('已購方案')},'supported','missing'],
 ['缺方案',{device:input('測試裝置'),compatibility:input('支援')},'supported','missing'],
 ['非人工資料不採用',{device:input('測試'),compatibility:{value:'支援',source:'ai'}},'unknown','missing'],
]) test(label,()=>{const r=evaluateConnectivity(inputs);assert.equal(r.compatibility,expected);assert.equal(r.state,state);assert.ok(r.actions.length>0)});
test('不支援時提示替代選項並保留核實',()=>{const r=evaluateConnectivity({compatibility:input('不支援')});assert.ok(r.actions.some(x=>x.includes('實體 SIM') && x.includes('適用條件')))});
for (const [timing,expected] of [['安裝後','安裝前'],['抵達連線後','實際連線條件'],['指定日期','時區'],['待確認','尚未記錄或確認']]) test(`計時方式 ${timing} 仍要求核對`,()=>{const r=evaluateConnectivity({activationTiming:input(timing),purchaseStatus:input('已購買')});assert.ok(r.actions.some(x=>x.includes(expected)));assert.ok(r.actions.some(x=>x.includes('已購方案')));});
