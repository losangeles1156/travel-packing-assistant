import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../domain/disruptionGuidance.ts', import.meta.url), 'utf8');
const js = ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 });
const { disruptionGuidance } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('delay and cancellation provide different airline actions without inferring flight status', () => {
  assert.match(disruptionGuidance('delay', [])[0].action, /最新起飛時間/);
  assert.match(disruptionGuidance('cancellation', [])[0].action, /改票或退款/);
});

test('lodging count is contextual and explicitly leaves impact for traveller to verify', () => {
  const actions = disruptionGuidance('delay', [{kind:'lodging'}, {kind:'lodging'}, {kind:'flight'}]);
  assert.match(actions[2].action, /2 筆/);
  assert.match(actions[2].action, /自行確認是否受影響/);
  assert.doesNotMatch(disruptionGuidance('delay', [])[2].action, /0 筆/);
});
