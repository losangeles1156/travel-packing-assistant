import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync(new URL('../services/deleteLegacy.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {removeLegacyData}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
function storage(seed) {const map=new Map(Object.entries(seed)); return {map,get length(){return map.size},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
test('delete a single list removes its legacy copy but preserves other lists',()=>{const s=storage({'tpa_lists_index_v1':'[{"id":"a"},{"id":"b"}]','tpa_lists_active_v1':'a','tpa_list_v1_a':'A','tpa_list_v1_b':'B','tpa_trip_details':'private'});removeLegacyData(s,'a');assert.equal(s.getItem('tpa_list_v1_a'),null);assert.equal(s.getItem('tpa_list_v1_b'),'B');assert.equal(s.getItem('tpa_trip_details'),null);assert.deepEqual(JSON.parse(s.getItem('tpa_lists_index_v1')),[{id:'b'}]);});
test('corrupt index blocks deletion before legacy data is removed',()=>{const s=storage({'tpa_lists_index_v1':'{','tpa_list_v1_a':'A'});assert.throws(()=>removeLegacyData(s,'a'));assert.equal(s.getItem('tpa_list_v1_a'),'A');});
test('delete all includes orphaned legacy lists and retains unrelated keys',()=>{const s=storage({'tpa_list_v1_a':'A','tpa_list_v1_orphan':'B','other':'keep'});removeLegacyData(s);assert.equal(s.getItem('tpa_list_v1_orphan'),null);assert.equal(s.getItem('other'),'keep');});
test('clear all application preferences leaves unrelated local storage intact',async()=>{const {clearAppStorage}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);const s=storage({'tpa_user_id':'id','tpa_admin_enabled':'1','tpa_template_last':'template','unrelated':'keep'});clearAppStorage(s);assert.equal(s.getItem('tpa_user_id'),null);assert.equal(s.getItem('tpa_admin_enabled'),null);assert.equal(s.getItem('tpa_template_last'),null);assert.equal(s.getItem('unrelated'),'keep');});
