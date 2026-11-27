import { test, expect } from '@playwright/test';

const ticket = `長榮航空 電子機票行程單
訂位代號：ABC123
航班 BR198
2026/12/01 08:50 台北桃園 (TPE) → 東京成田 (NRT) 13:05
航班 BR197
2026/12/05 14:30 東京成田 (NRT) → 台北桃園 (TPE) 17:30`;
const hotel = `您在 新宿華盛頓酒店 的預訂已確認
入住日期：2026年12月1日（星期一）15:00 後
退房日期：2026年12月5日（星期五）11:00 前
地址：東京都新宿區西新宿3-2-9
電話：+81-3-3343-3111`;

test('shared flight confirmation lists each flight for review before it is saved', async ({ page }) => {
  await page.goto('/'); await page.getByLabel('目的地').fill('東京'); await page.getByRole('button', { name: '建立旅程' }).click();
  await page.getByText('已儲存至本機', { exact: true }).waitFor();
  await page.goto('/?receipt_text=' + encodeURIComponent(ticket));
  const docs = page.getByRole('region', { name: '航班與住宿' });
  await expect(docs.getByText('辨識到 2 筆', { exact: false })).toBeVisible();
  expect(page.url()).not.toContain('receipt_text');
  await expect(page.getByRole('region', { name: '旅途記帳' }).getByLabel('收據文字')).toHaveCount(0);
  await docs.getByRole('button', { name: /檢查後加入：長榮航空 BR198/ }).click();
  await expect(docs.getByLabel('航班號碼（選填）')).toHaveValue('BR198');
  await expect(docs.getByLabel('出發機場')).toHaveValue('TPE');
  await expect(docs.getByLabel('出發日期', { exact: true })).toHaveValue('2026-12-01');
  await expect(docs.getByLabel('訂位代號（選填）')).toHaveValue('');
  await docs.getByRole('button', { name: '確認加入旅程' }).click();
  await expect(docs.getByRole('button', { name: /檢查後加入：長榮航空 BR198/ })).toHaveCount(0);
  await expect(docs.getByRole('button', { name: /檢查後加入：長榮航空 BR197/ })).toBeVisible();
  await expect(docs.getByRole('heading', { name: '長榮航空 BR198' })).toBeVisible();
  await expect(page.getByRole('region', { name: '緊急資訊卡' }).getByText('長榮航空 BR198')).toBeVisible();
});

test('shared hotel confirmation waits for a trip, then offers the stay', async ({ page }) => {
  await page.goto('/?receipt_text=' + encodeURIComponent(hotel));
  await expect(page.getByRole('status').filter({ hasText: '已收到分享的訂位確認信' })).toBeVisible();
  await page.getByLabel('目的地').fill('東京'); await page.getByRole('button', { name: '建立旅程' }).click();
  const docs = page.getByRole('region', { name: '航班與住宿' });
  await docs.getByRole('button', { name: /檢查後加入：新宿華盛頓酒店/ }).click();
  await expect(docs.getByLabel('住宿名稱')).toHaveValue('新宿華盛頓酒店');
  await expect(docs.getByLabel('住宿地址')).toHaveValue('東京都新宿區西新宿3-2-9');
  await expect(docs.getByLabel('退房日期', { exact: true })).toHaveValue('2026-12-05');
});

test('pasting text that is not a confirmation points to manual entry', async ({ page }) => {
  await page.goto('/'); await page.getByLabel('目的地').fill('東京'); await page.getByRole('button', { name: '建立旅程' }).click();
  const docs = page.getByRole('region', { name: '航班與住宿' });
  await docs.locator('.booking-import summary').click();
  await docs.getByLabel('確認信文字').fill('今天天氣很好');
  await docs.getByRole('button', { name: '解析確認信' }).click();
  await expect(docs.getByRole('alert').filter({ hasText: '沒有辨識到航班或住宿' })).toBeVisible();
});
