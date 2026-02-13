export const RISK_COPY_VARIANT = {
  SERIOUS: 'serious',
  FRIENDLY: 'friendly',
};

const COPY_BY_VARIANT = {
  [RISK_COPY_VARIANT.SERIOUS]: {
    title: '法律風險提醒',
    description: '違禁品可能涉及沒收、罰款甚至刑責，請先排除高風險再完成清單。',
    badges: ['刑責風險優先', '高額罰款優先'],
  },
  [RISK_COPY_VARIANT.FRIENDLY]: {
    title: '出境前重點提醒',
    description: '先把最容易出問題的物品先處理掉，能大幅降低安檢被攔與罰則風險。',
    badges: ['先清高風險', '避免安檢卡關'],
  },
};

export const normalizeRiskCopyVariant = (value) => {
  const v = String(value || '').trim().toLowerCase();
  if (v === RISK_COPY_VARIANT.SERIOUS) return RISK_COPY_VARIANT.SERIOUS;
  if (v === RISK_COPY_VARIANT.FRIENDLY) return RISK_COPY_VARIANT.FRIENDLY;
  return null;
};

export const resolveRiskCopyVariant = ({ queryValue, storedValue } = {}) => {
  const fromQuery = normalizeRiskCopyVariant(queryValue);
  if (fromQuery) return fromQuery;

  const fromStored = normalizeRiskCopyVariant(storedValue);
  if (fromStored) return fromStored;

  return RISK_COPY_VARIANT.SERIOUS;
};

export const getRiskBannerCopy = (variant) => {
  const key = normalizeRiskCopyVariant(variant) || RISK_COPY_VARIANT.SERIOUS;
  return COPY_BY_VARIANT[key];
};
