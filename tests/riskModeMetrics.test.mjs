import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRiskModeKpi } from '../api/riskModeMetrics.js';

test('computeRiskModeKpi aggregates mode switches and last-mode retention by session', () => {
  const events = [
    { session_id: 's1', created_at: '2026-02-20T10:00:00.000Z', payload: { mode: 'standard' } },
    { session_id: 's2', created_at: '2026-02-20T10:01:00.000Z', payload: { mode: 'conservative' } },
    { session_id: 's1', created_at: '2026-02-20T10:02:00.000Z', payload: { mode: 'conservative' } },
    { session_id: 's3', created_at: '2026-02-20T10:03:00.000Z', payload: { mode: 'standard' } },
    { session_id: 's3', created_at: '2026-02-20T10:04:00.000Z', payload: { mode: 'standard' } },
    { session_id: 's4', created_at: '2026-02-20T10:05:00.000Z', payload: { mode: 'unknown' } },
    { session_id: '', created_at: '2026-02-20T10:05:00.000Z', payload: { mode: 'standard' } },
  ];

  const kpi = computeRiskModeKpi(events);
  assert.equal(kpi.totalChanges, 5);
  assert.equal(kpi.switchedToStandard, 3);
  assert.equal(kpi.switchedToConservative, 2);
  assert.equal(kpi.sessionsChanged, 3);
  assert.equal(kpi.sessionsStayedStandard, 1);
  assert.equal(kpi.sessionsStayedConservative, 2);
  assert.equal(kpi.standardStayRate, 33);
});

test('computeRiskModeKpi defaults to empty stats', () => {
  const kpi = computeRiskModeKpi([]);
  assert.equal(kpi.totalChanges, 0);
  assert.equal(kpi.sessionsChanged, 0);
  assert.equal(kpi.sessionsStayedStandard, 0);
  assert.equal(kpi.standardStayRate, 0);
});
