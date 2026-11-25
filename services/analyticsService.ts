const USER_KEY = 'tpa_user_id';
const SESSION_KEY = 'tpa_session_id';

const getRandomId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `u-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
};

const getStoredId = (storage: Storage, key: string) => {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const created = getRandomId();
  storage.setItem(key, created);
  return created;
};

export const getUserId = () => {
  if (typeof window === 'undefined') return null;
  return getStoredId(window.localStorage, USER_KEY);
};

export const getSessionId = () => {
  if (typeof window === 'undefined') return null;
  return getStoredId(window.sessionStorage, SESSION_KEY);
};

// 本機優先版本不自動傳送旅程或使用事件。保留函式簽名以免影響既有呼叫。
export const trackEvent = async (_name: string, _payload: Record<string, unknown> = {}) => {
  return;
};
