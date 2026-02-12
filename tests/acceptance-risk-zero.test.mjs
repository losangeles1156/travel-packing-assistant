import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePackingRisks } from '../utils/riskEngine.js';
import { applyRiskResolution } from '../utils/riskActions.js';
import { RISK_KEYWORD_RULES, RISK_RULESET_META } from '../constants/riskKeywordRules.js';

const pickAction = (issueType) => {
  if (issueType === 'MUST_CARRY_ON') return 'MOVE_TO_CARRY_ON';
  if (issueType === 'MUST_CHECKED' || issueType === 'LIQUID_LIMIT') return 'MOVE_TO_CHECKED';
  return 'REMOVE_ITEM';
};

const base = {
  category: '雜項',
  quantity: 1,
  checked: true,
};

test('acceptance: outbound packing can be resolved to zero blocking risks', () => {
  let items = [
    { ...base, id: 'i1', name: '行動電源', rule: 'Flexible_DefaultChecked' },
    { ...base, id: 'i2', name: '小刀', rule: 'Flexible_DefaultCarryOn' },
    { ...base, id: 'i3', name: '洗髮精 >100ml', rule: 'Flexible_DefaultCarryOn' },
  ];

  const context = { country: 'JP', direction: 'OUTBOUND' };
  let report = analyzePackingRisks(items, new Map(), context);
  assert.equal(report.summary.blocking >= 2, true);

  for (const issue of report.issues) {
    items = applyRiskResolution(items, issue, pickAction(issue.type));
  }

  report = analyzePackingRisks(items, new Map(), context);
  assert.equal(report.summary.blocking, 0);
});

test('acceptance: inbound prohibited item is blocked then removable to zero risk', () => {
  let items = [{ ...base, id: 'b1', name: '牛肉乾', rule: 'Flexible_DefaultChecked' }];
  const context = { country: 'JP', direction: 'INBOUND' };

  let report = analyzePackingRisks(items, new Map(), context);
  assert.equal(report.summary.critical, 1);
  assert.equal(report.summary.blocking, 1);

  items = applyRiskResolution(items, report.issues[0], 'REMOVE_ITEM');
  report = analyzePackingRisks(items, new Map(), context);
  assert.equal(report.summary.blocking, 0);
});

test('acceptance: same prohibited keyword is direction-sensitive', () => {
  const items = [{ ...base, id: 'b2', name: '牛肉乾', rule: 'Flexible_DefaultChecked' }];

  const outbound = analyzePackingRisks(items, new Map(), { country: 'JP', direction: 'OUTBOUND' });
  const inbound = analyzePackingRisks(items, new Map(), { country: 'JP', direction: 'INBOUND' });

  assert.equal(outbound.summary.blocking, 0);
  assert.equal(inbound.summary.blocking, 1);
});

test('acceptance: ruleset governance metadata is present', () => {
  assert.ok(RISK_RULESET_META.version);
  assert.ok(RISK_RULESET_META.updatedAt);
  assert.ok(RISK_RULESET_META.reviewedBy);
  assert.ok(Array.isArray(RISK_KEYWORD_RULES));
  assert.equal(RISK_KEYWORD_RULES.length > 0, true);

  for (const rule of RISK_KEYWORD_RULES) {
    assert.ok(rule.id);
    assert.ok(rule.updatedAt);
    assert.ok(Array.isArray(rule.appliesCountries));
    assert.ok(Array.isArray(rule.appliesDirections));
    assert.ok(Array.isArray(rule.keywords));
  }
});
