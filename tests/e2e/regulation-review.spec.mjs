import {test,expect} from '@playwright/test';

test('verified references show scope and ambiguous food remains a review item',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:/法規查詢/}).click();
  await expect(page.getByRole('heading',{name:'法規查詢'})).toBeVisible();
  const power=page.locator('article').filter({has:page.getByRole('heading',{name:'行動電源',exact:true})});
  await expect(power).toContainText('每人限帶 2 個');
  await expect(power.getByRole('link',{name:'民航局：行動電源公告'})).toHaveAttribute('href',/caa\.gov\.tw/);
  const blades=page.locator('article').filter({has:page.getByRole('heading',{name:'刀具與剪刀',exact:true})});
  await expect(blades).toContainText('6 公分');
  await page.getByRole('button',{name:/我的旅程/}).click();
  await page.getByPlaceholder('例如：東京, 日本').fill('查證測試');
  await page.getByRole('button',{name:/建立旅程/}).click();
  await page.getByRole('button',{name:/^行李清單/}).click();
  await page.getByPlaceholder('新增物品 (歸類為雜項)...').fill('牛肉乾');
  await page.getByRole('button',{name:'新增',exact:true}).click();
  const card=page.locator('div.rounded-xl').filter({hasText:'肉及含肉加工食品的檢疫條件'}).last();
  await expect(card).toContainText('不能僅由品名判定');
  await expect(card.getByRole('button',{name:'移除項目'})).toHaveCount(0);
  await card.getByRole('button',{name:'詳情'}).click();
  await expect(card.getByRole('link',{name:'日本加工食品例外基準（日文）'})).toHaveAttribute('href',/maff\.go\.jp/);
});
