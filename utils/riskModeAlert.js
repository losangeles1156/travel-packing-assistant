const clampThreshold = (value, fallback = 20) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(100, Math.round(n)));
};

export const buildRiskModeAlert = (riskModeKpi, threshold = 20) => {
  const maxRate = clampThreshold(threshold);
  if (!riskModeKpi || !Number.isFinite(riskModeKpi.standardStayRate)) {
    return {
      triggered: false,
      level: 'idle',
      threshold: maxRate,
      message: '尚無足夠資料判定是否觸發告警。',
    };
  }

  if (riskModeKpi.standardStayRate > maxRate) {
    return {
      triggered: true,
      level: 'danger',
      threshold: maxRate,
      message: `一般模式留存率 ${riskModeKpi.standardStayRate}% 超過門檻 ${maxRate}%`,
      recommendation: '建議強化保守模式預設引導與切換提示文案。',
    };
  }

  return {
    triggered: false,
    level: 'safe',
    threshold: maxRate,
    message: `一般模式留存率 ${riskModeKpi.standardStayRate}%，目前在門檻 ${maxRate}% 內。`,
    recommendation: '維持現行策略，持續監控。',
  };
};
