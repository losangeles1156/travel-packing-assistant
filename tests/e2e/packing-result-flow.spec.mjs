import {test,expect} from '@playwright/test';

test('packing quantity, units and measured baggage weights persist and lead to guardian',async({page})=>{
  await page.goto('/');
  await page.getByPlaceholder('例如：東京, 日本').fill('重量測試');
  await page.getByRole('button',{name:/建立旅程/}).click();
  await page.getByRole('button',{name:/^行李清單/}).click();
  await expect(page.getByRole('checkbox',{name:'選擇 Wi-Fi 分享器（實體設備）'})).toHaveAttribute('aria-checked','false');
  await page.getByRole('button',{name:'完成並歸類'}).first().click();
  const before=Number(await page.getByLabel('襪子 數量',{exact:true}).innerText());
  await page.getByRole('button',{name:'增加打包 襪子 數量'}).click();
  await page.getByLabel('襪子 單位').selectOption('雙');
  await page.getByLabel('手提實測重量（公斤）').fill('8');
  await page.getByLabel('手提允許重量（公斤）').fill('7');
  await expect(page.getByText(/超過自行輸入的限額/)).toBeVisible();
  await expect(page.getByText('已儲存至本機',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('襪子 數量',{exact:true})).toHaveText(String(before+1));
  await expect(page.getByLabel('襪子 單位')).toHaveValue('雙');
  await expect(page.getByLabel('手提實測重量（公斤）')).toHaveValue('8');
  await expect(page.getByLabel('手提允許重量（公斤）')).toHaveValue('7');
  await page.getByRole('button',{name:'查看旅程守護'}).click();
  await expect(page.getByRole('region',{name:'航班與住宿'})).toBeVisible();
});
