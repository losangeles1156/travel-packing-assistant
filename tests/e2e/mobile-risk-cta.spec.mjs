import { test, expect } from '@playwright/test';

const startTrip = async (page) => {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.getByPlaceholder('例如：東京, 日本').fill('東京');
  await page.getByRole('button', { name: /建立行李清單/ }).click();
  await expect(page.getByRole('heading', { name: '客製化您的清單' })).toBeVisible();
};

const addBlockingRiskItem = async (page) => {
  const itemInput = page.locator('input[placeholder*="新增物品"]').first();
  await itemInput.fill('行動電源');

  const ruleSelect = page.locator('select:has(option[value="Strict_Checked"])').first();
  await ruleSelect.selectOption('Strict_Checked');

  page.once('dialog', (dialog) => dialog.accept());
  await itemInput.press('Enter');
};

test.describe('mobile risk card and fixed bottom CTA', () => {
  test('fixed CTA reflects blocking risk state and supports bulk resolve undo', async ({ page }) => {
    await startTrip(page);
    await expect(page.getByText('法律風險提醒', { exact: false })).toBeVisible();
    await expect(page.getByText('違禁品可能涉及沒收、罰款甚至刑責', { exact: false })).toBeVisible();
    await expect(page.getByText('目前模式：保守清零（Critical + High）', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: '旅客易懂版' }).click();
    await expect(page.getByText('先把最容易出問題的物品先處理掉', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: '法規嚴肅版' }).click();
    await expect(page.getByText('違禁品可能涉及沒收、罰款甚至刑責', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: '一般（只擋 Critical）' }).click();
    await expect(page.getByText('一般模式不會強制擋下 High 風險', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: '保守（Critical + High 必清零）' }).click();
    await expect(page.getByText('目前模式：保守清零（Critical + High）', { exact: false })).toBeVisible();
    await addBlockingRiskItem(page);
    await expect(page.getByText('安檢前 3 分鐘檢查清單', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: '定位處理' }).first()).toBeVisible();

    const mobileBottomCta = page.locator('div.fixed.bottom-0.left-0.right-0.z-20 button').first();
    await expect(mobileBottomCta).toBeVisible();
    await expect(mobileBottomCta).toContainText('先排除高風險');
    await expect(mobileBottomCta).toBeDisabled();

    await expect(page.getByText('尚有', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('為什麼這很重要', { exact: false })).toBeVisible();

    const detailToggle = page.getByRole('button', { name: '詳情' }).first();
    await detailToggle.click();
    await expect(page.getByText('依據：', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('可能後果：', { exact: false }).first()).toBeVisible();

    await page.getByRole('button', { name: /一鍵處理全部高風險/ }).click();
    await expect(page.getByRole('button', { name: '復原上一批處理' })).toBeVisible();
    await expect(page.getByText('高風險已清零，可安全完成歸類。')).toBeVisible();
    await expect(mobileBottomCta).toContainText('完成並歸類');
    await expect(mobileBottomCta).toBeEnabled();

    await page.getByRole('button', { name: '復原上一批處理' }).click();
    await expect(page.getByText('尚有', { exact: false }).first()).toBeVisible();
    await expect(mobileBottomCta).toContainText('先排除高風險');
    await expect(mobileBottomCta).toBeDisabled();
  });
});
