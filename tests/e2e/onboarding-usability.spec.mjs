import { test, expect } from '@playwright/test';

test('empty destination has a clear error and selected timezones persist', async ({page}) => {
  await page.goto('/');
  await page.getByPlaceholder('例如：東京, 日本').fill('   ');
  await page.getByRole('button',{name:/建立旅程/}).click();
  const destination=page.getByLabel('目的地',{exact:true});
  await expect(destination).toBeFocused();
  await expect(destination).toHaveAttribute('aria-invalid','true');
  await expect(page.getByRole('alert')).toHaveText('請先輸入目的地。');
  await destination.fill('京都');
  await page.getByRole('button',{name:/建立旅程/}).click();
  await page.getByRole('button',{name:'設定時區'}).click();
  const settings=page.locator('details').filter({has:page.locator('summary').getByText('變更旅程日期與時區')});
  await expect(settings).toHaveAttribute('open','');
  await settings.getByLabel('出發地常用時區').selectOption('Asia/Taipei');
  await settings.getByLabel('回程地常用時區').selectOption('Asia/Tokyo');
  await settings.getByRole('button',{name:'更新日期與時區'}).click();
  await expect(page.getByRole('button',{name:'設定時區'})).toHaveCount(0);
  await expect(page.getByText('已儲存至本機',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button',{name:'設定時區'})).toHaveCount(0);
  await settings.locator(':scope > summary').click();
  await expect(settings.getByLabel('出發地常用時區')).toHaveValue('Asia/Taipei');
  await expect(settings.getByLabel('回程地常用時區')).toHaveValue('Asia/Tokyo');
});
