import { RISK_KEYWORD_RULES } from '../constants/riskKeywordRules.js';

const RULE = {
  STRICT_CARRY_ON: 'Strict_CarryOn',
  STRICT_CHECKED: 'Strict_Checked',
  FLEXIBLE_CHECKED: 'Flexible_DefaultChecked',
  FLEXIBLE_CARRY_ON: 'Flexible_DefaultCarryOn',
};

const containsAnyKeyword = (text, keywords) => keywords.some((k) => text.includes(k));

const normalize = (value) => String(value || '').trim().toLowerCase();

const isCarryOnRule = (rule, customRuleById) => {
  if (rule === RULE.STRICT_CARRY_ON || rule === RULE.FLEXIBLE_CARRY_ON) return true;
  if (rule === RULE.STRICT_CHECKED || rule === RULE.FLEXIBLE_CHECKED) return false;
  const custom = customRuleById?.get?.(String(rule));
  if (custom) return custom.behavior === 'CARRY';
  return false;
};

const pushIssue = (issues, issue) => {
  issues.push({
    ...issue,
    blocking: issue.severity === 'Critical' || issue.severity === 'High',
  });
};

const ruleAppliesForPlacement = (rule, carryOn) => {
  if (rule.appliesWhen === 'always') return true;
  if (rule.appliesWhen === 'carry_on') return carryOn;
  if (rule.appliesWhen === 'checked') return !carryOn;
  return false;
};

const ruleAppliesForContext = (rule, context) => {
  const country = String(context?.country || '').toUpperCase();
  const direction = String(context?.direction || '').toUpperCase();
  const countries = rule.appliesCountries || [];
  const directions = rule.appliesDirections || [];

  if (countries.length > 0 && country && !countries.includes(country)) return false;
  if (directions.length > 0 && direction && !directions.includes(direction)) return false;
  return true;
};

export const analyzePackingRisks = (items, customRuleById, context = {}) => {
  const issues = [];
  const selectedItems = (items || []).filter((item) => Number(item?.quantity || 0) > 0);

  for (const item of selectedItems) {
    const nameRaw = String(item?.name || '');
    const name = normalize(nameRaw);
    const carryOn = isCarryOnRule(item?.rule, customRuleById);

    for (const rule of RISK_KEYWORD_RULES) {
      if (!ruleAppliesForContext(rule, context)) continue;
      if (!ruleAppliesForPlacement(rule, carryOn)) continue;
      if (!containsAnyKeyword(name, rule.keywords || [])) continue;

      pushIssue(issues, {
        itemId: item.id,
        itemName: nameRaw,
        ruleId: rule.id,
        ruleUpdatedAt: rule.updatedAt || null,
        appliesCountries: rule.appliesCountries || [],
        appliesDirections: rule.appliesDirections || [],
        severity: rule.severity,
        type: rule.type,
        source: rule.source,
        reason: rule.reason,
        action: rule.action,
      });

      if (rule.exclusive) break;
    }
  }

  const summary = {
    critical: issues.filter((i) => i.severity === 'Critical').length,
    high: issues.filter((i) => i.severity === 'High').length,
    medium: issues.filter((i) => i.severity === 'Medium').length,
    blocking: issues.filter((i) => i.blocking).length,
    total: issues.length,
  };

  return { issues, summary };
};
