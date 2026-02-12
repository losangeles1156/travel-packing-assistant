import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePackingRisks } from '../utils/riskEngine.js';

const baseItem = {
  id: 'x1',
  category: '雜項',
  quantity: 1,
  checked: true,
};

test('flags banned item keyword as critical blocking risk', () => {
  const items = [
    { ...baseItem, id: 'b1', name: '牛肉乾', rule: 'Flexible_DefaultChecked' },
  ];

  const report = analyzePackingRisks(items, new Map());

  assert.equal(report.summary.critical, 1);
  assert.equal(report.summary.blocking, 1);
  assert.equal(report.issues[0].type, 'BANNED_ITEM');
});

test('banned item is direction-aware and does not trigger on outbound mode', () => {
  const items = [
    { ...baseItem, id: 'b2', name: '牛肉乾', rule: 'Flexible_DefaultChecked' },
  ];

  const report = analyzePackingRisks(items, new Map(), { country: 'JP', direction: 'OUTBOUND' });

  assert.equal(report.summary.critical, 0);
  assert.equal(report.summary.blocking, 0);
});

test('banned item triggers on inbound mode', () => {
  const items = [
    { ...baseItem, id: 'b3', name: '牛肉乾', rule: 'Flexible_DefaultChecked' },
  ];

  const report = analyzePackingRisks(items, new Map(), { country: 'JP', direction: 'INBOUND' });

  assert.equal(report.summary.critical, 1);
  assert.equal(report.summary.blocking, 1);
});

test('flags power bank in checked rule as high blocking risk', () => {
  const items = [
    { ...baseItem, id: 'p1', name: '行動電源', rule: 'Flexible_DefaultChecked' },
  ];

  const report = analyzePackingRisks(items, new Map());
  const issue = report.issues.find((i) => i.itemId === 'p1');

  assert.ok(issue);
  assert.equal(issue.severity, 'High');
  assert.equal(issue.type, 'MUST_CARRY_ON');
  assert.equal(report.summary.blocking, 1);
});

test('flags knife in carry-on rule as high blocking risk', () => {
  const items = [
    { ...baseItem, id: 'k1', name: '小刀', rule: 'Flexible_DefaultCarryOn' },
  ];

  const report = analyzePackingRisks(items, new Map());
  const issue = report.issues.find((i) => i.itemId === 'k1');

  assert.ok(issue);
  assert.equal(issue.severity, 'High');
  assert.equal(issue.type, 'MUST_CHECKED');
  assert.equal(report.summary.blocking, 1);
});

test('does not block when strict carry item is correctly configured', () => {
  const items = [
    { ...baseItem, id: 'p2', name: '行動電源', rule: 'Strict_CarryOn' },
  ];

  const report = analyzePackingRisks(items, new Map());

  assert.equal(report.summary.blocking, 0);
  assert.equal(report.summary.critical, 0);
  assert.equal(report.summary.high, 0);
});

test('keeps medium liquid warning when carry-on liquid rule is matched', () => {
  const items = [
    { ...baseItem, id: 'l1', name: '洗髮精 >100ml', rule: 'Flexible_DefaultCarryOn' },
  ];

  const report = analyzePackingRisks(items, new Map());
  const issue = report.issues.find((i) => i.itemId === 'l1');

  assert.ok(issue);
  assert.equal(issue.severity, 'Medium');
  assert.equal(issue.type, 'LIQUID_LIMIT');
  assert.equal(report.summary.blocking, 0);
});
