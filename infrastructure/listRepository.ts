import { isGuardianState } from '../domain/guardian';
import { isValidTimeZone } from '../domain/timezone';
import { isTripDocument } from '../domain/tripDocuments';
import { isTripDisruption } from '../domain/tripDisruptions';
import { isTransportPlan } from '../domain/transportPlan';
import { isExpense, isExchangeRate, isCrossBorderItem, CROSS_BORDER_ITEM_LIMIT, migrateExpenseItems } from '../domain/expenses';
import { isTravelProtection } from '../domain/travelProtection';
import type { ListSnapshot } from '../services/listStorageService';

const DB_NAME = 'journey-guardian';
const VERSION = 17;
const META_STORE = 'meta';
const MIGRATED_KEY = 'legacy-migration-v1';
const STORE = 'lists';

export type ListBackup = { format: 'journey-guardian-lists'; version: 12; exportedAt: string; count: number; lists: ListSnapshot[] };

/** In-memory comparison token only; never logged or persisted. */
function snapshotToken(lists: ListSnapshot[]): string {
  return JSON.stringify([...lists].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Reject malformed input before opening a write transaction. */
export function validateList(value: unknown): value is ListSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Partial<ListSnapshot>;
  if (v.crossBorderItems !== undefined) {
    const items = v.crossBorderItems;
    if (!Array.isArray(items) || items.length > CROSS_BORDER_ITEM_LIMIT || !items.every(isCrossBorderItem) ||
      new Set(items.map(item => item.id)).size !== items.length ||
      (v.expenses !== undefined && (!Array.isArray(v.expenses) || !v.expenses.every(isExpense) || v.expenses.some(expense=>expense.returnItem)))) return false;
    const expenseIds = new Set(v.expenses?.map(expense=>expense.id));
    if (items.some(item=>item.expenseId && !expenseIds.has(item.expenseId))) return false;
  }
  return v.schemaVersion === 1 && typeof v.id === 'string' && v.id.length > 0 && v.id.length <= 200 &&
    typeof v.updatedAt === 'string' && Number.isFinite(Date.parse(v.updatedAt)) &&
    !!v.trip && typeof v.trip.destination === 'string' && typeof v.trip.startDate === 'string' &&
    typeof v.trip.endDate === 'string' && typeof v.trip.duration === 'number' && Number.isFinite(v.trip.duration) &&
    (v.trip.departureTimezone === undefined || v.trip.departureTimezone === '' || isValidTimeZone(v.trip.departureTimezone)) &&
    (v.trip.returnTimezone === undefined || v.trip.returnTimezone === '' || isValidTimeZone(v.trip.returnTimezone)) &&
    ['JP','KR','SG','VN','TH'].includes(v.trip.country) && ['OUTBOUND','INBOUND'].includes(v.trip.direction) &&
    !!v.ui && typeof v.ui.step === 'number' && typeof v.ui.activeCategory === 'string' && typeof v.ui.sortBy === 'string' &&
    Array.isArray(v.items) && v.items.every(item => !!item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.category === 'string' && typeof item.rule === 'string' && typeof item.quantity === 'number' && Number.isFinite(item.quantity) && (item.unit === undefined || (typeof item.unit === 'string' && item.unit.length <= 20)) && (item.weight === undefined || (typeof item.weight === 'number' && Number.isFinite(item.weight))) && (item.checked === undefined || typeof item.checked === 'boolean') && (item.isDaily === undefined || typeof item.isDaily === 'boolean')) &&
    Array.isArray(v.tasks) && v.tasks.every(task => !!task && typeof task.id === 'string' && typeof task.task === 'string' && typeof task.completed === 'boolean' && (task.important === undefined || typeof task.important === 'boolean')) &&
    Array.isArray(v.packedItemIds) && v.packedItemIds.every(id => typeof id === 'string') &&
    (v.guardian === undefined || isGuardianState(v.guardian)) &&
    (v.documents === undefined || (Array.isArray(v.documents) && v.documents.length <= 100 && v.documents.every(isTripDocument) && new Set(v.documents.map(d => d.id)).size === v.documents.length)) &&
    (v.disruptions === undefined || (Array.isArray(v.disruptions) && v.disruptions.length <= 100 && v.disruptions.every(isTripDisruption) && new Set(v.disruptions.map(d => d.id)).size === v.disruptions.length)) &&
    (v.transportPlans === undefined || (Array.isArray(v.transportPlans) && v.transportPlans.length <= 100 && v.transportPlans.every(isTransportPlan) && new Set(v.transportPlans.map(d => d.id)).size === v.transportPlans.length)) &&
    (v.travelProtection === undefined || isTravelProtection(v.travelProtection)) &&
    (v.exchangeRates === undefined || (Array.isArray(v.exchangeRates) && v.exchangeRates.length <= 50 && v.exchangeRates.every(isExchangeRate) && new Set(v.exchangeRates.map(r => `${r.base}/${r.target}`)).size === v.exchangeRates.length)) &&
    (v.expenses === undefined || (Array.isArray(v.expenses) && v.expenses.length <= 2000 && v.expenses.every(isExpense) && new Set(v.expenses.map(e => e.id)).size === v.expenses.length)) &&
    (v.luggageWeights === undefined || (!!v.luggageWeights && typeof v.luggageWeights === 'object' && ['carryActual','carryLimit','checkedActual','checkedLimit'].every(key => {const n=(v.luggageWeights as Record<string,unknown>)[key]; return n === undefined || (typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1000);}))) &&
    Array.isArray(v.customRules) && v.customRules.every(rule => !!rule && typeof rule.id === 'string' && typeof rule.name === 'string' && typeof rule.description === 'string' && typeof rule.icon === 'string' && (rule.behavior === 'CARRY' || rule.behavior === 'CHECK') && typeof rule.styleClass === 'string');
}

/** Convert backups produced before IndexedDB migration without touching localStorage. */
export function normalizeBackup(value: unknown, corrections: LegacyCorrections = {}): ListBackup {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const legacy = value as {format?: unknown; version?: unknown; exportedAt?: unknown; count?: unknown; data?: unknown};
    if (legacy.format === 'travel-packing-legacy-backup' && legacy.version === 1 && legacy.data && typeof legacy.data === 'object' && !Array.isArray(legacy.data)) {
      const data = legacy.data as Record<string, unknown>;
      const keys = Object.keys(data).filter(key => key.startsWith('tpa_list_v1_'));
      if (legacy.count !== keys.length) throw new Error('舊備份數量不符');
      const lists = readLegacyLists(legacyDataStorage(data, keys), corrections);
      return validateBackup({format:'journey-guardian-lists',version:1,exportedAt:legacy.exportedAt,count:lists.length,lists});
    }
  }
  return validateBackup(value);
}

export function validateBackup(value: unknown): ListBackup {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('備份格式不正確');
  const v = value as Omit<Partial<ListBackup>, 'version'> & {version?: unknown};
  const version = v.version;
  if (v.format !== 'journey-guardian-lists' || typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > 12 || typeof v.exportedAt !== 'string' || !Number.isFinite(Date.parse(v.exportedAt)) || !Array.isArray(v.lists) || v.count !== v.lists.length || !v.lists.every(validateList)) throw new Error('備份資料損壞或版本不相容');
  if (version < 3 && v.lists.some(list => list.documents !== undefined)) throw new Error('備份版本與旅程資料不相容');
  if (version < 4 && v.lists.some(list => list.disruptions !== undefined || list.transportPlans !== undefined)) throw new Error('備份版本與旅程變動資料不相容');
  if (version < 5 && v.lists.some(list => list.travelProtection !== undefined)) throw new Error('備份版本與旅程守護資料不相容');
  if (version < 6 && v.lists.some(list => list.luggageWeights !== undefined || list.items.some(item => item.unit !== undefined))) throw new Error('備份版本與行李資料不相容');
  if (version < 7 && v.lists.some(list => list.expenses !== undefined)) throw new Error('備份版本與旅途支出資料不相容');
  if (version < 8 && v.lists.some(list => list.expenses?.some(expense => expense.returnItem !== undefined))) throw new Error('備份版本與回程物品資料不相容');
  if (version < 9 && v.lists.some(list => list.exchangeRates !== undefined)) throw new Error('備份版本與手動匯率資料不相容');
  if (version < 10 && v.lists.some(list => list.expenses?.some(expense => expense.receiptImage !== undefined))) throw new Error('備份版本與單據影像不相容');
  if (version < 11 && v.lists.some(list=>list.crossBorderItems !== undefined)) throw new Error('備份版本與跨境物品資料不相容');
  if (version < 12 && v.lists.some(list => list.documents?.some(doc => doc.reference !== undefined))) throw new Error('備份版本與訂位代號資料不相容');
  if (new Set(v.lists.map(x => x.id)).size !== v.lists.length) throw new Error('備份包含重複的清單識別碼');
  return { ...v, version: 12, lists: v.lists.map(withMigratedExpenseItems) } as ListBackup;
}

function withMigratedExpenseItems(list: ListSnapshot): ListSnapshot {
  if (!list.expenses?.some(expense => expense.returnItem)) return list;
  const {expenses, items} = migrateExpenseItems(list.expenses);
  return {...list, expenses, crossBorderItems:items};
}

function openDatabase(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, VERSION);
    let settled = false;
    request.onupgradeneeded = () => {
      if (settled) { request.transaction?.abort(); return; }
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
      if (!request.result.objectStoreNames.contains(META_STORE)) request.result.createObjectStore(META_STORE);
    };
    request.onerror = () => { if (!settled) { settled = true; reject(request.error ?? new Error('無法開啟本機資料庫')); } };
    request.onblocked = () => { if (!settled) { settled = true; reject(new Error('資料庫升級受阻，請關閉其他分頁後重試')); } };
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      settled = true;
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

export class ListRepository {
  private pending: Promise<void> = Promise.resolve();
  constructor(private readonly name = DB_NAME) {}
  async getAll(): Promise<ListSnapshot[]> {
    await this.pending;
    const db = await openDatabase(this.name);
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { if (!request.result.every(validateList)) reject(new Error('本機清單資料損壞')); else resolve(request.result); };
        tx.onabort = () => reject(tx.error ?? new Error('讀取中斷'));
      });
    } finally { db.close(); }
  }
  async get(id: string): Promise<ListSnapshot | null> {
    const all = await this.getAll();
    return all.find(list => list.id === id) ?? null;
  }
  async save(list: ListSnapshot): Promise<void> { await this.write([list], false); }
  async isMigrated(): Promise<boolean> {
    const db = await openDatabase(this.name);
    try { return await new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const req = tx.objectStore(META_STORE).get(MIGRATED_KEY);
      req.onsuccess = () => resolve(req.result === true);
      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(tx.error ?? new Error('讀取遷移狀態失敗'));
    }); } finally { db.close(); }
  }

  async write(lists: ListSnapshot[], replace: boolean, expectedSnapshot?: string): Promise<void> {
    const work = this.pending.then(() => this.writeTransaction(lists, replace, expectedSnapshot));
    this.pending = work.catch(() => undefined);
    return work;
  }
  private async writeTransaction(lists: ListSnapshot[], replace: boolean, expectedSnapshot?: string): Promise<void> {
    if (!lists.every(validateList) || new Set(lists.map(x => x.id)).size !== lists.length) throw new Error('清單內容不正確或重複');
    const db = await openDatabase(this.name);
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error ?? new Error('儲存未完成，原資料維持不變'));
        tx.onerror = () => { /* onabort reports transaction failure */ };
        const putLists = () => {
          try {
            if (replace) store.clear();
            for (const list of lists) store.put(withMigratedExpenseItems(list));
          } catch (error) {
            reject(error);
            tx.abort();
          }
        };
        if (expectedSnapshot === undefined) { putLists(); return; }
        const request = store.getAll();
        request.onsuccess = () => {
          if (!request.result.every(validateList) || snapshotToken(request.result) !== expectedSnapshot) {
            reject(new Error('本機資料已變更，請重新選擇備份並確認匯入內容。'));
            tx.abort();
            return;
          }
          putLists();
        };
      });
    } finally { db.close(); }
  }
  /** Copies legacy records atomically, without replacing newer records or deleting legacy bytes. */
  async migrateLegacy(storage: Storage, corrections: LegacyCorrections = {}): Promise<{ imported: number; skipped: number }> {
    const lists = readLegacyLists(storage, corrections);
    const db = await openDatabase(this.name);
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction([STORE, META_STORE], 'readwrite');
        const store = tx.objectStore(STORE);
        tx.objectStore(META_STORE).put(true, MIGRATED_KEY);
        let imported = 0;
        let skipped = 0;
        for (const list of lists) {
          const request = store.getKey(list.id);
          request.onsuccess = () => {
            if (request.result !== undefined) { skipped++; return; }
            store.add(list);
            imported++;
          };
        }
        tx.oncomplete = () => resolve({ imported, skipped });
        tx.onabort = () => reject(tx.error ?? new Error('遷移中斷，請保留舊資料與備份'));
        tx.onerror = () => { /* onabort reports the failed transaction */ };
      });
    } finally { db.close(); }
  }
  async remove(id: string): Promise<void> {
    if (!id || typeof id !== 'string') throw new Error('清單識別碼無效');
    const work = this.pending.then(async () => {
      const db = await openDatabase(this.name);
      try { await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(tx.error ?? new Error('清單刪除失敗'));
      }); } finally { db.close(); }
    });
    this.pending = work.catch(() => undefined);
    return work;
  }
  async backup(now = new Date()): Promise<ListBackup> {
    const lists = await this.getAll();
    return { format: 'journey-guardian-lists', version: 12, exportedAt: now.toISOString(), count: lists.length, lists: lists.map(withMigratedExpenseItems) };
  }
  async previewImport(value: unknown, corrections: LegacyCorrections = {}) {
    const backup = normalizeBackup(value, corrections);
    const old = await this.getAll();
    const existing = new Set(old.map(x => x.id));
    return { backup, existing: old.length, incoming: backup.lists.length, conflicts: backup.lists.filter(x => existing.has(x.id)).length, expectedSnapshot: snapshotToken(old) };
  }
  async importBackup(value: unknown, mode: 'merge' | 'replace', expectedSnapshot: string) {
    if (mode !== 'merge' && mode !== 'replace') throw new Error('未選擇匯入方式');
    if (typeof expectedSnapshot !== 'string') throw new Error('請先確認備份匯入預覽');
    const backup = normalizeBackup(value);
    await this.write(backup.lists, mode === 'replace', expectedSnapshot);
  }
}

export type LegacyCorrections = Record<string, { country?: string; direction?: string }>;
export type LegacyRequirement = { id: string; destination: string; country: boolean; direction: boolean };

function legacyDataStorage(data: Record<string, unknown>, keys: string[]): Storage {
  if (keys.some(key => typeof data[key] !== 'string')) throw new Error('舊備份格式錯誤');
  return { length: keys.length, key: i => keys[i] ?? null, getItem: key => typeof data[key] === 'string' ? data[key] as string : null } as Storage;
}

export function inspectLegacyBackupRequirements(value: unknown): LegacyRequirement[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const legacy = value as { format?: unknown; version?: unknown; count?: unknown; data?: unknown };
  if (legacy.format !== 'travel-packing-legacy-backup' || legacy.version !== 1 || !legacy.data || typeof legacy.data !== 'object' || Array.isArray(legacy.data)) return [];
  const data = legacy.data as Record<string, unknown>;
  const keys = Object.keys(data).filter(key => key.startsWith('tpa_list_v1_'));
  if (legacy.count !== keys.length) throw new Error('舊備份數量不符');
  return inspectLegacyRequirements(legacyDataStorage(data, keys));
}

/** Identify only missing legacy fields; do not infer a travel region or direction. */
export function inspectLegacyRequirements(storage: Storage): LegacyRequirement[] {
  const requirements: LegacyRequirement[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith('tpa_list_v1_')) continue;
    let value: any;
    try { value = JSON.parse(storage.getItem(key) ?? ''); } catch { throw new Error(`舊清單 ${key} 無法解析，請先保留備份`); }
    if (!value || typeof value !== 'object' || !value.trip || typeof value.trip !== 'object' || typeof value.id !== 'string' || key !== `tpa_list_v1_${value.id}`) throw new Error(`舊清單 ${key} 格式不完整，請先保留備份`);
    const country = value.trip.country == null || value.trip.country === '';
    const direction = value.trip.direction == null || value.trip.direction === '';
    const checked = { ...value, trip: { ...value.trip, ...(country ? { country: 'JP' } : {}), ...(direction ? { direction: 'OUTBOUND' } : {}) } };
    if (!validateList(checked)) throw new Error(`舊清單 ${key} 格式不完整，請先保留備份`);
    if (country || direction) requirements.push({ id: value.id, destination: value.trip.destination, country, direction });
  }
  return requirements;
}

/** Legacy bytes are read without modifying or deleting the original storage. */
export function readLegacyLists(storage: Storage, corrections: LegacyCorrections = {}): ListSnapshot[] {
  const result: ListSnapshot[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith('tpa_list_v1_')) continue;
    const raw = storage.getItem(key);
    let parsed: unknown;
    try { parsed = JSON.parse(raw ?? ''); } catch { throw new Error(`舊清單 ${key} 無法解析，請先保留備份`); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`舊清單 ${key} 格式不完整，請先保留備份`);
    const legacy = parsed as { id?: unknown; trip?: Record<string, unknown> };
    if (typeof legacy.id !== 'string' || key !== `tpa_list_v1_${legacy.id}` || !legacy.trip || typeof legacy.trip !== 'object') throw new Error(`舊清單 ${key} 格式不完整，請先保留備份`);
    const correction = corrections[legacy.id];
    const countryMissing = legacy.trip.country == null || legacy.trip.country === '';
    const directionMissing = legacy.trip.direction == null || legacy.trip.direction === '';
    const candidate = { ...legacy, trip: { ...legacy.trip, ...(countryMissing && correction?.country ? { country: correction.country } : {}), ...(directionMissing && correction?.direction ? { direction: correction.direction } : {}) } };
    if (!validateList(candidate)) throw new Error(`舊清單 ${key} 格式不完整，請先保留備份並確認缺少的地區與方向`);
    result.push(candidate);
  }
  if (new Set(result.map(x => x.id)).size !== result.length) throw new Error('舊清單識別碼重複');
  return result;
}

export const listRepository = new ListRepository();
