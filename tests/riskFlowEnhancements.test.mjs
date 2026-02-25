import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRiskGatePrompt, buildSecurityGateChecklist, evaluateNewItemRiskGate } from '../utils/riskFlowEnhancements.js';

test('buildSecurityGateChecklist keeps only blocking issues and sorts by consequence', () => {
  const issues = [
    { itemId: '1', itemName: '洗髮精', blocking: false, consequenceLevel: 'DELAY', severity: 'Medium' },
    { itemId: '2', itemName: '牛肉乾', blocking: true, consequenceLevel: 'LEGAL', severity: 'Critical' },
    { itemId: '3', itemName: '刀具', blocking: true, consequenceLevel: 'FINE', severity: 'High' },
  ];

  const checklist = buildSecurityGateChecklist(issues, 5);

  assert.equal(checklist.length, 2);
  assert.equal(checklist[0].itemId, '2');
  assert.equal(checklist[1].itemId, '3');
});

test('evaluateNewItemRiskGate returns blocking issue for newly added high-risk item', () => {
  const result = evaluateNewItemRiskGate(
    { id: 'new1', name: '行動電源', quantity: 1, rule: 'Strict_Checked', category: '雜項', checked: true },
    new Map(),
    { country: 'JP', direction: 'OUTBOUND' }
  );

  assert.ok(result.issue);
  assert.equal(result.issue.type, 'MUST_CARRY_ON');
  assert.equal(result.shouldBlock, true);
});

test('evaluateNewItemRiskGate does not block high issue in standard mode', () => {
  const result = evaluateNewItemRiskGate(
    { id: 'new2', name: '行動電源', quantity: 1, rule: 'Strict_Checked', category: '雜項', checked: true },
    new Map(),
    { country: 'JP', direction: 'OUTBOUND' },
    'standard'
  );

  assert.equal(result.shouldBlock, false);
  assert.equal(result.issue, null);
});

test('buildRiskGatePrompt contains consequence and action for user confirmation', () => {
  const prompt = buildRiskGatePrompt({
    itemName: '牛肉乾',
    type: 'BANNED_ITEM',
    penalty: '可能後果：安檢當場沒收、行政罰款，情節重大可能涉及刑責。',
    action: '請移除該物品。',
  });
  assert.match(prompt, /牛肉乾/);
  assert.match(prompt, /可能後果/);
  assert.match(prompt, /仍要加入此物品嗎/);
});
