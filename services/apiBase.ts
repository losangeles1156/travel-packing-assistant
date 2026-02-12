const normalizeBase = (value: string | undefined) => {
  if (!value) return '';
  return value.trim().replace(/\/+$/, '');
};

const rawBase = normalizeBase(import.meta.env.VITE_API_BASE_URL);

export const API_BASE_URL = rawBase;

export const apiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) return normalizedPath;
  return `${API_BASE_URL}${normalizedPath}`;
};
