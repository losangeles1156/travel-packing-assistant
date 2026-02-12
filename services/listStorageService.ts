import { CustomRuleDef, ItemCategory, PackingItem, PreFlightTask } from '../types';

type SortBy = 'default' | 'name' | 'category' | 'rule' | 'weight';
type TripCountry = 'JP' | 'KR' | 'SG' | 'VN' | 'TH';
type TripDirection = 'OUTBOUND' | 'INBOUND';

export type ListSnapshot = {
  schemaVersion: 1;
  id: string;
  updatedAt: string;
  ui: {
    step: number;
    activeCategory: ItemCategory | 'ALL';
    sortBy: SortBy;
  };
  trip: {
    destination: string;
    startDate: string;
    endDate: string;
    duration: number;
    country: TripCountry;
    direction: TripDirection;
  };
  items: PackingItem[];
  tasks: PreFlightTask[];
  packedItemIds: string[];
  customRules: CustomRuleDef[];
};

export type ListIndexEntry = {
  id: string;
  updatedAt: string;
  destination: string;
  startDate: string;
  endDate: string;
  duration: number;
};

const INDEX_KEY = 'tpa_lists_index_v1';
const ACTIVE_KEY = 'tpa_lists_active_v1';
const LIST_KEY_PREFIX = 'tpa_list_v1_';
const MAX_LISTS = 5;

const getNowIso = () => new Date().toISOString();

const getRandomId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `list-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
};

const safeParseJson = <T,>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const loadListIndex = (): ListIndexEntry[] => {
  if (typeof window === 'undefined') return [];
  const parsed = safeParseJson<ListIndexEntry[]>(window.localStorage.getItem(INDEX_KEY));
  if (!parsed || !Array.isArray(parsed)) return [];
  return parsed
    .filter(e => typeof e?.id === 'string' && typeof e?.updatedAt === 'string')
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
};

export const saveListIndex = (index: ListIndexEntry[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
};

export const getActiveListId = (): string | null => {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(ACTIVE_KEY);
  return value ? value : null;
};

export const setActiveListId = (id: string) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTIVE_KEY, id);
};

export const loadListSnapshot = (id: string): ListSnapshot | null => {
  if (typeof window === 'undefined') return null;
  const parsed = safeParseJson<ListSnapshot>(window.localStorage.getItem(`${LIST_KEY_PREFIX}${id}`));
  if (!parsed || parsed.schemaVersion !== 1) return null;
  if (parsed.id !== id) return null;
  if (!parsed.trip.country) parsed.trip.country = 'JP';
  if (!parsed.trip.direction) parsed.trip.direction = 'OUTBOUND';
  return parsed;
};

export const saveListSnapshot = (snapshot: ListSnapshot) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`${LIST_KEY_PREFIX}${snapshot.id}`, JSON.stringify(snapshot));

  const entry: ListIndexEntry = {
    id: snapshot.id,
    updatedAt: snapshot.updatedAt,
    destination: snapshot.trip.destination,
    startDate: snapshot.trip.startDate,
    endDate: snapshot.trip.endDate,
    duration: snapshot.trip.duration,
  };

  const prev = loadListIndex();
  const next = [entry, ...prev.filter(e => e.id !== snapshot.id)]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, MAX_LISTS);

  const removed = prev.filter(e => !next.some(n => n.id === e.id));
  removed.forEach(r => {
    window.localStorage.removeItem(`${LIST_KEY_PREFIX}${r.id}`);
  });

  saveListIndex(next);
  setActiveListId(snapshot.id);
};

export const createEmptyListSnapshot = (params: {
  destination: string;
  startDate: string;
  endDate: string;
  duration: number;
  country: TripCountry;
  direction: TripDirection;
  items: PackingItem[];
  tasks: PreFlightTask[];
}): ListSnapshot => {
  const id = getRandomId();
  const updatedAt = getNowIso();
  return {
    schemaVersion: 1,
    id,
    updatedAt,
    ui: {
      step: 1,
      activeCategory: 'ALL',
      sortBy: 'default',
    },
    trip: {
      destination: params.destination,
      startDate: params.startDate,
      endDate: params.endDate,
      duration: params.duration,
      country: params.country,
      direction: params.direction,
    },
    items: params.items,
    tasks: params.tasks,
    packedItemIds: [],
    customRules: [],
  };
};

export const touchTripDetailsKey = (trip: {
  destination: string;
  startDate: string;
  endDate: string;
  duration: number;
  country: TripCountry;
  direction: TripDirection;
}) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    'tpa_trip_details',
    JSON.stringify({
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      duration: trip.duration,
      country: trip.country,
      direction: trip.direction,
    })
  );
};
