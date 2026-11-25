import { test, expect } from '@playwright/test';

test('buy-before checking links several products to one payment and preserves the payment when plans change', async ({page}) => {
  await page.goto('/');
  await page.getByLabel('目的地').fill('大阪');
  await page.getByRole('button',{name:'建立旅程'}).click();
  const shopping = page.getByRole('region',{name:'跨境物品'});
  for (const [title,intent] of [['牛肉風味泡麵','carry'],['果汁','local'],['日本酒','carry']]) {
    await shopping.getByRole('button',{name:'買前查一下'}).click();
    await shopping.getByLabel('商品名稱').fill(title);
    await shopping.getByLabel('預計怎麼處理').selectOption(intent);
    await shopping.getByRole('button',{name:'儲存物品'}).click();
  }
  await expect(shopping.getByText(/查看包裝成分與配料包/)).toBeVisible();
  await expect(shopping.getByText(/先補品項與總數量/)).toBeVisible();
  await expect(page.getByRole('region',{name:'出發前待確認'})).toContainText('2 件待確認');
  await shopping.getByRole('button',{name:'記一筆購物支出'}).click();
  const expenses = page.getByRole('region',{name:'旅途記帳'});
  await expect(expenses.locator('select').first()).toHaveValue('shopping');
  await expenses.getByLabel('支出名稱').fill('便利商店收據');
  await expenses.getByLabel('金額').fill('1200');
  await expenses.getByLabel('幣別（三碼）').fill('JPY');
  for (const title of ['牛肉風味泡麵','果汁','日本酒']) await expenses.getByRole('checkbox',{name:title}).check();
  await expenses.getByRole('button',{name:'儲存支出'}).click();
  await expect(expenses.getByLabel('各幣別支出合計')).toContainText('1200.00');
  await expect(expenses.getByText('連結物品：牛肉風味泡麵、果汁、日本酒')).toBeVisible();
  await shopping.getByRole('button',{name:'編輯物品 牛肉風味泡麵'}).click();
  await shopping.getByLabel('預計怎麼處理').selectOption('leave');
  await shopping.getByRole('button',{name:'儲存物品'}).click();
  await page.getByText('已儲存至本機',{exact:true}).waitFor();
  await page.reload();
  await expect(page.getByRole('region',{name:'出發前待確認'})).toContainText('1 件待確認');
  await expect(expenses.getByLabel('各幣別支出合計')).toContainText('1200.00');

  page.once('dialog',dialog=>dialog.accept());
  await expenses.getByRole('button',{name:'刪除 便利商店收據'}).click();
  await expect(shopping.getByRole('heading',{name:'牛肉風味泡麵'})).toBeVisible();
  await expect(shopping.getByText('不攜帶 · 未連結支出')).toBeVisible();
});
