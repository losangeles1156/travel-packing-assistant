import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRiskModeAlert } from '../utils/riskModeAlert.js';

test('buildRiskModeAlert returns alert when standard stay rate is above threshold', () => {
  const alert = buildRiskModeAlert(
    {
      sessionsChanged: 20,
      sessionsStayedStandard: 7,
      standardStayRate: 35,
    },
    20
  );
  assert.equal(alert.level, 'danger');
  assert.equal(alert.triggered, true);
  assert.equal(alert.message.includes('35%'), true);
});

test('buildRiskModeAlert returns safe state when rate is within threshold', () => {
  const alert = buildRiskModeAlert(
    {
      sessionsChanged: 18,
      sessionsStayedStandard: 2,
      standardStayRate: 11,
    },
    20
  );
  assert.equal(alert.level, 'safe');
  assert.equal(alert.triggered, false);
});

test('buildRiskModeAlert handles missing metrics', () => {
  const alert = buildRiskModeAlert(null, 20);
  assert.equal(alert.level, 'idle');
  assert.equal(alert.triggered, false);
});
