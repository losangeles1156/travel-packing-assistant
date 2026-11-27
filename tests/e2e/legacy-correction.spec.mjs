import { test, expect } from '@playwright/test';

test('legacy trip with missing region is migrated only after explicit selection and backup', async ({ page }) => {
  const old = { schemaVersion: 1, id: 'legacy-test', updatedAt: '2026-11-08T00:00:00Z', ui: { step: 1, activeCategory: 'ALL', sortBy: 'default' }, trip: { destination: '舊旅程測試', startDate: '2026-12-01', endDate: '2026-12-03', duration: 3 }, items: [], tasks: [], packedItemIds: [], customRules: [] };
  await page.addInitScript(value => localStorage.setItem('tpa_list_v1_legacy-test', JSON.stringify(value)), old);
  await page.goto('/');
  const migrate = page.getByRole('button', { name: '我已保存備份，開始遷移' });
  await expect(migrate).toBeDisabled();
  await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '下載舊資料備份' }).click()]);
  await expect(migrate).toBeDisabled();
  await page.getByLabel('參考地區').selectOption('KR');
  await page.getByLabel('參考方向').selectOption('INBOUND');
  await expect(migrate).toBeEnabled();
  await migrate.click();
  await expect(page.getByText('舊旅程測試', { exact: true }).first()).toBeVisible();
  const stored = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('journey-guardian');
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('lists', 'readonly').objectStore('lists').get('legacy-test');
      get.onsuccess = () => { db.close(); resolve({ country: get.result.trip.country, direction: get.result.trip.direction, old: JSON.parse(localStorage.getItem('tpa_list_v1_legacy-test')) }); };
      get.onerror = () => { db.close(); reject(get.error); };
    };
    request.onerror = () => reject(request.error);
  }));
  expect(stored.country).toBe('KR');
  expect(stored.direction).toBe('INBOUND');
  expect(stored.old).toEqual(old);
});

test('legacy backup requires explicit region before preview and restore', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('例如：東京, 日本').fill('目前的旅程');
  await page.getByRole('button', { name: /建立旅程/ }).click();
  await page.getByRole('button', { name: '工具' }).click();
  const box = page.locator('section[aria-label="本機資料備份"]');
  await box.locator('summary').click();
  const list = { schemaVersion: 1, id: 'legacy-backup', updatedAt: '2026-11-08T00:00:00Z', ui: { step: 1, activeCategory: 'ALL', sortBy: 'default' }, trip: { destination: '舊備份旅程', startDate: '2026-12-01', endDate: '2026-12-03', duration: 3 }, items: [], tasks: [], packedItemIds: [], customRules: [] };
  const file = { format: 'travel-packing-legacy-backup', version: 1, exportedAt: '2026-11-08T00:00:00Z', count: 1, data: { 'tpa_list_v1_legacy-backup': JSON.stringify(list) } };
  await box.locator('input[type=file]').setInputFiles({ name: 'legacy.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  const preview = box.getByRole('button', { name: '確認並預覽備份' });
  await expect(preview).toBeDisabled();
  await box.getByLabel('參考地區').selectOption('TH');
  await box.getByLabel('參考方向').selectOption('INBOUND');
  await preview.click();
  await box.getByRole('button', { name: '確認合併' }).click();
  await expect(box.getByText('匯入完成。', { exact: true })).toBeVisible();
});
