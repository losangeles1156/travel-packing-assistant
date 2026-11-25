import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../services/listStorageService.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const storage = new Map();
globalThis.window = { localStorage: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
}};
const { saveListSnapshot, loadListIndex, loadListSnapshot } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('saving a sixth list retains every earlier index entry and snapshot', () => {
  storage.clear();
  for (let i = 0; i < 6; i++) {
    saveListSnapshot({ schemaVersion: 1, id: `list-${i}`, updatedAt: `2026-01-0${i + 1}T00:00:00Z`, trip: {destination: '日本', startDate: '', endDate: '', duration: 1, country: 'JP', direction: 'OUTBOUND'}, items: [], tasks: [] });
  }
  assert.equal(loadListIndex().length, 6);
  for (let i = 0; i < 6; i++) assert.equal(loadListSnapshot(`list-${i}`)?.id, `list-${i}`);
});
test('clearing the active list does not delete saved snapshots', async () => {
 const {clearActiveListId, getActiveListId} = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
 window.localStorage.setItem('tpa_lists_active_v1', 'list-0');
 clearActiveListId();
 assert.equal(getActiveListId(), null);
 assert.equal(loadListSnapshot('list-0')?.id, 'list-0');
});
