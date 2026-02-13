import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePackingRisks } from '../utils/riskEngine.js';
import { RISK_KEYWORD_RULES, SUPPORTED_COUNTRIES, SUPPORTED_DIRECTIONS } from '../constants/riskKeywordRules.js';

const baseItem = {
  id: 'risk-item',
  category: '雜項',
  quantity: 1,
  checked: true,
};

const checkedRule = 'Flexible_DefaultChecked';
const carryRule = 'Flexible_DefaultCarryOn';

const runCase = ({ name, rule = checkedRule, country = 'JP', direction = 'OUTBOUND' }) => {
  const report = analyzePackingRisks(
    [{ ...baseItem, name, rule }],
    new Map(),
    { country, direction }
  );
  return report.issues[0] || null;
};

test('risk ruleset entries expose maintainable schema fields', () => {
  assert.ok(SUPPORTED_COUNTRIES.length >= 5);
  assert.equal(SUPPORTED_DIRECTIONS.length, 2);

  for (const rule of RISK_KEYWORD_RULES) {
    assert.ok(Array.isArray(rule.keywords), `rule ${rule.id} keywords missing`);
    assert.ok(Array.isArray(rule.synonyms), `rule ${rule.id} synonyms missing`);
    assert.ok(Array.isArray(rule.exceptions), `rule ${rule.id} exceptions missing`);
    assert.ok(Array.isArray(rule.countries), `rule ${rule.id} countries missing`);
    assert.ok(Array.isArray(rule.directions), `rule ${rule.id} directions missing`);
    assert.equal(typeof rule.confidence, 'number', `rule ${rule.id} confidence missing`);
    assert.equal(typeof rule.consequenceLevel, 'string', `rule ${rule.id} consequenceLevel missing`);
  }
});

test('risk issue includes explainable trace fields for supportability', () => {
  const issue = runCase({ name: '行動電源', rule: checkedRule, country: 'JP', direction: 'OUTBOUND' });
  assert.ok(issue);
  assert.equal(issue.type, 'MUST_CARRY_ON');
  assert.ok(issue.ruleId);
  assert.equal(typeof issue.matchedKeyword, 'string');
  assert.ok(issue.matchedKeyword.length > 0);
  assert.ok(['keyword', 'synonym'].includes(issue.matchedFrom));
  assert.equal(typeof issue.ruleConfidence, 'number');
  assert.equal(typeof issue.penalty, 'string');
  assert.ok(issue.penalty.length > 0);
  assert.equal(typeof issue.consequenceLevel, 'string');
});

test('critical banned item includes explicit legal consequence text', () => {
  const issue = runCase({ name: '牛肉乾', rule: checkedRule, country: 'JP', direction: 'INBOUND' });
  assert.ok(issue);
  assert.equal(issue.severity, 'Critical');
  assert.equal(typeof issue.penalty, 'string');
  assert.match(issue.penalty, /罰|沒收|刑責/);
});

test('synonym + normalization catches full-width power bank tokens', () => {
  const issue = runCase({
    name: 'Ｐｏｗｅｒ　Ｂａｎｋ 20000mah',
    rule: checkedRule,
    country: 'KR',
    direction: 'OUTBOUND',
  });
  assert.ok(issue);
  assert.equal(issue.type, 'MUST_CARRY_ON');
});

test('exceptions prevent false positive for non-risk "植物奶" item', () => {
  const issue = runCase({
    name: '植物奶粉',
    rule: checkedRule,
    country: 'SG',
    direction: 'INBOUND',
  });
  assert.equal(issue, null);
});

test('acceptance: 5-country fixed dataset reaches >=95% and zero high-risk misses', () => {
  const countries = ['JP', 'KR', 'SG', 'VN', 'TH'];
  const matrix = [];

  for (const country of countries) {
    matrix.push(
      { name: '牛肉乾', rule: checkedRule, country, direction: 'INBOUND', expected: 'BANNED_ITEM', highRisk: true },
      { name: '牛肉乾', rule: checkedRule, country, direction: 'OUTBOUND', expected: null, highRisk: false },
      { name: '行動電源', rule: checkedRule, country, direction: 'OUTBOUND', expected: 'MUST_CARRY_ON', highRisk: true },
      { name: 'portable charger', rule: checkedRule, country, direction: 'OUTBOUND', expected: 'MUST_CARRY_ON', highRisk: true },
      { name: '瑞士刀', rule: carryRule, country, direction: 'OUTBOUND', expected: 'MUST_CHECKED', highRisk: true },
      { name: '洗髮精 超過100ml', rule: carryRule, country, direction: 'OUTBOUND', expected: 'LIQUID_LIMIT', highRisk: false },
      { name: '植物奶粉', rule: checkedRule, country, direction: 'INBOUND', expected: null, highRisk: false }
    );
  }

  let correct = 0;
  let highRiskMisses = 0;

  for (const entry of matrix) {
    const issue = runCase(entry);
    const actual = issue?.type || null;

    if (actual === entry.expected) {
      correct += 1;
    }

    if (entry.highRisk && entry.expected && actual !== entry.expected) {
      highRiskMisses += 1;
    }
  }

  const accuracy = correct / matrix.length;
  assert.ok(accuracy >= 0.95, `accuracy expected >=0.95, got ${accuracy}`);
  assert.equal(highRiskMisses, 0, `high-risk misses expected 0, got ${highRiskMisses}`);
});
