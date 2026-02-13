import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRiskIssues, getConsequenceRank } from '../utils/riskPriority.js';

test('consequence rank prioritizes legal/fine over delay', () => {
  assert.ok(getConsequenceRank('LEGAL') > getConsequenceRank('FINE'));
  assert.ok(getConsequenceRank('FINE') > getConsequenceRank('CONFISCATION'));
  assert.ok(getConsequenceRank('CONFISCATION') > getConsequenceRank('DELAY'));
});

test('risk sorting pins legal and high-fine cards to top even when severity ties', () => {
  const issues = [
    { itemName: '液體', severity: 'High', consequenceLevel: 'DELAY' },
    { itemName: '違禁肉品', severity: 'Critical', consequenceLevel: 'LEGAL' },
    { itemName: '刀具', severity: 'High', consequenceLevel: 'FINE' },
    { itemName: '行動電源', severity: 'High', consequenceLevel: 'CONFISCATION' },
  ];

  const sorted = [...issues].sort(compareRiskIssues);

  assert.equal(sorted[0].itemName, '違禁肉品');
  assert.equal(sorted[1].itemName, '刀具');
});
