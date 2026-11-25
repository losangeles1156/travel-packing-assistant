import { test, expect } from '@playwright/test';

test('several cross-border items link to one payment and survive plan changes and payment deletion', async ({page}) => {
  await page.goto('/');
  await page.getByLabel('目的地').fill('大阪');
  await page.getByRole('button',{name:'建立旅程'}).click();
  const journeyTab = page.getByRole('button',{name:'我的旅程',exact:true});
  const ledgerTab = page.getByRole('button',{name:'旅遊記帳',exact:true});
  const checklist = page.getByRole('region',{name:'跨境物品清單'});
  const pending = page.getByRole('region',{name:'出發前待確認'});
  const expenses = page.getByRole('region',{name:'旅途記帳'});

  await ledgerTab.click();
  for (const [title,intent] of [['牛肉風味泡麵','carry'],['果汁','local'],['日本酒','carry']]) {
    await checklist.getByRole('button',{name:'＋ 手動新增物品'}).click();
    await checklist.getByLabel('商品名稱').fill(title);
    await checklist.getByLabel('預計怎麼處理').selectOption(intent);
    await checklist.getByRole('button',{name:'儲存物品'}).click();
  }
  await expect(checklist.getByText(/查看包裝成分與配料包/)).toBeVisible();
  await expect(checklist.getByText(/先補品項與總數量/)).toBeVisible();
  await expect(checklist).toContainText('2 件待確認');

  await journeyTab.click();
  await expect(pending).toContainText('2 件待確認');
  await expenses.getByRole('button',{name:'＋ 新增支出'}).click();
  await expenses.getByLabel('支出名稱').fill('便利商店收據');
  await expenses.getByLabel('金額').fill('1200');
  await expenses.getByLabel('幣別（三碼）').fill('JPY');
  for (const title of ['牛肉風味泡麵','果汁','日本酒']) await expenses.getByRole('checkbox',{name:title}).check();
  await expenses.getByRole('button',{name:'儲存支出'}).click();
  await expect(expenses.getByLabel('各幣別支出合計')).toContainText('1200.00');
  await expect(expenses.getByText('連結物品：牛肉風味泡麵、果汁、日本酒')).toBeVisible();

  await ledgerTab.click();
  await checklist.getByRole('button',{name:'編輯 牛肉風味泡麵'}).click();
  await checklist.getByLabel('預計怎麼處理').selectOption('leave');
  await checklist.getByRole('button',{name:'儲存物品'}).click();
  await expect(checklist).toContainText('1 件待確認');
  await expect(checklist.getByText('不攜帶 · 已連結支出')).toBeVisible();

  await journeyTab.click();
  await page.getByText('已儲存至本機',{exact:true}).waitFor();
  await page.reload();
  await expect(pending).toContainText('1 件待確認');
  await expect(expenses.getByLabel('各幣別支出合計')).toContainText('1200.00');

  page.once('dialog',dialog=>dialog.accept());
  await expenses.getByRole('button',{name:'刪除 便利商店收據'}).click();
  await ledgerTab.click();
  await expect(checklist.getByRole('heading',{name:'牛肉風味泡麵'})).toBeVisible();
  await expect(checklist.getByText('不攜帶 · 未連結支出')).toBeVisible();
});
