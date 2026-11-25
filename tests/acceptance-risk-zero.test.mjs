import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePackingRisks} from '../utils/riskEngine.js';
import {applyRiskResolution} from '../utils/riskActions.js';
import {RISK_KEYWORD_RULES,RISK_RULESET_META} from '../constants/riskKeywordRules.js';
const item=(name,rule)=>({id:name,name,rule,quantity:1,checked:true,category:'雜項'});
test('checked power bank remains blocking until user moves it; review persists afterwards',()=>{
 const items=[item('行動電源','Strict_Checked')];const first=analyzePackingRisks(items,new Map(),{country:'JP',direction:'OUTBOUND'});assert.equal(first.summary.blocking,1);
 const moved=applyRiskResolution(items,first.issues[0],'MOVE_TO_CARRY_ON');const after=analyzePackingRisks(moved,new Map(),{country:'JP',direction:'OUTBOUND'});assert.equal(after.summary.blocking,0);assert.equal(after.issues[0].type,'REVIEW');assert.match(after.issues[0].reason,/2 個/);
});
test('meat prompts review in either direction without automatic prohibition',()=>{for(const direction of ['OUTBOUND','INBOUND']){const r=analyzePackingRisks([item('牛肉乾','Flexible_DefaultChecked')],new Map(),{country:'JP',direction});assert.equal(r.issues[0].type,'REVIEW');assert.equal(r.summary.blocking,0);assert.ok(r.issues[0].sourceUrls.length>=2);}});
test('all published keyword guidance has dated, primary source links',()=>{assert.equal(RISK_RULESET_META.updatedAt,'2026-11-13');for(const r of RISK_KEYWORD_RULES){assert.equal(r.updatedAt,'2026-11-13');assert.ok(r.sourceUrls.length);assert.ok(r.sourceUrls.every(s=>new URL(s.url).protocol==='https:'));}});
