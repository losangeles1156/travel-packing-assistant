/**
 * 風險規則表（可維護資料層）
 *
 * 欄位說明：
 * - keywords: 主要命中詞
 * - synonyms: 同義/英文別名
 * - exceptions: 排除詞，避免誤判
 * - countries / directions: 規則適用範圍
 * - confidence: 0~1 規則信心值（審核追蹤）
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
  version: '2026.02.13-p0.5',
  updatedAt: '2026-02-13',
  reviewedBy: 'PM+Engineering',
  notes: 'P0.5: 規則欄位標準化、同義詞/例外詞、可追溯命中詞與信心值',
};

const withCompatibility = (rule) => ({
  ...rule,
  appliesCountries: rule.countries,
  appliesDirections: rule.directions,
});

export const RISK_KEYWORD_RULES = [
  withCompatibility({
    id: 'banned_border_items',
    updatedAt: '2026-02-13',
    countries: ['JP', 'KR', 'SG', 'VN', 'TH'],
    directions: ['INBOUND'],
    appliesWhen: 'always',
    exclusive: true,
    severity: 'Critical',
    type: 'BANNED_ITEM',
    consequenceLevel: 'LEGAL',
    source: '海關/檢疫禁止攜帶規則',
    reason: '此物品屬於高風險或禁止攜帶類別，可能涉及檢疫或飛安規範。',
    action: '請移除該物品，或於出入境前主動申報並遵循海關指示。',
    penalty: '可能後果：安檢當場沒收、行政罰款，情節重大可能涉及刑責。',
    confidence: 0.98,
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
    synonyms: ['meat jerky', 'sausage', 'fresh fruit', 'seed', 'soil'],
    exceptions: ['植物奶', '植物肉', '植物性奶粉'],
  }),
  withCompatibility({
    id: 'must_carry_lithium',
    updatedAt: '2026-02-13',
    countries: ['JP', 'KR', 'SG', 'VN', 'TH'],
    directions: ['OUTBOUND', 'INBOUND'],
    appliesWhen: 'checked',
    exclusive: true,
    severity: 'High',
    type: 'MUST_CARRY_ON',
    consequenceLevel: 'CONFISCATION',
    source: '航空安檢鋰電池手提規則',
    reason: '此物品應隨身手提，錯放託運可能遭安檢攔截。',
    action: '改為手提行李，勿放託運。',
    penalty: '可能後果：託運時遭攔截或退件，造成重整行李與延誤登機。',
    confidence: 0.97,
    keywords: ['行動電源', '充電寶', '鋰電池', '備用電池', 'power bank'],
    synonyms: ['powerbank', 'portable charger', 'battery pack', '行充'],
    exceptions: [],
  }),
  withCompatibility({
    id: 'must_checked_blades',
    updatedAt: '2026-02-13',
    countries: ['JP', 'KR', 'SG', 'VN', 'TH'],
    directions: ['OUTBOUND', 'INBOUND'],
    appliesWhen: 'carry_on',
    exclusive: true,
    severity: 'High',
    type: 'MUST_CHECKED',
    consequenceLevel: 'FINE',
    source: '航空安檢刀具託運規則',
    reason: '此物品應託運，帶上手提可能遭安檢沒收。',
    action: '改為託運或移除該物品。',
    penalty: '可能後果：手提安檢沒收、登機延誤，嚴重者可能受罰。',
    confidence: 0.95,
    keywords: ['刀具', '刀', '小刀', '剪刀', '美工刀', '瑞士刀', '刮鬍刀'],
    synonyms: ['knife', 'blade', 'scissors', 'box cutter'],
    exceptions: ['電動刮鬍刀', '安全刮鬍刀保護套'],
  }),
  withCompatibility({
    id: 'carry_liquid_limit',
    updatedAt: '2026-02-13',
    countries: ['JP', 'KR', 'SG', 'VN', 'TH'],
    directions: ['OUTBOUND', 'INBOUND'],
    appliesWhen: 'carry_on',
    exclusive: false,
    severity: 'Medium',
    type: 'LIQUID_LIMIT',
    consequenceLevel: 'DELAY',
    source: '手提液體 100ml 限制',
    reason: '手提液體超過 100ml 可能在安檢被要求丟棄。',
    action: '改為託運，或分裝至 100ml 以下容器。',
    penalty: '可能後果：安檢現場丟棄物品並延長通關時間。',
    confidence: 0.9,
    keywords: ['>100ml', '超過100ml', '超過 100ml', '100ml以上'],
    synonyms: ['over 100ml', 'more than 100ml'],
    exceptions: ['100ml以下', '100ml 以內', '≤100ml'],
  }),
];
