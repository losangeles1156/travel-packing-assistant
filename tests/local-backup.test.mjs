import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../services/localBackup.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { buildLegacyBackup } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('backup keeps indexed and orphaned snapshots and excludes credentials and analytics', () => {
  const map = new Map([['tpa_list_v1_1', '{"id":"1"}'], ['tpa_list_v1_orphan', '{"id":"orphan"}'], ['tpa_lists_index_v1', '[]'], ['tpa_admin_token', 'secret'], ['tpa_user_id', 'private-id'], ['api_key', 'secret']]);
  const storage = { length: map.size, key: i => [...map.keys()][i] ?? null, getItem: k => map.get(k) ?? null };
  const result = buildLegacyBackup(storage, new Date('2026-11-07T00:00:00Z'));
  assert.equal(result.count, 2);
  assert.equal(result.data.tpa_list_v1_orphan, '{"id":"orphan"}');
  assert.ok(!JSON.stringify(result).includes('secret'));
  assert.ok(!JSON.stringify(result).includes('private-id'));
});
