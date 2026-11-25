import {test,expect} from '@playwright/test';
test('expenses persist separately by trip and currency',async({page})=>{
 await page.goto('/');await page.getByLabel('目的地').fill('東京測試');await page.getByRole('button',{name:'建立旅程'}).click();
 const area=page.getByRole('region',{name:'旅途記帳'});
 for(const [title,amount,currency] of [['午餐','1200','JPY'],['車費','0.10','TWD'],['茶','0.20','TWD']]){await area.getByRole('button',{name:'＋ 新增支出'}).click();await area.getByLabel('支出名稱').fill(title);await area.getByLabel('金額').fill(amount);await area.getByLabel('幣別（三碼）').fill(currency);await area.getByRole('button',{name:'儲存支出'}).click();}
 const totals=area.getByLabel('各幣別支出合計');await expect(totals.getByText('0.30')).toBeVisible();await expect(totals.getByText('1200.00')).toBeVisible();
 await area.getByRole('button',{name:'編輯 午餐'}).click();await area.getByLabel('金額').fill('1300');await area.getByRole('button',{name:'儲存支出'}).click();await expect(totals.getByText('1300.00')).toBeVisible();
 await page.getByText('已儲存至本機',{exact:true}).waitFor();await page.reload();await expect(area.getByText('午餐')).toBeVisible();
 await page.getByRole('button',{name:'切換／新增旅程'}).click();await page.getByLabel('目的地').fill('大阪測試');await page.getByRole('button',{name:'建立旅程'}).click();await expect(area.getByText('尚未記錄旅途支出。')).toBeVisible();
});

test('disruption-linked expense is shown in the incident context',async({page})=>{
 await page.goto('/');await page.getByLabel('目的地').fill('事件測試');await page.getByRole('button',{name:'建立旅程'}).click();
 const docs=page.getByRole('region',{name:'航班與住宿'});await docs.getByRole('button',{name:'＋ 新增航班'}).click();await docs.getByLabel('航空公司或航班名稱').fill('航空甲');await docs.getByRole('button',{name:'確認加入旅程'}).click();
 const change=page.getByRole('region',{name:'旅程變動'});await change.getByRole('button',{name:'＋ 記錄航班變動'}).click();await change.getByLabel('選擇航班').selectOption({index:1});await change.getByLabel('資訊來源').fill('航空公司通知');await change.getByRole('button',{name:'確認記錄變動'}).click();
 const area=page.getByRole('region',{name:'旅途記帳'});await area.getByRole('button',{name:'＋ 新增支出'}).click();await area.getByLabel('支出名稱').fill('延誤住宿費');await area.getByLabel('金額').fill('100');await area.getByLabel('關聯航班變動（選填）').selectOption({index:1});await area.getByLabel('單據狀態').selectOption('needed');await area.getByRole('button',{name:'儲存支出'}).click();await change.getByText('查看需要確認的事項').click();await expect(change.getByText('延誤住宿費',{exact:false})).toBeVisible();await expect(change.getByText('不代表符合保險理賠條件',{exact:false})).toBeVisible();
});

test('expenses can be created and reopened offline',async({page,context})=>{
 test.skip(process.env.E2E_PWA !== '1','Requires production preview and service worker');await page.goto('/');await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.getByLabel('目的地').fill('離線測試');await page.getByRole('button',{name:'建立旅程'}).click();await context.setOffline(true);const area=page.getByRole('region',{name:'旅途記帳'});await area.getByRole('button',{name:'＋ 新增支出'}).click();await area.getByLabel('支出名稱').fill('離線車費');await area.getByLabel('金額').fill('80');await area.getByRole('button',{name:'儲存支出'}).click();await page.getByText('已儲存至本機',{exact:true}).waitFor();await page.reload();await expect(area.getByText('離線車費',{exact:true})).toBeVisible();
});

test('backup and restore retain expenses',async({page})=>{
 await page.goto('/');await page.getByLabel('目的地').fill('備份測試');await page.getByRole('button',{name:'建立旅程'}).click();const area=page.getByRole('region',{name:'旅途記帳'});await area.getByRole('button',{name:'＋ 新增支出'}).click();await area.getByLabel('支出名稱').fill('備份餐費');await area.getByLabel('金額').fill('99');await area.getByRole('button',{name:'儲存支出'}).click();await page.getByText('已儲存至本機',{exact:true}).waitFor();await page.getByRole('button',{name:'工具'}).click();const backup=page.getByRole('region',{name:'本機資料備份'});await backup.locator('summary').click();const [download]=await Promise.all([page.waitForEvent('download'),backup.getByRole('button',{name:'下載備份',exact:true}).click()]);const path=await download.path();page.once('dialog',dialog=>dialog.accept());await backup.getByRole('button',{name:'刪除全部本機資料'}).click();await expect(backup.getByText('清單與對應舊版副本已刪除',{exact:false})).toBeVisible();await backup.locator('input[type=file]').setInputFiles(path);await backup.getByRole('button',{name:'確認合併'}).click();await expect(backup.getByText('匯入完成。',{exact:true})).toBeVisible();await expect(area.getByText('備份餐費',{exact:true})).toBeVisible();
});
