import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../domain/sources.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { officialSources, sourceReviewState } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('source identifiers are unique and official links use HTTPS', () => {
  assert.equal(new Set(officialSources.map(s => s.id)).size, officialSources.length);
  for (const source of officialSources) assert.equal(new URL(source.url).protocol, 'https:');
});
test('every source reference resolves to the matching gate', async () => {
  const guardian = fs.readFileSync(new URL('../domain/guardian.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(guardian, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { initialRules } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  for (const rule of initialRules) for (const id of rule.sourceRefs) {
    assert.equal(officialSources.find(source => source.id === id)?.gate, rule.gate);
  }
});
test('source review date is an internal reminder and cannot establish eligibility', () => {
  const source=officialSources[0];
  assert.equal(sourceReviewState(source,new Date('2026-11-07T00:00:00Z')),'entry_checked');
  assert.equal(sourceReviewState(source,new Date('2027-02-05T00:00:00Z')),'review_due');
  assert.equal(sourceReviewState(source,new Date('2026-11-06T23:59:59Z')),'unknown');
  assert.equal(sourceReviewState(source,new Date('invalid')),'unknown');
  assert.equal(sourceReviewState({...source,checkedOn:'2026-02-30'},new Date('2026-11-07T00:00:00Z')),'unknown');
  assert.equal(sourceReviewState({...source,reviewDue:'2027-02-30'},new Date('2026-11-07T00:00:00Z')),'unknown');
});
