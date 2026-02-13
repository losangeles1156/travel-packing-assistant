const CONSEQUENCE_RANK = {
  LEGAL: 4,
  FINE: 3,
  CONFISCATION: 2,
  DELAY: 1,
  NONE: 0,
};

const SEVERITY_RANK = {
  Critical: 3,
  High: 2,
  Medium: 1,
};

export const getConsequenceRank = (level) => {
  const key = String(level || 'NONE').toUpperCase();
  return CONSEQUENCE_RANK[key] || 0;
};

export const compareRiskIssues = (a, b) => {
  const consequenceDiff = getConsequenceRank(b?.consequenceLevel) - getConsequenceRank(a?.consequenceLevel);
  if (consequenceDiff !== 0) return consequenceDiff;

  const severityDiff = (SEVERITY_RANK[b?.severity] || 0) - (SEVERITY_RANK[a?.severity] || 0);
  if (severityDiff !== 0) return severityDiff;

  const blockingDiff = Number(Boolean(b?.blocking)) - Number(Boolean(a?.blocking));
  if (blockingDiff !== 0) return blockingDiff;

  return String(a?.itemName || '').localeCompare(String(b?.itemName || ''), 'zh-TW');
};

export const getConsequenceLabel = (level) => {
  const key = String(level || 'NONE').toUpperCase();
  if (key === 'LEGAL') return '刑責風險';
  if (key === 'FINE') return '高額罰款';
  if (key === 'CONFISCATION') return '可能沒收';
  if (key === 'DELAY') return '延誤風險';
  return '一般風險';
};
