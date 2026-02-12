
export enum ItemCategory {
  ELECTRONICS = '3C產品',
  CLOTHES = '衣物',
  TOILETRIES = '盥洗物品',
  LIFESTYLE = '生活用品',
  MISC = '雜項',
}

export enum LuggageRule {
  STRICT_CARRY_ON = 'Strict_CarryOn', // Must be carry-on (e.g., Power bank)
  STRICT_CHECKED = 'Strict_Checked',   // Must be checked (e.g., Knife)
  FLEXIBLE_CHECKED = 'Flexible_DefaultChecked', // Can be both, usually checked (e.g., Clothes)
  FLEXIBLE_CARRY_ON = 'Flexible_DefaultCarryOn', // Can be both, usually carry-on (e.g., Pen)
}

export type RuleType = LuggageRule | string;

export interface CustomRuleDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  behavior: 'CARRY' | 'CHECK'; // Maps to standard logic
  styleClass: string;
}

export interface PackingItem {
  id: string;
  name: string;
  category: ItemCategory;
  rule: RuleType;
  quantity: number;
  weight?: number; // Optional weight in kg
  isDaily?: boolean; // If true, quantity multiplies by days
  checked?: boolean; // For the checklist UI
}

export interface TripDetails {
  destination: string;
  startDate: string;
  duration: number;
  country?: 'JP' | 'KR' | 'SG' | 'VN' | 'TH';
  direction?: 'OUTBOUND' | 'INBOUND';
}

export interface PreFlightTask {
  id: string;
  task: string;
  completed: boolean;
  important?: boolean; // Visual highlight for critical docs
}

export interface RegulationCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  details: string;
  source?: {
    title: string;
    url: string;
  };
}

export type RegulationDecision = 'CARRY_ON' | 'CHECKED' | 'BANNED' | 'CONDITIONAL';

export interface RegulationRule {
  id: string;
  name: string;
  categoryId: string;
  keywords: string[];
  decision: RegulationDecision;
  summary: string;
  conditions?: string[];
  source?: {
    title: string;
    url: string;
  };
}

export interface RecommendationItem {
  id: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
  minDays?: number;
  maxDays?: number;
  keywords?: string[];
  regionTags?: string[];
  seasonTags?: string[];
  climateTags?: string[];
  baseScore: number;
}

export type WarningSeverity = 'Critical' | 'High' | 'Medium';

export interface RedZoneWarning {
  id: string;
  title: string;
  severity: WarningSeverity;
  tag: string; // e.g. "完全禁止入境"
  description: string;
  consequences: string; // 罰則
  handling: string; // 處置方式
}
