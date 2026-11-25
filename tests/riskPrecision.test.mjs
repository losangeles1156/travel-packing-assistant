import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzePackingRisks} from '../utils/riskEngine.js';
import {RISK_KEYWORD_RULES,SUPPORTED_COUNTRIES} from '../constants/riskKeywordRules.js';
const run=(name,rule='Flexible_DefaultChecked',context={})=>analyzePackingRisks([{id:'x',name,rule,quantity:1}],new Map(),context).issues[0];
test('every risk rule includes a verifiable source URL and does not pretend numeric confidence',()=>{for(const rule of RISK_KEYWORD_RULES){assert.ok(rule.sourceUrls.length);assert.equal(rule.confidence,null);assert.ok(rule.sourceUrls.every(source=>/^https:\/\//.test(source.url)));}});
test('trace preserves source and matched keyword',()=>{const issue=run('Ｐｏｗｅｒ　Ｂａｎｋ 20000mah');assert.equal(issue.type,'MUST_CARRY_ON');assert.ok(issue.matchedKeyword);assert.ok(issue.sourceUrls.length);});
test('sensitive categories never infer five-country prohibition from keyword',()=>{for(const {code} of SUPPORTED_COUNTRIES)for(const direction of ['INBOUND','OUTBOUND']){const issue=run('牛肉乾',undefined,{country:code,direction});assert.equal(issue.type,'REVIEW');assert.notEqual(issue.severity,'Critical');assert.match(issue.action,/入境地|目的地/);}});
test('blade and plant data do not apply blanket prohibition',()=>{assert.equal(run('剪刀','Flexible_DefaultCarryOn').type,'REVIEW');assert.equal(run('水果').type,'REVIEW');assert.equal(run('水果乾'),undefined);});
