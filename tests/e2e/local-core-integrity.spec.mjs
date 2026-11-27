import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import ts from 'typescript';

const moduleUrl = path => {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
};
const source = fs.readFileSync(new URL('../../infrastructure/listRepository.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace('../domain/guardian', moduleUrl('../../domain/guardian.ts'))
  .replace('../domain/timezone', moduleUrl('../../domain/timezone.ts'))
  .replace('../domain/tripDocuments', moduleUrl('../../domain/tripDocuments.ts'))
  .replace('../domain/tripDisruptions', moduleUrl('../../domain/tripDisruptions.ts'))
  .replace('../domain/transportPlan', moduleUrl('../../domain/transportPlan.ts'))
  .replace('../domain/travelProtection', moduleUrl('../../domain/travelProtection.ts'))
  .replace('../domain/expenses', moduleUrl('../../domain/expenses.ts'));
const repositoryUrl = `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;

test('import rejects corrupted data and rolls back a simulated storage failure', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async url => {
    const { ListRepository } = await import(url);
    const name = `integrity-${crypto.randomUUID()}`;
    const repo = new ListRepository(name);
    const list = id => ({ schemaVersion: 1, id, updatedAt: '2026-11-08T00:00:00Z', ui: { step: 1, activeCategory: 'ALL', sortBy: 'default' }, trip: { destination: '測試', startDate: '2026-12-01', endDate: '2026-12-03', duration: 3, country: 'JP', direction: 'OUTBOUND' }, items: [], tasks: [], packedItemIds: [], customRules: [] });
    try {
      await repo.save(list('old'));
      const incoming = { format: 'journey-guardian-lists', version: 2, exportedAt: '2026-11-08T00:00:00Z', count: 1, lists: [list('new')] };
      let corruptRejected = false;
      try { await repo.previewImport({ ...incoming, lists: [{ ...list('new'), items: [null] }] }); } catch { corruptRejected = true; }
      const preview = await repo.previewImport(incoming);
      const originalPut = IDBObjectStore.prototype.put;
      let errorName = '';
      try {
        IDBObjectStore.prototype.put = function (...args) {
          if (this.name === 'lists') throw new DOMException('simulated quota error', 'QuotaExceededError');
          return originalPut.apply(this, args);
        };
        await repo.importBackup(incoming, 'replace', preview.expectedSnapshot);
      } catch (error) { errorName = error.name; }
      finally { IDBObjectStore.prototype.put = originalPut; }
      const afterAbort = (await repo.getAll()).map(x => x.id);
      await repo.importBackup(incoming, 'replace', (await repo.previewImport(incoming)).expectedSnapshot);
      return { corruptRejected, errorName, afterAbort, afterRetry: (await repo.getAll()).map(x => x.id) };
    } finally { indexedDB.deleteDatabase(name); }
  }, repositoryUrl);
  expect(result).toEqual({ corruptRejected: true, errorName: 'QuotaExceededError', afterAbort: ['old'], afterRetry: ['new'] });
});

test('legacy migration preserves newer records and a newer database refuses downgrade', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async url => {
    const { ListRepository } = await import(url);
    const base = `migration-${crypto.randomUUID()}`;
    const list = (id, destination) => ({ schemaVersion: 1, id, updatedAt: '2026-11-08T00:00:00Z', ui: { step: 1, activeCategory: 'ALL', sortBy: 'default' }, trip: { destination, startDate: '2026-12-01', endDate: '2026-12-03', duration: 3, country: 'JP', direction: 'OUTBOUND' }, items: [], tasks: [], packedItemIds: [], customRules: [] });
    const oldA = JSON.stringify(list('a', '舊資料'));
    const values = new Map([['tpa_list_v1_a', oldA], ['tpa_list_v1_b', JSON.stringify(list('b', '舊資料'))]]);
    const storage = { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null, getItem: k => values.get(k) ?? null };
    try {
      const repo = new ListRepository(base);
      await repo.save(list('a', '新版資料'));
      const first = await repo.migrateLegacy(storage);
      const second = await repo.migrateLegacy(storage);
      const current = await repo.get('a');
      values.set('tpa_list_v1_b', '{bad json');
      const invalid = new ListRepository(`${base}-invalid`);
      let rejected = false;
      try { await invalid.migrateLegacy(storage); } catch { rejected = true; }
      const marker = await invalid.isMigrated();
      const future = `${base}-future`;
      await new Promise((resolve, reject) => {
        const request = indexedDB.open(future, 18);
        request.onsuccess = () => { request.result.close(); resolve(); };
        request.onerror = () => reject(request.error);
      });
      let downgradeError = '';
      try { await new ListRepository(future).getAll(); } catch (error) { downgradeError = error.name; }
      return { first, second, current: current.trip.destination, oldUnchanged: values.get('tpa_list_v1_a') === oldA, rejected, marker, downgradeError };
    } finally {
      for (const name of [base, `${base}-invalid`, `${base}-future`]) indexedDB.deleteDatabase(name);
    }
  }, repositoryUrl);
  expect(result).toEqual({ first: { imported: 1, skipped: 1 }, second: { imported: 0, skipped: 2 }, current: '新版資料', oldUnchanged: true, rejected: true, marker: false, downgradeError: 'VersionError' });
});
