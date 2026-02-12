/**
 * P0.5 風險規則表（可維護資料層）
 *
 * 規則設計說明：
 * - appliesWhen:
 *   - always: 只要命中關鍵字就觸發
 *   - carry_on: 目前配置為手提時觸發
 *   - checked: 目前配置為託運時觸發
 * - exclusive:
 *   - true: 命中即停止該物品後續規則判斷
 *   - false: 允許繼續命中其他規則
 */
export const SUPPORTED_COUNTRIES = [
  { code: 'JP', name: '日本' },
  { code: 'KR', name: '韓國' },
  { code: 'SG', name: '新加坡' },
  { code: 'VN', name: '越南' },
  { code: 'TH', name: '泰國' },
];

export const SUPPORTED_DIRECTIONS = [
  { code: 'OUTBOUND', name: '出境（去程）' },
  { code: 'INBOUND', name: '入境（回程）' },
];

export const RISK_RULESET_META = {
  version: '2026.02.12-p1',
  updatedAt: '2026-02-12',
  reviewedBy: 'PM+Engineering',
  notes: 'P1: 加入國家/方向適用範圍、風險處置流程與信任欄位',
};

export const RISK_KEYWORD_RULES = [
  {
    id: 'banned_border_items',
    updatedAt: '2026-02-12',
    appliesCountries: ['JP', 'KR', 'SG', 'VN', 'TH'],
    appliesDirections: ['INBOUND'],
    appliesWhen: 'always',
    exclusive: true,
    severity: 'Critical',
    type: 'BANNED_ITEM',
    source: '海關/檢疫禁止攜帶規則',
    reason: '此物品屬於高風險或禁止攜帶類別，可能涉及檢疫或飛安規範。',
    action: '請移除該物品，或於出入境前主動申報並遵循海關指示。',
    keywords: [
      '肉乾',
      '香腸',
      '火腿',
      '臘肉',
      '肉鬆',
      '生鮮肉',
      '水果',
      '蔬菜',
      '種子',
      '植物',
      '土壤',
      '防風打火機',
      '藍焰打火機',
      '打火機油',
      '鉛酸電池',
      '電蚊拍',
    ],
  },
  {
    id: 'must_carry_lithium',
    updatedAt: '2026-02-12',
    appliesCountries: ['JP', 'KR', 'SG', 'VN', 'TH'],
    appliesDirections: ['OUTBOUND', 'INBOUND'],
    appliesWhen: 'checked',
    exclusive: true,
    severity: 'High',
    type: 'MUST_CARRY_ON',
    source: '航空安檢鋰電池手提規則',
    reason: '此物品應隨身手提，錯放託運可能遭安檢攔截。',
    action: '改為手提行李，勿放託運。',
    keywords: [
      '行動電源',
      '充電寶',
      '鋰電池',
      '備用電池',
      'power bank',
    ],
  },
  {
    id: 'must_checked_blades',
    updatedAt: '2026-02-12',
    appliesCountries: ['JP', 'KR', 'SG', 'VN', 'TH'],
    appliesDirections: ['OUTBOUND', 'INBOUND'],
    appliesWhen: 'carry_on',
    exclusive: true,
    severity: 'High',
    type: 'MUST_CHECKED',
    source: '航空安檢刀具託運規則',
    reason: '此物品應託運，帶上手提可能遭安檢沒收。',
    action: '改為託運或移除該物品。',
    keywords: [
      '刀',
      '刀具',
      '剪刀',
      '美工刀',
      '瑞士刀',
      '刮鬍刀 (刀片',
    ],
  },
  {
    id: 'carry_liquid_limit',
    updatedAt: '2026-02-12',
    appliesCountries: ['JP', 'KR', 'SG', 'VN', 'TH'],
    appliesDirections: ['OUTBOUND', 'INBOUND'],
    appliesWhen: 'carry_on',
    exclusive: false,
    severity: 'Medium',
    type: 'LIQUID_LIMIT',
    source: '手提液體 100ml 限制',
    reason: '手提液體超過 100ml 可能在安檢被要求丟棄。',
    action: '改為託運，或分裝至 100ml 以下容器。',
    keywords: ['>100ml', '超過100ml'],
  },
];
