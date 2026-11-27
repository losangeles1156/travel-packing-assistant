import { test, expect } from '@playwright/test';

for (const mode of ['確認合併', '確認取代']) test(`backup preview must be refreshed before ${mode} if local data changes`, async ({page}) => {
  await page.goto('/');
  await page.getByPlaceholder('例如：東京, 日本').fill('備份預覽測試');
  await page.getByRole('button',{name:/建立旅程/}).click();
  await page.getByRole('button',{name:/^行李清單/}).click();
  await expect(page.getByRole('heading',{name:'客製化您的清單'})).toBeVisible();
  await page.getByRole('button',{name:'工具'}).click();
  const backup=page.locator('section[aria-label="本機資料備份"]');
  await backup.locator('summary').click();
  const [download]=await Promise.all([page.waitForEvent('download'),backup.getByRole('button',{name:'下載備份',exact:true}).click()]);
  const path=await download.path();
  await backup.locator('input[type=file]').setInputFiles(path);
  await expect(backup.getByRole('button',{name:mode})).toBeVisible();
  await page.getByPlaceholder('新增物品 (歸類為雜項)...').fill('後加入的測試物品');
  await page.getByRole('button',{name:'新增',exact:true}).click();
  await expect(page.getByText('後加入的測試物品',{exact:true})).toBeVisible();
  await backup.getByRole('button',{name:mode}).click();
  await expect(backup.getByRole('alert')).toHaveText('本機資料已變更，請重新選擇備份並確認匯入內容。');
  await expect(page.getByText('後加入的測試物品',{exact:true})).toBeVisible();
  await backup.locator('input[type=file]').setInputFiles(path);
  await backup.getByRole('button',{name:mode}).click();
  await expect(backup.getByText('匯入完成。',{exact:true})).toBeVisible();
});
