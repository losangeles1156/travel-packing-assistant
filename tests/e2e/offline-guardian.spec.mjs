import { test, expect } from '@playwright/test';

test('after first online load a trip can be created, edited and reopened offline', async ({ page, context }) => {
  test.skip(process.env.E2E_PWA !== '1', 'Requires a production preview with the service worker enabled');
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  try {
    await page.reload();
    await page.getByPlaceholder('例如：東京, 日本').fill('離線測試');
    await page.getByRole('button', { name: /建立旅程/ }).click();
    await page.getByRole('button', { name: /^行李清單/ }).click();
    await page.getByPlaceholder('新增物品 (歸類為雜項)...').fill('離線測試物品');
    await page.getByRole('button', { name: '新增', exact: true }).click();
    await expect(page.getByText('離線測試物品', { exact: true })).toBeVisible();
    // Switch tabs to explicitly flush pending edits before simulating a reopen.
    await page.getByRole('button', { name: /法規查詢/ }).click();
    await expect(page.getByRole('heading', { name: '法規查詢' })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: /^行李清單/ }).click();
    await expect(page.getByText('離線測試物品', { exact: true })).toBeVisible();
  } finally { await context.setOffline(false); }
});
