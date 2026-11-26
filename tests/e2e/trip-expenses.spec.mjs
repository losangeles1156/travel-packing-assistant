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

test('saving an expense with fresh produce or meat warns right away',async({page})=>{
 await page.goto('/');await page.getByLabel('目的地').fill('入境提醒測試');await page.getByRole('button',{name:'建立旅程'}).click();
 const area=page.getByRole('region',{name:'旅途記帳'});
 const add=async(title,note='')=>{await area.getByRole('button',{name:'＋ 新增支出'}).click();await area.getByLabel('支出名稱').fill(title);await area.getByLabel('金額').fill('500');await area.getByLabel('幣別（三碼）').fill('JPY');if(note)await area.getByLabel('備註（選填）').fill(note);await area.getByRole('button',{name:'儲存支出'}).click();};
 await add('草莓大福');await expect(area.getByText('可能含有不能帶回台灣的品項',{exact:false})).toHaveCount(0);
 await add('草莓一盒');const alert=area.locator('.expense-risk-alert');await expect(alert).toContainText('「草莓一盒」可能含有不能帶回台灣的品項');await expect(alert).toBeFocused();
 await alert.getByRole('button',{name:'會在當地吃完'}).click();await expect(alert).toHaveCount(0);await expect(area.getByText('已記下「草莓一盒」會在當地吃完',{exact:false})).toBeVisible();
 await add('超市採買','和牛 2 盒');await expect(alert).toContainText('動物產品');
 await alert.getByRole('button',{name:'加入跨境檢核'}).click();await expect(alert).toHaveCount(0);
 await page.getByRole('button',{name:'旅遊記帳'}).click();const list=page.getByRole('main');await expect(list.getByText('1 件待確認')).toBeVisible();await expect(list.getByRole('button',{name:'加入檢核'})).toHaveCount(0);
});

test('pasted receipt text fills an expense draft locally and keeps typed values',async({page})=>{
 await page.goto('/');await page.getByLabel('目的地').fill('收據測試');await page.getByRole('button',{name:'建立旅程'}).click();
 const area=page.getByRole('region',{name:'旅途記帳'});
 await area.getByRole('button',{name:'＋ 新增支出'}).click();
 await area.getByLabel('金額').fill('5000');
 await area.locator('.receipt-text summary').click();
 await area.getByLabel('收據文字').fill('ファミリーマート 新宿東口店\n2026年11月25日 14:32\n和牛 切り落とし ￥３，２８０※\nいちご 1パック ￥９８０※\n合計 ¥4,260\nお預り ¥5,000');
 await area.getByRole('button',{name:'解析並填入'}).click();
 const result=area.getByRole('status').filter({hasText:'已填入'});
 await expect(result).toContainText('已填入：名稱、日期、品項（辨識到 2 個品項）');
 await expect(result).toContainText('保留你已填的：金額、幣別');
 await expect(area.getByLabel('支出名稱')).toHaveValue('ファミリーマート 新宿東口店');
 await expect(area.getByLabel('金額')).toHaveValue('5000');
 await expect(area.getByLabel('日期（選填）')).toHaveValue('2026-11-25');
 await expect(area.getByLabel('備註（選填）')).toHaveValue('品項：和牛 切り落とし、いちご 1パック');
 await area.getByLabel('金額').fill('');await area.getByRole('button',{name:'解析並填入'}).click();
 await expect(area.getByLabel('金額')).toHaveValue('4260');await expect(area.getByLabel('幣別（三碼）')).toHaveValue('JPY');
 await expect(area.getByLabel('備註（選填）')).toHaveValue('品項：和牛 切り落とし、いちご 1パック');
 await area.getByRole('button',{name:'儲存支出'}).click();
 const alert=area.locator('.expense-risk-alert');await expect(alert).toContainText('動物產品');await expect(alert).toContainText('植物及農產品');
 await area.getByRole('button',{name:'＋ 新增支出'}).click();await area.locator('.receipt-text summary').click();
 await area.getByRole('button',{name:'解析並填入'}).click();await expect(area.getByRole('alert').filter({hasText:'請先貼上收據文字'})).toBeVisible();
});

const sharedReceipt='ローソン 梅田店\n2026年11月26日 21:10\nいちご 1パック ¥980※\n合計 ¥980';
test('receipt text shared from Android waits for a trip, then opens a filled expense draft',async({page})=>{
 await page.goto('/?receipt_text='+encodeURIComponent(sharedReceipt));
 await expect(page.getByRole('status').filter({hasText:'已收到分享的收據文字'})).toBeVisible();
 expect(page.url()).not.toContain('receipt_text');
 await page.getByLabel('目的地').fill('大阪');await page.getByRole('button',{name:'建立旅程'}).click();
 const area=page.getByRole('region',{name:'旅途記帳'});
 await expect(area.getByLabel('支出名稱')).toHaveValue('ローソン 梅田店');
 await expect(area.getByLabel('金額')).toHaveValue('980');
 await expect(area.getByLabel('分類')).toHaveValue('shopping');
 await expect(area.getByRole('status').filter({hasText:'已填入'})).toBeVisible();
});

test('receipt text shared into an existing trip opens the expense draft directly',async({page})=>{
 await page.goto('/');await page.getByLabel('目的地').fill('京都');await page.getByRole('button',{name:'建立旅程'}).click();
 await page.getByText('已儲存至本機',{exact:true}).waitFor();
 await page.goto('/?receipt_title=%E6%94%B6%E6%93%9A&receipt_text='+encodeURIComponent(sharedReceipt));
 const area=page.getByRole('region',{name:'旅途記帳'});
 await expect(area.getByLabel('支出名稱')).toHaveValue('ローソン 梅田店');
 await expect(area.getByLabel('收據文字')).toHaveValue(sharedReceipt);
 expect(page.url()).not.toContain('receipt_text');
});

test('ledger tab button opens the receipt capture steps on the journey page',async({page})=>{
 await page.goto('/');await page.getByLabel('目的地').fill('札幌');await page.getByRole('button',{name:'建立旅程'}).click();
 await page.getByRole('button',{name:'旅遊記帳',exact:true}).click();
 await page.getByRole('region',{name:'記一筆購物'}).getByRole('button',{name:'拍收據記帳'}).click();
 const area=page.getByRole('region',{name:'旅途記帳'});
 await expect(area.getByText('選取文字後按「分享」，選「旅程準備」',{exact:false})).toBeVisible();
 await expect(area.getByLabel('收據文字')).toHaveValue('');
 await expect(area.getByLabel('分類')).toHaveValue('shopping');
});
