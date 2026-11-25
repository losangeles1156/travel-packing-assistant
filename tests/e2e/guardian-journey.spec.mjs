import { test, expect } from '@playwright/test';

test('six manual checks survive rescheduling, backup and restore', async ({page}) => {
  test.setTimeout(120000);
  await page.goto('/');
  await page.getByPlaceholder('例如：東京, 日本').fill('端到端測試');
  await page.getByLabel('出發日期').fill('2026-12-01');
  await page.getByLabel('回程日期').fill('2026-12-05');
  await page.getByRole('button',{name:/建立旅程/}).click();
  const cards=page.locator('section[aria-label="旅程檢查"] > div.space-y-2 > details');
  await expect(cards).toHaveCount(6);
  const fields=[
    [['國籍','測試國籍'],['目的地','測試地'],['轉機地點或無轉機','無轉機']],
    [['裝置型號','測試型號'],['上網方式與啟用條件','待確認']],
    [['航空公司','測試航空'],['艙等','經濟艙'],['需確認的物品及條件','測試物品']],
    [['航班日期與時間','2026-12-01 10:00'],['航班時間所屬時區','Asia/Tokyo'],['航廈','第一航廈'],['出發地','測試地'],['已確認的交通與備案','測試交通'],['預留緩衝時間','120 分鐘'],['住宿聯絡方式（選填）','測試電話'],['住宿或交通中斷備忘（選填）','先聯絡住宿']],
    [['回程入境地','臺灣'],['物品分類與數量','水果一盒']],
    [],
  ];
  for (let i=0;i<6;i++) {
    const card=cards.nth(i); await card.locator(':scope > summary').click();
    for (const [label,value] of fields[i]) await card.getByLabel(label,{exact:true}).fill(value);
    if (i===1) await card.getByLabel(/相容性確認結果/).selectOption({label:'待確認'});
    if (i===5) await card.getByLabel('自願回饋').selectOption({label:'有幫助'});
    await card.getByRole('button',{name:'記錄這些資料'}).click();
    if (i===0) await card.getByLabel('處理狀態').selectOption({label:'完成'});
    await card.locator(':scope > summary').click();
  }
  await expect(page.getByText('已儲存至本機',{exact:true})).toBeVisible();
  await page.reload();
  await expect(cards.first().locator(':scope > summary')).toContainText('完成');
  await cards.nth(3).locator(':scope > summary').click();
  await expect(cards.nth(3).getByLabel('住宿聯絡方式（選填）',{exact:true})).toHaveValue('測試電話');
  await cards.nth(3).locator(':scope > summary').click();
  const editor=page.locator('details').filter({has:page.locator('summary').getByText('變更旅程日期與時區')});
  await editor.locator(':scope > summary').click();
  await editor.getByLabel('出發日期').fill('2026-12-02');
  await editor.getByRole('button',{name:'更新日期與時區'}).click();
  await expect(cards.first().locator(':scope > summary')).toContainText('待複核');
  await page.getByRole('button',{name:'工具'}).click();
  const backup=page.locator('section[aria-label="本機資料備份"]'); await backup.locator('summary').click();
  const [download]=await Promise.all([page.waitForEvent('download'),backup.getByRole('button',{name:'下載備份',exact:true}).click()]);
  const backupPath=await download.path();
  page.once('dialog',dialog=>dialog.accept());
  await backup.getByRole('button',{name:'刪除全部本機資料'}).click();
  await expect(backup.getByText('清單與對應舊版副本已刪除',{exact:false})).toBeVisible();
  await backup.locator('input[type=file]').setInputFiles(backupPath);
  await backup.getByRole('button',{name:'確認合併'}).click();
  await expect(backup.getByText('匯入完成。',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'旅程準備',exact:true})).toBeVisible();
  await expect(cards.first().locator(':scope > summary')).toContainText('待複核');
  const reminders=page.locator('details').filter({has:page.locator('summary').getByText('匯出日曆提醒')});
  await reminders.locator(':scope > summary').click();
  await reminders.getByLabel('出發地時區（留空使用已存時區）').fill('Asia/Taipei');
  await reminders.getByLabel('回程地時區（留空使用已存時區）').fill('Asia/Tokyo');
  await reminders.getByRole('button',{name:'預覽提醒'}).click();
  await expect(reminders.getByRole('button',{name:'確認並匯出日曆'})).toBeVisible();
});
