import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const module = await build({entryPoints:['domain/fieldActions.ts'],bundle:true,write:false,format:'esm'});
const { fieldActions } = await import('data:text/javascript;base64,'+Buffer.from(module.outputFiles[0].contents).toString('base64'));
const event = {flightId:'A',type:'delay',newDate:'2026-12-09',newTime:'09:00',newZone:'Asia/Tokyo'};
const plan = {flightId:'A',id:'transfer',title:'接送',date:'2026-12-09',time:'07:00',timezone:'Asia/Tokyo',contact:'接送商'};
const protection = {expiryDate:'2026-12-09',expiryTime:'08:00',expiryZone:'Asia/Taipei'};
test('到期等於新出發時間，依時區比較，限本航班接送',()=>{
  const actions=fieldActions(event,[plan,{...plan,id:'other',flightId:'B'}],[],protection);
  assert.deepEqual(actions.map(action=>action.id),['network','transport-transfer']);
  assert.match(actions[1].detail,/07:00/);
});
test('取消、時間缺漏與夏令時間重疊先查航班',()=>{
  for(const change of [{type:'cancelled'},{newZone:''},{newDate:'2026-11-01',newTime:'01:30',newZone:'America/New_York'}]){
    const actions=fieldActions({...event,...change},[plan],[],protection);
    assert.equal(actions[0].id,'flight');
    assert.ok(!actions.some(action=>action.id==='network'));
  }
});
test('接送資料變更使舊處理紀錄失效，無關紀錄不影響',()=>{
  const original=fieldActions(event,[plan],[],undefined)[0].evidence;
  assert.notEqual(fieldActions(event,[{...plan,time:'06:00'}],[],undefined)[0].evidence,original);
  assert.equal(fieldActions(event,[plan,{...plan,flightId:'B'}],[],undefined)[0].evidence,original);
});
