import { CustomRuleDef, LuggageRule, RuleType } from '../types';

export type RuleConfig = {
  label: string;
  icon: string;
  style: string;
};

export type RuleBadge = {
  label: string;
  style: string;
} | null;

export const buildCustomRuleById = (rules: CustomRuleDef[]) => {
  const m = new Map<string, CustomRuleDef>();
  rules.forEach(r => m.set(r.id, r));
  return m;
};

export const isCarryOnRule = (rule: RuleType, customRuleById?: Map<string, CustomRuleDef>) => {
  if (rule === LuggageRule.STRICT_CARRY_ON || rule === LuggageRule.FLEXIBLE_CARRY_ON) return true;
  if (rule === LuggageRule.STRICT_CHECKED || rule === LuggageRule.FLEXIBLE_CHECKED) return false;
  const custom = customRuleById?.get(String(rule));
  if (custom) return custom.behavior === 'CARRY';
  return false;
};

export const getGeneratorRuleConfig = (rule: RuleType, customRuleById?: Map<string, CustomRuleDef>): RuleConfig => {
  const customRule = customRuleById?.get(String(rule));
  if (customRule) {
    return { label: customRule.name, icon: customRule.icon, style: customRule.styleClass };
  }

  switch (rule) {
    case LuggageRule.STRICT_CARRY_ON:
      return {
        label: '嚴禁託運 (務必手提)',
        icon: 'fa-triangle-exclamation',
        style: 'bg-red-50 text-red-600 border-red-200',
      };
    case LuggageRule.STRICT_CHECKED:
      return {
        label: '嚴禁手提 (務必託運)',
        icon: 'fa-ban',
        style: 'bg-orange-50 text-orange-600 border-orange-200',
      };
    case LuggageRule.FLEXIBLE_CARRY_ON:
      return {
        label: '建議手提',
        icon: 'fa-suitcase',
        style: 'bg-blue-50 text-blue-600 border-blue-100',
      };
    case LuggageRule.FLEXIBLE_CHECKED:
      return {
        label: '建議託運',
        icon: 'fa-cart-flatbed-suitcase',
        style: 'bg-slate-100 text-slate-500 border-slate-200',
      };
    default:
      return { label: '', icon: '', style: '' };
  }
};

export const getResultRuleBadge = (rule: RuleType, customRuleById?: Map<string, CustomRuleDef>): RuleBadge => {
  const custom = customRuleById?.get(String(rule));
  if (custom) return { label: custom.name, style: 'bg-slate-200 text-slate-600' };
  if (rule === LuggageRule.STRICT_CARRY_ON) return { label: '必帶', style: 'bg-red-400 text-white' };
  if (rule === LuggageRule.STRICT_CHECKED) return { label: '禁手提', style: 'bg-red-400 text-white' };
  return null;
};

