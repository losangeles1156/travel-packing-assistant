import { compareRiskIssues } from './riskPriority.js';

export const RISK_MODE = {
  STANDARD: 'standard',
  CONSERVATIVE: 'conservative',
};

export const normalizeRiskMode = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (v === RISK_MODE.STANDARD) return RISK_MODE.STANDARD;
  if (v === RISK_MODE.CONSERVATIVE) return RISK_MODE.CONSERVATIVE;
  return RISK_MODE.CONSERVATIVE;
};

export const isIssueBlockingByMode = (issue, mode) => {
  const severity = String(issue?.severity || '');
  const normalizedMode = normalizeRiskMode(mode);
  if (severity === 'Critical') return true;
  if (normalizedMode === RISK_MODE.CONSERVATIVE && severity === 'High') return true;
  return false;
};

export const buildRiskGateReport = (issues = [], mode = RISK_MODE.CONSERVATIVE) => {
  const blockingIssues = [...issues]
    .filter((issue) => isIssueBlockingByMode(issue, mode))
    .sort(compareRiskIssues);

  return {
    mode: normalizeRiskMode(mode),
    blockingIssues,
    blocking: blockingIssues.length,
    critical: issues.filter((i) => i?.severity === 'Critical').length,
    high: issues.filter((i) => i?.severity === 'High').length,
    medium: issues.filter((i) => i?.severity === 'Medium').length,
    total: issues.length,
  };
};
