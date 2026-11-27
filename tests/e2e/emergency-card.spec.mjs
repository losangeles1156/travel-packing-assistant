import { test, expect } from '@playwright/test';

test('emergency card gathers stay, insurance and the matching consular office', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('目的地').fill('京都');
  await page.getByRole('button', { name: '建立旅程' }).click();
  const docs = page.getByRole('region', { name: '航班與住宿' });
  await docs.getByRole('button', { name: '＋ 新增住宿' }).click();
  await docs.getByLabel('住宿名稱').fill('京都測試旅館');
  await docs.getByLabel('住宿地址').fill('京都府京都市下京区測試町1-2');
  await docs.getByLabel('聯絡方式（選填）').fill('+81-75-000-0000（櫃台）');
  await docs.getByLabel('訂房編號（選填）').fill('KYO-55821');
  await docs.getByRole('button', { name: '確認加入旅程' }).click();
  await docs.getByRole('button', { name: '＋ 新增航班' }).click();
  await docs.getByLabel('航空公司或航班名稱').fill('測試航空');
  await docs.getByLabel('訂位代號（選填）').fill('HX7Q2P');
  await docs.getByRole('button', { name: '確認加入旅程' }).click();
  await expect(docs.getByText('訂房編號：KYO-55821')).toBeVisible();

  await page.getByRole('button', { name: /緊急資訊卡/ }).click();
  const card = page.getByRole('region', { name: '緊急資訊卡' });
  await expect(page.locator('#journey-emergency')).toBeFocused();
  await expect(card.getByText('京都府京都市下京区測試町1-2')).toBeVisible();
  await expect(card.getByText('訂房編號：KYO-55821')).toBeVisible();
  await expect(card.getByText('訂位代號：HX7Q2P')).toBeVisible();
  await expect(card.getByRole('link', { name: '撥打報警 110' })).toHaveAttribute('href', 'tel:110');
  await expect(card.getByRole('link', { name: '撥打消防、救護車 119' })).toHaveAttribute('href', 'tel:119');
  await expect(card.getByRole('link', { name: '日本國家旅遊局應急指南' })).toHaveAttribute('href', /jnto\.go\.jp/);
  await expect(card.getByRole('link', { name: '撥打京都測試旅館 +81-75-000-0000' })).toHaveAttribute('href', 'tel:+81750000000');
  await expect(card.getByRole('link', { name: /撥打台北駐大阪經濟文化辦事處緊急電話/ })).toHaveAttribute('href', 'tel:+819087944568');
  await expect(card.getByText('其他館處（5）')).toBeVisible();
  await expect(card.getByText('尚未記錄保險公司與聯絡方式。')).toBeVisible();
  await expect(card.getByRole('link', { name: /外交部旅外國人緊急服務專線/ })).toHaveAttribute('href', 'tel:+886800085095');

  await card.getByRole('button', { name: '把「京都測試旅館」地址放大給司機看' }).click();
  const dialog = page.getByRole('dialog', { name: '京都測試旅館' });
  await expect(dialog.getByText('京都府京都市下京区測試町1-2')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: '證件遺失' }).click();
  await expect(page.getByText('取得報案證明', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '查看駐外館處電話' }).click();
  await expect(page.locator('#journey-emergency')).toBeFocused();
});

test('emergency card reopens offline', async ({ page, context }) => {
  test.skip(process.env.E2E_PWA !== '1', 'Requires production preview and service worker');
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.getByLabel('目的地').fill('札幌');
  await page.getByRole('button', { name: '建立旅程' }).click();
  const docs = page.getByRole('region', { name: '航班與住宿' });
  await docs.getByRole('button', { name: '＋ 新增住宿' }).click();
  await docs.getByLabel('住宿名稱').fill('離線旅館');
  await docs.getByLabel('住宿地址').fill('北海道札幌市測試1-1');
  await docs.getByRole('button', { name: '確認加入旅程' }).click();
  await page.getByText('已儲存至本機', { exact: true }).waitFor();
  await context.setOffline(true);
  await page.reload();
  const card = page.getByRole('region', { name: '緊急資訊卡' });
  await expect(card.getByText('北海道札幌市測試1-1')).toBeVisible();
  await expect(card.getByRole('link', { name: /撥打台北駐日經濟文化代表處札幌分處緊急電話/ })).toBeVisible();
});
