import { RISK_KEYWORD_RULES } from '../constants/riskKeywordRules.js';

const RULE = {
  STRICT_CARRY_ON: 'Strict_CarryOn',
  STRICT_CHECKED: 'Strict_Checked',
  FLEXIBLE_CHECKED: 'Flexible_DefaultChecked',
  FLEXIBLE_CARRY_ON: 'Flexible_DefaultCarryOn',
};

const TYPE_PRIORITY = {
  BANNED_ITEM: 4,
  MUST_CARRY_ON: 3,
  MUST_CHECKED: 2,
  LIQUID_LIMIT: 1,
};

const normalizeText = (value) => String(value || '').normalize('NFKC').toLowerCase().trim();

const toCompactText = (value) =>
  normalizeText(value)
    .replace(/[\s\-_]+/g, '')
    .replace(/[()（）「」『』,.，。:：;；!?！？'"`~]/g, '');

const buildMatchText = (value) => ({
  raw: String(value || ''),
  normalized: normalizeText(value),
  compact: toCompactText(value),
});

const matchTerm = (text, term) => {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return false;

  const compactTerm = toCompactText(term);
  if (normalizedTerm && text.normalized.includes(normalizedTerm)) return true;
  if (compactTerm && text.compact.includes(compactTerm)) return true;
  return false;
};

const findMatchedTerm = (text, terms = []) => {
  for (const term of terms) {
    if (matchTerm(text, term)) {
      return String(term);
    }
  }
  return null;
};

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

  const countries = rule.countries || rule.appliesCountries || [];
  const directions = rule.directions || rule.appliesDirections || [];

  if (countries.length > 0 && country && !countries.includes(country)) return false;
  if (directions.length > 0 && direction && !directions.includes(direction)) return false;
  return true;
};

const getRulePriority = (rule) => TYPE_PRIORITY[rule.type] || 0;

const matchRule = (rule, text) => {
  const keywordHit = findMatchedTerm(text, rule.keywords || []);
  const synonymHit = keywordHit ? null : findMatchedTerm(text, rule.synonyms || []);
  const matchedKeyword = keywordHit || synonymHit;
  const matchedFrom = keywordHit ? 'keyword' : synonymHit ? 'synonym' : null;

  if (!matchedKeyword) return null;

  const exceptionHit = findMatchedTerm(text, rule.exceptions || []);
  if (exceptionHit) return null;

  return {
    matchedKeyword,
    matchedFrom,
  };
};

export const analyzePackingRisks = (items, customRuleById, context = {}) => {
  const issues = [];
  const selectedItems = (items || []).filter((item) => Number(item?.quantity || 0) > 0);

  for (const item of selectedItems) {
    const nameRaw = String(item?.name || '');
    const nameForMatch = buildMatchText(nameRaw);
    const carryOn = isCarryOnRule(item?.rule, customRuleById);

    const matches = [];

    for (const rule of RISK_KEYWORD_RULES) {
      if (!ruleAppliesForContext(rule, context)) continue;
      if (!ruleAppliesForPlacement(rule, carryOn)) continue;

      const trace = matchRule(rule, nameForMatch);
      if (!trace) continue;

      matches.push({ rule, trace, priority: getRulePriority(rule) });
    }

    if (matches.length === 0) continue;

    matches.sort((a, b) => b.priority - a.priority);

    const winner = matches[0];
    const winnerCountries = winner.rule.countries || winner.rule.appliesCountries || [];
    const winnerDirections = winner.rule.directions || winner.rule.appliesDirections || [];

    pushIssue(issues, {
      itemId: item.id,
      itemName: nameRaw,
      ruleId: winner.rule.id,
      ruleUpdatedAt: winner.rule.updatedAt || null,
      appliesCountries: winnerCountries,
      appliesDirections: winnerDirections,
      severity: winner.rule.severity,
      type: winner.rule.type,
      consequenceLevel: winner.rule.consequenceLevel || 'NONE',
      source: winner.rule.source,
      reason: winner.rule.reason,
      action: winner.rule.action,
      penalty: winner.rule.penalty || '',
      ruleConfidence: winner.rule.confidence ?? null,
      matchedKeyword: winner.trace.matchedKeyword,
      matchedFrom: winner.trace.matchedFrom,
      rulePriority: winner.priority,
    });
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
