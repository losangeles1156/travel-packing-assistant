import { test, expect } from '@playwright/test';

test('draft edits reopen the check and explicit review history survives reopening', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('例如：東京, 日本').fill('流程測試');
  await page.getByRole('button', { name: /建立旅程/ }).click();
  const card = page.locator('section[aria-label="旅程檢查"] > div.space-y-2 > details').first();
  await card.locator(':scope > summary').click();
  await card.getByLabel('國籍', { exact: true }).fill('臺灣');
  await card.getByLabel('目的地', { exact: true }).fill('日本');
  await card.getByLabel('轉機地點或無轉機').fill('無');
  await card.getByRole('button', { name: '記錄這些資料' }).click();
  await card.getByLabel('處理狀態').selectOption('done');
  await card.getByRole('button', { name: '記錄備註與重新檢視' }).click();
  await card.getByLabel('目的地', { exact: true }).fill('韓國');
  await expect(card.locator(':scope > summary')).toContainText('待複核');
  await card.getByRole('button', { name: '記錄備註與重新檢視' }).click();
  await expect(card.getByRole('status')).toContainText('尚未記錄');
  await card.getByRole('button', { name: '記錄這些資料' }).click();
  await card.getByRole('button', { name: '記錄備註與重新檢視' }).click();
  await expect(page.getByText('已儲存至本機', { exact: true })).toBeVisible();
  await page.reload();
  await card.locator(':scope > summary').click();
  await expect(card.getByLabel('目的地', { exact: true })).toHaveValue('韓國');
  await expect(card.getByText('查看重新檢視紀錄（2）')).toBeVisible();
});

test('a done communication task with unknown compatibility remains visible for attention', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('例如：東京, 日本').fill('通訊測試');
  await page.getByRole('button', { name: /建立旅程/ }).click();
  const card = page.locator('section[aria-label="旅程檢查"] > div.space-y-2 > details').nth(1);
  await card.locator(':scope > summary').click();
  await card.getByLabel('裝置型號').fill('測試裝置');
  await card.getByLabel(/相容性確認結果/).selectOption({ label: '待確認' });
  await card.getByLabel('上網方式與啟用條件').fill('待查詢');
  await card.getByRole('button', { name: '記錄這些資料' }).click();
  await card.getByLabel('是否適用').selectOption('applicable');
  await card.getByLabel('處理狀態').selectOption('done');
  await expect(card.locator(':scope > summary')).toContainText('缺資料');
  await expect(page.locator('.guardian-heading')).toContainText('6 項需要留意');
});
