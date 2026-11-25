import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../domain/travelProtection.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {emptyProtection,isTravelProtection,localInstant,compareExpiry}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('protection validates explicit choices, unknown data and insurance dates',()=>{
 const p=emptyProtection(); assert.ok(isTravelProtection(p));
 assert.ok(isTravelProtection({...p,compatibility:'unsupported',method:'esim',activation:'first_connection'}));
 assert.ok(!isTravelProtection({...p,compatibility:'maybe'}));
 assert.ok(!isTravelProtection({...p,expiryDate:'2026-02-30'}));
 assert.ok(!isTravelProtection({...p,expiryZone:'Invalid/Zone'}));
 assert.ok(!isTravelProtection({...p,policyStart:'2026-12-02',policyEnd:'2026-12-01'}));
});
test('expiry comparisons use explicit zone and exact instants across dates',()=>{
 const expiry={date:'2026-12-02',time:'00:30',zone:'Asia/Tokyo'};
 assert.equal(compareExpiry(expiry,{type:'delay',date:'2026-12-01',time:'23:30',zone:'Asia/Taipei'}),'at_or_before');
 assert.equal(compareExpiry(expiry,{type:'rescheduled',date:'2026-12-01',time:'22:00',zone:'Asia/Taipei'}),'after');
 assert.equal(compareExpiry(expiry,{type:'cancelled',date:'2026-12-01',time:'23:30',zone:'Asia/Taipei'}),'unknown');
 assert.equal(compareExpiry({...expiry,zone:''},{type:'delay',date:'2026-12-01',time:'23:30',zone:'Asia/Taipei'}),'unknown');
});
test('ambiguous and nonexistent local times remain unknown',()=>{
 assert.equal(localInstant('2026-03-08','02:30','America/New_York'),null);
 assert.equal(localInstant('2026-11-01','01:30','America/New_York'),null);
});
