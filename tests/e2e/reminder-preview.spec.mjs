import { test, expect } from '@playwright/test';

test('reminder export asks for a new preview when the local date changes', async ({page}) => {
  await page.clock.setFixedTime(new Date('2026-11-08T12:00:00Z'));
  await page.goto('/');
  await page.getByPlaceholder('例如：東京, 日本').fill('日曆測試');
  await page.getByLabel('出發日期').fill('2026-11-15');
  await page.getByLabel('回程日期').fill('2026-11-20');
  await page.getByRole('button',{name:/建立旅程/}).click();
  await page.getByRole('button',{name:'工具'}).click();
  const box=page.locator('details').filter({has:page.locator('summary').getByText('匯出日曆提醒')});
  await box.locator(':scope > summary').click();
  await box.getByLabel('出發地時區（留空使用已存時區）').fill('Asia/Taipei');
  await box.getByLabel('回程地時區（留空使用已存時區）').fill('Asia/Tokyo');
  await box.getByRole('button',{name:'預覽提醒'}).click();
  await expect(box.getByRole('button',{name:'確認並匯出日曆'})).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-11-09T12:00:00Z'));
  await box.getByRole('button',{name:'確認並匯出日曆'}).click();
  await expect(box.getByRole('status')).toHaveText('提醒時點已變更，請重新預覽。');
});
