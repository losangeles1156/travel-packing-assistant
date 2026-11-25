import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../domain/verifiedRegulations.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {verifiedRegulations,regulationCheckedOn}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('regulation entries expose primary source links, geographic scope and review date',()=>{
  assert.equal(regulationCheckedOn,'2026-11-13');
  assert.equal(new Set(verifiedRegulations.map(r=>r.id)).size,verifiedRegulations.length);
  for(const r of verifiedRegulations){assert.ok(r.scope);assert.ok(r.sources.length);for(const s of r.sources) assert.match(new URL(s.url).hostname,/(^|\.)(gov\.tw|taoyuan-airport\.com|maff\.go\.jp|mhlw\.go\.jp)$/);}
});
test('current reference preserves product exceptions and does not generalize scissors or lithium devices',()=>{
  const byId=id=>verifiedRegulations.find(r=>r.id===id);
  assert.match(byId('power').summary,/2 個/);
  assert.match(byId('sharp').summary,/6 公分/);
  assert.match(byId('liquid').summary,/藥物/);
  assert.match(byId('meat').summary,/不能僅憑品名/);
});
