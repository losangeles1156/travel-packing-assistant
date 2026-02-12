import { apiUrl } from './apiBase';

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

export const trackEvent = async (name: string, payload: Record<string, unknown> = {}) => {
  if (typeof window === 'undefined') return;
  const userId = getUserId();
  const sessionId = getSessionId();
  if (!userId || !sessionId) return;

  const meta = {
    locale: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    userAgent: navigator.userAgent,
    path: window.location.pathname,
  };

  const body = {
    userId,
    sessionId,
    name,
    payload,
    meta,
  };

  try {
    if ('sendBeacon' in navigator) {
      const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
      navigator.sendBeacon(apiUrl('/api/events'), blob);
      return;
    }
    await fetch(apiUrl('/api/events'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    return;
  }
};
