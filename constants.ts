
import { ItemCategory, LuggageRule, PackingItem, PreFlightTask, RedZoneWarning, RegulationCategory, RegulationRule, RecommendationItem } from './types';

export const DEFAULT_DATABASE: Omit<PackingItem, 'quantity' | 'checked'>[] = [
  // --- Electronics (3C產品) ---
  { id: 'e1', name: '行動電源 (Power Bank)', category: ItemCategory.ELECTRONICS, rule: LuggageRule.STRICT_CARRY_ON, isDaily: false },
  { id: 'e2', name: '手機 & 充電線', category: ItemCategory.ELECTRONICS, rule: LuggageRule.STRICT_CARRY_ON, isDaily: false },
  { id: 'e3', name: '萬用轉接頭', category: ItemCategory.ELECTRONICS, rule: LuggageRule.FLEXIBLE_CHECKED, isDaily: false },
  { id: 'e4', name: '相機/鏡頭', category: ItemCategory.ELECTRONICS, rule: LuggageRule.STRICT_CARRY_ON, isDaily: false },
  { id: 'e5', name: '備用相機電池 (鋰電池)', category: ItemCategory.ELECTRONICS, rule: LuggageRule.STRICT_CARRY_ON, isDaily: false },
  { id: 'e6', name: '筆記型電腦/平板', category: ItemCategory.ELECTRONICS, rule: LuggageRule.STRICT_CARRY_ON, isDaily: false },
  { id: 'e7', name: '無線耳機 (含充電盒)', category: ItemCategory.ELECTRONICS, rule: LuggageRule.STRICT_CARRY_ON, isDaily: false },
  { id: 'e8', name: 'Wifi機 / 上網Sim卡', category: ItemCategory.ELECTRONICS, rule: LuggageRule.STRICT_CARRY_ON, isDaily: false },
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
  { id: 'crit1', task: '確認並攜帶「實體護照」 (有效期限需6個月以上)', completed: false, important: true },
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

export const RED_ZONE_WARNINGS: RedZoneWarning[] = [
  {
    id: 'rz1',
    title: '生鮮肉類 / 加工肉品',
    severity: 'Critical',
    tag: '絕對禁止入境',
    description: '包括肉乾、香腸、火腿、臘肉、肉鬆、含肉塊之泡麵(如滿漢大餐)。真空包裝亦「不可」攜帶。',
    consequences: '台灣海關初犯罰款新台幣 20 萬元，再犯罰款 100 萬元。外籍人士未繳清將被拒絕入境。',
    handling: '請在登機前食用完畢或丟棄。若已帶下飛機，請在過海關前丟入「農畜產品棄置箱」或主動走紅線申報。'
  },
  {
    id: 'rz2',
    title: '生鮮植物 / 蔬果 / 種子',
    severity: 'Critical',
    tag: '絕對禁止入境',
    description: '所有新鮮水果、蔬菜、種子、活體植物、土壤。',
    consequences: '違反植物防疫檢疫法，最高可處新台幣 15 萬元罰鍰。',
    handling: '嚴禁攜帶入境。飛機餐的水果請勿帶下飛機。請在海關前丟棄或主動申報檢疫。'
  },
  {
    id: 'rz3',
    title: '鋰電池 / 行動電源',
    severity: 'High',
    tag: '嚴禁託運',
    description: '所有鋰電池、行動電源、內建鋰電池之電子產品(若無法拆卸)必須「手提」上飛機。',
    consequences: '若放入託運行李，將被安檢攔下開箱取出，嚴重者可能面臨罰款或拒絕運送。',
    handling: '務必隨身攜帶。單顆電池不得超過 160Wh (超過100Wh需經航空公司同意)。'
  },
  {
    id: 'rz4',
    title: '防風打火機 / 燃料油',
    severity: 'High',
    tag: '禁止攜帶',
    description: '藍焰(防風)打火機、雪茄打火機、打火機油，無論手提或託運皆「完全禁止」。',
    consequences: '安檢時會被沒收丟棄。若隱匿攜帶可能觸犯飛航安全法規。',
    handling: '一般非防風打火機每人限隨身攜帶一枚(不可託運)。防風型請勿攜帶。'
  },
  {
    id: 'rz5',
    title: '鉛酸電池製品',
    severity: 'High',
    tag: '禁止攜帶',
    description: '常見於舊式手電筒、電蚊拍、充電式隨身風扇。',
    consequences: '此類電池不穩定，多數航空公司禁止託運也禁止手提。',
    handling: '請確認電蚊拍/風扇是否為鋰電池(可手提)。若為鉛酸電池請勿攜帶出國。'
  },
  {
    id: 'rz6',
    title: '超過100ml之液體',
    severity: 'Medium',
    tag: '僅限託運',
    description: '手提行李之液體、膠狀、噴霧類容器單瓶不得超過100ml。',
    consequences: '安檢時會被要求丟棄。',
    handling: '若需隨身攜帶，請分裝至100ml以下容器並裝於1公升透明夾鏈袋。大罐保養品/酒類請務必託運。'
  },
];

export const REGULATION_CATEGORIES: RegulationCategory[] = [
  {
    id: 'reg1',
    name: '液體/膠狀物',
    icon: 'fa-bottle-water',
    description: '隨身攜帶液體限制規定',
    details: '單一容器不得超過 100ml (3.4 oz)。所有容器需裝入一個不超過 1 公升 (20x20cm) 可重複密封的透明塑膠袋中。每人限帶一袋。超過此限制請放入託運行李。',
    source: {
      title: '交通部民航局 - 液體攜帶規定',
      url: 'https://www.caa.gov.tw/Article.aspx?a=1055&lang=1'
    }
  },
  {
    id: 'reg2',
    name: '電池/行動電源',
    icon: 'fa-battery-full',
    description: '鋰電池安全規範',
    details: '備用鋰電池與行動電源 **必須手提**，嚴禁託運。規格通常限制在 100Wh 內可攜帶，100Wh-160Wh 需航空公司批准，超過 160Wh 禁止攜帶。',
    source: {
      title: '交通部民航局 - 危險物品規範',
      url: 'https://www.caa.gov.tw/Article.aspx?a=1055&lang=1'
    }
  },
  {
    id: 'reg3',
    name: '藥品',
    icon: 'fa-pills',
    description: '處方藥與成藥規定',
    details: '建議攜帶醫師處方箋或藥品說明書。日本入境對於含有「偽麻黃鹼」或「可待因」之感冒藥有嚴格限制。',
    source: {
      title: '日本國海關 - 醫藥品輸入',
      url: 'https://www.customs.go.jp/english/c-answer_e/imtsukan/1806_e.htm'
    }
  },
  {
    id: 'reg4',
    name: '現金/黃金',
    icon: 'fa-coins',
    description: '出入境現金限額',
    details: '台灣出境：新台幣 10 萬元、人民幣 2 萬元、美金 1 萬元等值外幣。超過需申報，否則沒入。',
    source: {
      title: '財政部關務署 - 洗錢防制物品',
      url: 'https://taipei.customs.gov.tw/singlehtml/3392?cntId=cus2_3392_3392_1355'
    }
  },
  {
    id: 'reg5',
    name: '食品',
    icon: 'fa-utensils',
    description: '動植物檢疫規定',
    details: '請勿攜帶肉類製品 (含真空包裝)、新鮮蔬果、種子、土壤。泡麵建議檢查是否含肉塊。',
    source: {
      title: '農業部動植物防疫檢疫署',
      url: 'https://www.aphia.gov.tw/ws.php?id=13034'
    }
  },
];

export const REGULATION_RULES: RegulationRule[] = [
  {
    id: 'r1',
    name: '行動電源 / 鋰電池',
    categoryId: 'reg2',
    keywords: ['行動電源', '充電寶', '鋰電池', 'power bank', 'battery'],
    decision: 'CONDITIONAL',
    summary: '必須手提，禁止託運',
    conditions: ['單顆電池不得超過 160Wh', '100Wh-160Wh 需航空公司同意'],
    source: {
      title: '民航局危險物品清單',
      url: 'https://www.caa.gov.tw/Article.aspx?a=1055&lang=1'
    }
  },
  {
    id: 'r2',
    name: '液體 / 膠狀物',
    categoryId: 'reg1',
    keywords: ['液體', '乳液', '化妝水', '洗髮精', '沐浴乳', '防曬', '香水', '酒'],
    decision: 'CONDITIONAL',
    summary: '手提單瓶不得超過 100ml',
    conditions: ['超過 100ml 請託運', '需裝入 1 公升透明夾鏈袋'],
    source: {
      title: '民航局液體攜帶規定',
      url: 'https://www.caa.gov.tw/Article.aspx?a=1055&lang=1'
    }
  },
  {
    id: 'r3',
    name: '刀具 / 剪刀',
    categoryId: 'reg2',
    keywords: ['刀', '剪刀', '指甲剪', '美工刀', '瑞士刀'],
    decision: 'CHECKED',
    summary: '禁止手提，需託運',
  },
  {
    id: 'r4',
    name: '無人機',
    categoryId: 'reg2',
    keywords: ['無人機', 'drone', '航拍'],
    decision: 'CONDITIONAL',
    summary: '電池需手提，機體視航空公司規範',
    conditions: ['若含鋰電池，需遵守電池規範'],
  },
  {
    id: 'r5',
    name: '肉類製品',
    categoryId: 'reg5',
    keywords: ['肉乾', '香腸', '火腿', '臘肉', '肉鬆', '泡麵'],
    decision: 'BANNED',
    summary: '多數國家禁止入境',
    conditions: ['台灣入境嚴禁攜帶肉類製品', '日本入境亦嚴禁肉類'],
    source: {
      title: '防檢署 - 入境檢疫',
      url: 'https://www.aphia.gov.tw/ws.php?id=13034'
    }
  },
  {
    id: 'r6',
    name: '新鮮蔬果 / 植物',
    categoryId: 'reg5',
    keywords: ['水果', '蔬菜', '種子', '植物', '土壤'],
    decision: 'BANNED',
    summary: '多數國家禁止入境',
    source: {
      title: '防檢署 - 植物檢疫',
      url: 'https://www.aphia.gov.tw/ws.php?id=13034'
    }
  },
  {
    id: 'r7',
    name: '藥品 (一般/處方)',
    categoryId: 'reg3',
    keywords: ['藥品', '處方', '成藥', '藥水'],
    decision: 'CONDITIONAL',
    summary: '建議攜帶處方或藥品說明',
    conditions: ['液體藥水超過 100ml 需申報'],
  },
  {
    id: 'r8',
    name: '現金 / 外幣',
    categoryId: 'reg4',
    keywords: ['現金', '外幣', '美元', '人民幣'],
    decision: 'CONDITIONAL',
    summary: '超過限額需申報',
    source: {
      title: '關務署 - 洗錢防制',
      url: 'https://taipei.customs.gov.tw/singlehtml/3392?cntId=cus2_3392_3392_1355'
    }
  },
  {
    id: 'r9',
    name: '日本禁藥 (感冒藥)',
    categoryId: 'reg3',
    keywords: ['感冒藥', '鼻炎藥', '偽麻黃鹼', 'stimulant', 'Actifed', 'Sudafed'],
    decision: 'BANNED',
    summary: '含 Stimulant 原料之藥品禁止攜入日本',
    conditions: ['含超過10% Pseudoephedrine 需事前申請', '含有 Codeine 需事前申請'],
    source: {
      title: '日本國海關 - 藥品規定',
      url: 'https://www.customs.go.jp/english/c-answer_e/imtsukan/1806_e.htm'
    }
  },
  {
    id: 'r10',
    name: '電子菸 / 加熱菸',
    categoryId: 'reg2',
    keywords: ['電子菸', '加熱菸', 'vape', 'iqos'],
    decision: 'BANNED',
    summary: '台灣全面禁止攜帶入境',
    conditions: ['不論數量多寡，一律禁止', '違反者最高罰 500 萬元'],
    source: {
      title: '關務署 - 電子菸規定',
      url: 'https://web.customs.gov.tw/singlehtml/3322?cntId=cus1_3322_3322_1355'
    }
  }
];

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
