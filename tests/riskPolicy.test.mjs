import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRiskGateReport, isIssueBlockingByMode, normalizeRiskMode } from '../utils/riskPolicy.js';

const sampleIssues = [
  { itemId: 'c1', severity: 'Critical', consequenceLevel: 'LEGAL' },
  { itemId: 'h1', severity: 'High', consequenceLevel: 'FINE' },
  { itemId: 'm1', severity: 'Medium', consequenceLevel: 'DELAY' },
];

test('normalizeRiskMode validates allowed values', () => {
  assert.equal(normalizeRiskMode('standard'), 'standard');
  assert.equal(normalizeRiskMode('conservative'), 'conservative');
  assert.equal(normalizeRiskMode('x'), 'conservative');
});

test('standard mode blocks only critical issues', () => {
  const report = buildRiskGateReport(sampleIssues, 'standard');
  assert.equal(report.blocking, 1);
  assert.equal(report.blockingIssues[0].itemId, 'c1');
  assert.equal(isIssueBlockingByMode(sampleIssues[1], 'standard'), false);
});

test('conservative mode blocks critical and high issues', () => {
  const report = buildRiskGateReport(sampleIssues, 'conservative');
  assert.equal(report.blocking, 2);
  assert.equal(report.blockingIssues.map((i) => i.itemId).includes('h1'), true);
  assert.equal(isIssueBlockingByMode(sampleIssues[1], 'conservative'), true);
});
