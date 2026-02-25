import { analyzePackingRisks } from './riskEngine.js';
import { compareRiskIssues } from './riskPriority.js';
import { buildRiskGateReport } from './riskPolicy.js';

export const buildSecurityGateChecklist = (issues = [], limit = 5) => {
  return [...issues]
    .filter((issue) => issue?.blocking)
    .sort(compareRiskIssues)
    .slice(0, Math.max(1, limit));
};

export const evaluateNewItemRiskGate = (item, customRuleById, context = {}, mode = 'conservative') => {
  const report = analyzePackingRisks([item], customRuleById, context);
  const gate = buildRiskGateReport(report.issues, mode);
  const issue = gate.blockingIssues[0] || null;

  return {
    shouldBlock: Boolean(issue),
    issue,
  };
};

export const buildRiskGatePrompt = (issue) => {
  if (!issue) return '';
  return `偵測到高風險：${issue.itemName}\n類型：${issue.type}\n可能後果：${issue.penalty || '安檢攔截'}\n建議：${issue.action}\n\n仍要加入此物品嗎？`;
};
