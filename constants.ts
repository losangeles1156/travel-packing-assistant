
export const DEBUG_VERSION = 'v1.0.2-explicit-build';

import { ItemCategory, LuggageRule, PackingItem, PreFlightTask, RecommendationItem } from './types';

export const DEFAULT_DATABASE: Omit<PackingItem, 'quantity' | 'checked'>[] = [
  // --- Electronics (3C產品) ---
  { id: 'e1', name: '行動電源 (Power Bank)', category: ItemCategory.ELECTRONICS, rule: LuggageRule.STRICT_CARRY_ON, isDaily: false },
  { id: 'e2', name: '手機 & 充電線', category: ItemCategory.ELECTRONICS, rule: LuggageRule.STRICT_CARRY_ON, isDaily: false },
  { id: 'e3', name: '萬用轉接頭', category: ItemCategory.ELECTRONICS, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
  { id: 'e4', name: '相機/鏡頭', category: ItemCategory.ELECTRONICS, rule: LuggageRule.STRICT_CARRY_ON, isDaily: false },
  { id: 'e5', name: '備用相機電池 (鋰電池)', category: ItemCategory.ELECTRONICS, rule: LuggageRule.STRICT_CARRY_ON, isDaily: false },
  { id: 'e6', name: '筆記型電腦/平板', category: ItemCategory.ELECTRONICS, rule: LuggageRule.STRICT_CARRY_ON, isDaily: false },
  { id: 'e7', name: '無線耳機 (含充電盒)', category: ItemCategory.ELECTRONICS, rule: LuggageRule.STRICT_CARRY_ON, isDaily: false },
  { id: 'e8', name: 'Wi-Fi 分享器（實體設備）', category: ItemCategory.ELECTRONICS, rule: LuggageRule.STRICT_CARRY_ON, isDaily: false },
  { id: 'e9', name: '自拍棒 / 腳架', category: ItemCategory.ELECTRONICS, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false }, // 管徑/長度限制，託運較保險
  { id: 'e10', name: 'Sim卡退卡針', category: ItemCategory.ELECTRONICS, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false },

  // --- Clothes (衣物) ---
  { id: 'c1', name: '換洗衣物(上衣/褲/裙)', category: ItemCategory.CLOTHES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: true },
  { id: 'c2', name: '內衣褲', category: ItemCategory.CLOTHES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: true },
  { id: 'c3', name: '襪子', category: ItemCategory.CLOTHES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: true },
  { id: 'c4', name: '睡衣', category: ItemCategory.CLOTHES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
  { id: 'c5', name: '薄外套 / 防風外套', category: ItemCategory.CLOTHES, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false }, // 機上或溫差大可用
  { id: 'c6', name: '拖鞋 / 涼鞋', category: ItemCategory.CLOTHES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
  { id: 'c7', name: '帽子 (遮陽/毛帽)', category: ItemCategory.CLOTHES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
  { id: 'c8', name: '太陽眼鏡', category: ItemCategory.CLOTHES, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false },
  { id: 'c9', name: '泳衣 / 泳褲', category: ItemCategory.CLOTHES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
  { id: 'c10', name: '髒衣收納袋', category: ItemCategory.CLOTHES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },

  // --- Toiletries (盥洗物品) ---
  { id: 't1', name: '洗髮精/沐浴乳 (>100ml)', category: ItemCategory.TOILETRIES, rule: LuggageRule.STRICT_CHECKED, isDaily: false },
  { id: 't2', name: '牙刷/牙膏', category: ItemCategory.TOILETRIES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
  { id: 't3', name: '臉部保養品 (乳液/化妝水)', category: ItemCategory.TOILETRIES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
  { id: 't4', name: '防曬乳', category: ItemCategory.TOILETRIES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
  { id: 't5', name: '化妝品 / 卸妝用品', category: ItemCategory.TOILETRIES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
  { id: 't6', name: '隱形眼鏡 & 藥水', category: ItemCategory.TOILETRIES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false }, // 藥水常超過100ml
  { id: 't7', name: '刮鬍刀 (刀片型)', category: ItemCategory.TOILETRIES, rule: LuggageRule.STRICT_CHECKED, isDaily: false },
  { id: 't8', name: '電動刮鬍刀', category: ItemCategory.TOILETRIES, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false },
  { id: 't9', name: '牙線 / 棉花棒', category: ItemCategory.TOILETRIES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
  { id: 't10', name: '生理用品', category: ItemCategory.TOILETRIES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },

  // --- Lifestyle (生活用品) ---
  { id: 'l1', name: '折疊傘 (雨具)', category: ItemCategory.LIFESTYLE, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
  { id: 'l2', name: '面紙 / 濕紙巾', category: ItemCategory.LIFESTYLE, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false },
  { id: 'l3', name: '個人常備藥品 (感冒/腸胃/止痛)', category: ItemCategory.LIFESTYLE, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false },
  { id: 'l4', name: 'OK繃 / 簡易急救包', category: ItemCategory.LIFESTYLE, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
  { id: 'l5', name: '口罩 (備用)', category: ItemCategory.LIFESTYLE, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false },
  { id: 'l6', name: '頸枕 (飛機用)', category: ItemCategory.LIFESTYLE, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false },
  { id: 'l7', name: '眼罩 / 耳塞', category: ItemCategory.LIFESTYLE, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false },
  { id: 'l8', name: '空水瓶 / 保溫杯', category: ItemCategory.LIFESTYLE, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false }, // 安檢需倒空
  { id: 'l9', name: '夾鏈袋 / 塑膠袋', category: ItemCategory.LIFESTYLE, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },

  // --- Misc (雜項) ---
  { id: 'm1', name: '指甲剪 / 小剪刀', category: ItemCategory.MISC, rule: LuggageRule.STRICT_CHECKED, isDaily: false },
  { id: 'm2', name: '原子筆 (填入境卡)', category: ItemCategory.MISC, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false },
  { id: 'm3', name: '環保購物袋', category: ItemCategory.MISC, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false },
  { id: 'm4', name: '行李秤', category: ItemCategory.MISC, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
  { id: 'm5', name: '行李鎖 (TSA)', category: ItemCategory.MISC, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
];

export const PRE_FLIGHT_TASKS: PreFlightTask[] = [
  // Critical Physical Documents (Moved from packing list)
  { id: 'crit1', task: '確認並攜帶「實體護照」，依目的地與轉機地規定確認效期', completed: false, important: true },
  { id: 'crit2', task: '確認並攜帶「實體簽證 / 入境許可」', completed: false, important: true },
  { id: 'crit3', task: '備妥「機票 / 登機證」 (建議截圖或列印紙本備用)', completed: false, important: true },

  // General Tasks
  { id: 'pf1', task: '機票英文姓名檢查 (需與護照完全相同)', completed: false },
  { id: 'pf2', task: '旅平險 / 旅遊不便險投保確認', completed: false },
  { id: 'pf3', task: '行動上網準備 (eSim / Roaming / Wifi機)', completed: false },
  { id: 'pf4', task: '護照與重要證件備份 (雲端上傳 + 紙本影本)', completed: false },
  { id: 'pf5', task: '外幣兌換 / 信用卡開通海外提款 & 刷卡通知', completed: false },
  { id: 'pf6', task: '確認住宿憑證 / 訂房紀錄', completed: false },
  { id: 'pf7', task: '下載離線地圖 (Google Maps Offline)', completed: false },
  { id: 'pf8', task: '查詢當地天氣與氣溫', completed: false },
];

export const TRIP_TEMPLATES = [
  {
    id: 'tpl_city',
    name: '城市散策',
    tagline: '走路多、轉乘多、拍照多',
    icon: 'fa-city',
    style: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    addItems: [
      { id: 'tpl_city_1', name: '舒適好走的鞋', category: ItemCategory.CLOTHES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
      { id: 'tpl_city_2', name: '行動電源備用線 (短)', category: ItemCategory.ELECTRONICS, rule: LuggageRule.STRICT_CARRY_ON, isDaily: false },
      { id: 'tpl_city_3', name: '小型斜背包 / 隨身包', category: ItemCategory.LIFESTYLE, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false },
    ],
    addTasks: [
      { id: 'tpl_city_pf1', task: '交通卡/乘車碼先綁定與加值', completed: false },
      { id: 'tpl_city_pf2', task: '常用景點門票/預約確認', completed: false },
    ],
  },
  {
    id: 'tpl_business',
    name: '商務差旅',
    tagline: '會議/出差/正式場合',
    icon: 'fa-briefcase',
    style: 'bg-slate-50 border-slate-200 text-slate-700',
    addItems: [
      { id: 'tpl_business_1', name: '正式服裝 / 西裝外套', category: ItemCategory.CLOTHES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
      { id: 'tpl_business_2', name: '名片', category: ItemCategory.MISC, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false },
      { id: 'tpl_business_3', name: '筆電轉接器 / HDMI', category: ItemCategory.ELECTRONICS, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false },
    ],
    addTasks: [
      { id: 'tpl_business_pf1', task: '會議資料/簡報離線備份', completed: false, important: true },
      { id: 'tpl_business_pf2', task: '公司差旅報支規則確認', completed: false },
    ],
  },
  {
    id: 'tpl_beach',
    name: '海島度假',
    tagline: '防曬、泳裝、海水友善',
    icon: 'fa-umbrella-beach',
    style: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    addItems: [
      { id: 'tpl_beach_1', name: '海灘毛巾', category: ItemCategory.CLOTHES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
      { id: 'tpl_beach_2', name: '防水袋 / 手機防水套', category: ItemCategory.LIFESTYLE, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false },
      { id: 'tpl_beach_3', name: '蘆薈凝膠 / 曬後修護', category: ItemCategory.TOILETRIES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
    ],
    addTasks: [
      { id: 'tpl_beach_pf1', task: '浮潛/海上活動預約與保險確認', completed: false },
    ],
  },
  {
    id: 'tpl_winter',
    name: '冬季保暖',
    tagline: '低溫、乾燥、保暖層次',
    icon: 'fa-snowflake',
    style: 'bg-blue-50 border-blue-200 text-blue-700',
    addItems: [
      { id: 'tpl_winter_1', name: '保暖內層 (發熱衣)', category: ItemCategory.CLOTHES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: true },
      { id: 'tpl_winter_2', name: '手套 / 圍巾', category: ItemCategory.CLOTHES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
      { id: 'tpl_winter_3', name: '護唇膏 / 保濕乳液', category: ItemCategory.TOILETRIES, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false },
      { id: 'tpl_winter_4', name: '暖暖包', category: ItemCategory.LIFESTYLE, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
    ],
    addTasks: [
      { id: 'tpl_winter_pf1', task: '雪地/低溫裝備租借確認', completed: false },
    ],
  },
  {
    id: 'tpl_hiking',
    name: '登山健行',
    tagline: '機能、照明、補給',
    icon: 'fa-mountain',
    style: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    addItems: [
      { id: 'tpl_hiking_1', name: '頭燈 / 小手電筒', category: ItemCategory.ELECTRONICS, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false },
      { id: 'tpl_hiking_2', name: '防蚊液', category: ItemCategory.TOILETRIES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
      { id: 'tpl_hiking_3', name: '雨衣 / 兩截式雨衣', category: ItemCategory.CLOTHES, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
      { id: 'tpl_hiking_4', name: '運動補給 (能量棒/鹽糖)', category: ItemCategory.LIFESTYLE, rule: LuggageRule.FLEXIBLE_CARRY_ON, isDaily: false },
    ],
    addTasks: [
      { id: 'tpl_hiking_pf1', task: '路線/緊急聯絡資訊離線備份', completed: false, important: true },
    ],
  },
] satisfies Array<{
  id: string;
  name: string;
  tagline: string;
  icon: string;
  style: string;
  addItems: Array<Omit<PackingItem, 'quantity' | 'checked'> & { isDaily?: boolean }>;
  addTasks: PreFlightTask[];
}>;

export const RECOMMENDATION_ITEMS: RecommendationItem[] = [
  {
    id: 'rec1',
    title: 'eSIM / 網卡',
    desc: '出國上網快速開通，避免漫遊費',
    icon: 'fa-wifi',
    color: 'bg-blue-500',
    baseScore: 70,
  },
  {
    id: 'rec2',
    title: '旅遊平安險',
    desc: '延誤、行李遺失與醫療保障',
    icon: 'fa-shield-heart',
    color: 'bg-green-500',
    baseScore: 60,
  },
  {
    id: 'rec3',
    title: '轉接插頭',
    desc: '跨國電器使用必備',
    icon: 'fa-plug',
    color: 'bg-indigo-500',
    baseScore: 55,
  },
  {
    id: 'rec4',
    title: '防曬用品',
    desc: '海島或戶外行程防護',
    icon: 'fa-sun',
    color: 'bg-yellow-500',
    keywords: ['海島', '海邊', '沙灘', '沖繩', '沖縄', '石垣', '宮古', '濟州'],
    seasonTags: ['summer'],
    climateTags: ['tropical', 'hot'],
    regionTags: ['japan', 'korea'],
    baseScore: 40,
  },
  {
    id: 'rec5',
    title: '雨具',
    desc: '多雨城市或季節',
    icon: 'fa-umbrella',
    color: 'bg-teal-500',
    keywords: ['雨', '梅雨', '長梅雨', '장마'],
    seasonTags: ['spring', 'summer'],
    climateTags: ['rainy'],
    regionTags: ['japan', 'korea'],
    baseScore: 35,
  },
  {
    id: 'rec6',
    title: '收納壓縮袋',
    desc: '長天數行程更省空間',
    icon: 'fa-box-open',
    color: 'bg-orange-500',
    minDays: 5,
    baseScore: 45,
  },
];
