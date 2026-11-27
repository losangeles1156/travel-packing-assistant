import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../infrastructure/listRepository.ts', import.meta.url), 'utf8');
const domain=fs.readFileSync(new URL('../domain/guardian.ts', import.meta.url),'utf8');
const domainJs=ts.transpileModule(domain,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const domainUrl=`data:text/javascript;base64,${Buffer.from(domainJs).toString('base64')}`;
const tzJs=ts.transpileModule(fs.readFileSync(new URL('../domain/timezone.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const tzUrl=`data:text/javascript;base64,${Buffer.from(tzJs).toString('base64')}`;
const docsJs=ts.transpileModule(fs.readFileSync(new URL('../domain/tripDocuments.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const docsUrl=`data:text/javascript;base64,${Buffer.from(docsJs).toString('base64')}`;
const disruptionsJs=ts.transpileModule(fs.readFileSync(new URL('../domain/tripDisruptions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const disruptionsUrl=`data:text/javascript;base64,${Buffer.from(disruptionsJs).toString('base64')}`;
const transportJs=ts.transpileModule(fs.readFileSync(new URL('../domain/transportPlan.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const transportUrl=`data:text/javascript;base64,${Buffer.from(transportJs).toString('base64')}`;
const protectionJs=ts.transpileModule(fs.readFileSync(new URL('../domain/travelProtection.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const protectionUrl=`data:text/javascript;base64,${Buffer.from(protectionJs).toString('base64')}`;
const expensesJs=ts.transpileModule(fs.readFileSync(new URL('../domain/expenses.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const expensesUrl=`data:text/javascript;base64,${Buffer.from(expensesJs).toString('base64')}`;
const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace('../domain/guardian',domainUrl).replace('../domain/timezone',tzUrl).replace('../domain/tripDocuments',docsUrl).replace('../domain/tripDisruptions',disruptionsUrl).replace('../domain/transportPlan',transportUrl).replace('../domain/travelProtection',protectionUrl).replace('../domain/expenses',expensesUrl);
const {normalizeBackup, validateBackup, inspectLegacyRequirements, inspectLegacyBackupRequirements, readLegacyLists} = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const list = {schemaVersion:1,id:'one',updatedAt:'2026-11-07T00:00:00Z',ui:{step:1,activeCategory:'ALL',sortBy:'default'},trip:{destination:'測試',startDate:'2026-11-07',endDate:'2026-11-08',duration:2,country:'JP',direction:'OUTBOUND'},items:[],tasks:[],packedItemIds:[],customRules:[]};
const backup = {format:'journey-guardian-lists',version:1,exportedAt:'2026-11-07T00:00:00Z',count:1,lists:[list]};
test('legacy backup is accepted and preserves its list', () => {
 const legacy={format:'travel-packing-legacy-backup',version:1,exportedAt:backup.exportedAt,count:1,data:{tpa_list_v1_one:JSON.stringify(list)}};
 assert.deepEqual(normalizeBackup(legacy).lists,[list]);
});
test('invalid nested data and duplicate IDs are rejected before import', () => {
 assert.throws(()=>validateBackup({...backup,lists:[{...list,items:[null]}]}));
 assert.throws(()=>validateBackup({...backup,count:2,lists:[list,list]}));
 assert.throws(()=>normalizeBackup({format:'travel-packing-legacy-backup',version:1,exportedAt:backup.exportedAt,count:1,data:{tpa_list_v1_wrong:JSON.stringify(list)}}));
});
test('a blocked upgrade rejects and aborts a later upgrade attempt',async()=>{const {ListRepository}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);let request,aborted=false,created=0;globalThis.indexedDB={open(){request={result:{objectStoreNames:{contains:()=>false},createObjectStore:()=>{created++},close:()=>{}},transaction:{abort:()=>{aborted=true}}};queueMicrotask(()=>request.onblocked());return request}};await assert.rejects(()=>new ListRepository('test').getAll(),/升級受阻/);request.onupgradeneeded();assert.equal(aborted,true);assert.equal(created,0);delete globalThis.indexedDB;});
test('backup reader accepts v1 through v12, emits v12, and rejects future versions',()=>{for (const version of [1,2,3,4,5,6,7,8,9,10,11,12]) assert.equal(validateBackup({...backup,version}).version,12);assert.throws(()=>validateBackup({...backup,version:13}),/版本不相容/);assert.throws(()=>validateBackup({...backup,lists:[{...list,documents:[]}]}),/版本/);assert.throws(()=>validateBackup({...backup,version:3,lists:[{...list,disruptions:[]}]}),/版本/);});
test('legacy missing region needs explicit correction without changing original data',()=>{
 const legacy = {...list,trip:{...list.trip}}; delete legacy.trip.country; delete legacy.trip.direction;
 const bytes=JSON.stringify(legacy); const storage={length:1,key:()=> 'tpa_list_v1_one',getItem:()=>bytes};
 assert.deepEqual(inspectLegacyRequirements(storage),[{id:'one',destination:'測試',country:true,direction:true}]);
 assert.throws(()=>readLegacyLists(storage));
 assert.throws(()=>readLegacyLists(storage,{one:{country:'INVALID',direction:'OUTBOUND'}}));
 const converted=readLegacyLists(storage,{one:{country:'KR',direction:'INBOUND'}});
 assert.equal(converted[0].trip.country,'KR'); assert.equal(converted[0].trip.direction,'INBOUND');
 assert.equal(storage.getItem('tpa_list_v1_one'),bytes);
});
test('explicit legacy fields are never overwritten by correction values',()=>{
 const bytes=JSON.stringify(list); const storage={length:1,key:()=> 'tpa_list_v1_one',getItem:()=>bytes};
 assert.deepEqual(inspectLegacyRequirements(storage),[]);
 const converted=readLegacyLists(storage,{one:{country:'KR',direction:'INBOUND'}});
 assert.equal(converted[0].trip.country,'JP'); assert.equal(converted[0].trip.direction,'OUTBOUND');
});
test('legacy backup missing region requires explicit correction before normalization',()=>{
 const legacy={...list,trip:{...list.trip}}; delete legacy.trip.country; delete legacy.trip.direction;
 const file={format:'travel-packing-legacy-backup',version:1,exportedAt:backup.exportedAt,count:1,data:{tpa_list_v1_one:JSON.stringify(legacy)}};
 assert.equal(inspectLegacyBackupRequirements(file).length,1);
 assert.throws(()=>normalizeBackup(file));
 const result=normalizeBackup(file,{one:{country:'TH',direction:'INBOUND'}});
 assert.equal(result.lists[0].trip.country,'TH'); assert.equal(result.lists[0].trip.direction,'INBOUND');
 assert.equal(JSON.parse(file.data.tpa_list_v1_one).trip.country,undefined);
});
test('new document records require v3 backup and reject malformed records',()=>{
 const fields={title:'測試航空',flightNumber:'AB123',from:'TPE',to:'KIX',startDate:'2026-12-01',startTime:'10:00',startZone:'Asia/Taipei',endDate:'2026-12-01',endTime:'14:00',endZone:'Asia/Tokyo',address:'',contact:''};
 const doc={...fields,id:'d1',kind:'flight',source:'manual',createdAt:backup.exportedAt,updatedAt:backup.exportedAt};
 const snapshot={...list,documents:[doc]};
 assert.equal(validateBackup({...backup,version:3,lists:[snapshot]}).lists[0].documents[0].flightNumber,'AB123');
 assert.throws(()=>validateBackup({...backup,version:2,lists:[snapshot]}),/版本/);
 assert.throws(()=>validateBackup({...backup,version:3,lists:[{...snapshot,documents:[{...doc,title:123}]}]}));
 assert.throws(()=>validateBackup({...backup,version:3,lists:[{...snapshot,documents:[doc,doc]}]}));
});
test('flight changes require v4 backup and preserve their original snapshot',()=>{
 const original={title:'測試航空',flightNumber:'AB123',from:'TPE',to:'KIX',startDate:'2026-12-01',startTime:'10:00',startZone:'Asia/Taipei',endDate:'2026-12-01',endTime:'14:00',endZone:'Asia/Tokyo'};
 const event={id:'event1',flightId:'flight1',type:'delay',original,newDate:'2026-12-02',newTime:'10:00',newZone:'Asia/Taipei',source:'航空公司通知',note:'',confirmedAt:backup.exportedAt};
 const snapshot={...list,disruptions:[event]};
 assert.equal(validateBackup({...backup,version:4,lists:[snapshot]}).lists[0].disruptions[0].original.startDate,'2026-12-01');
 assert.throws(()=>validateBackup({...backup,version:3,lists:[snapshot]}));
 for(const bad of [{...event,source:''},{...event,newDate:'2026-02-30'},{...event,newZone:'No/SuchZone'},{...event,original:null}]) assert.throws(()=>validateBackup({...backup,version:4,lists:[{...list,disruptions:[bad]}]}));
 assert.throws(()=>validateBackup({...backup,version:4,lists:[{...list,disruptions:[event,event]}]}));
});
test('transport plans require v4, validate time and preserve contact data',()=>{
 const plan={id:'t1',mode:'transfer',title:'機場接送',from:'機場',to:'住宿',date:'2026-12-01',time:'18:00',timezone:'Asia/Tokyo',contact:'測試聯絡',note:'',flightId:'flight1'};
 const snapshot={...list,transportPlans:[plan]};
 assert.equal(validateBackup({...backup,version:4,lists:[snapshot]}).lists[0].transportPlans[0].contact,'測試聯絡');
 assert.throws(()=>validateBackup({...backup,version:3,lists:[snapshot]}));
 for(const bad of [{...plan,time:'25:00'},{...plan,date:'2026-02-30'},{...plan,timezone:'No/SuchZone'},{...plan,mode:'unknown'}]) assert.throws(()=>validateBackup({...backup,version:4,lists:[{...list,transportPlans:[bad]}]}));
});
test('protection fields require v5 and survive normalized backup',async()=>{
 const {emptyProtection}=await import(protectionUrl);
 const p={...emptyProtection(),device:'測試機',compatibility:'unsupported',insurer:'測試保險'};
 const snapshot={...list,travelProtection:p};
 assert.throws(()=>validateBackup({...backup,version:4,lists:[snapshot]}));
 assert.equal(validateBackup({...backup,version:5,lists:[snapshot]}).lists[0].travelProtection.insurer,'測試保險');
 assert.throws(()=>validateBackup({...backup,version:5,lists:[{...snapshot,travelProtection:{...p,compatibility:'maybe'}}]}));
});
test('baggage weights and units require v6 and invalid numbers are rejected',()=>{
 const snapshot={...list,luggageWeights:{carryActual:8,carryLimit:7},items:[{id:'s',name:'襪子',category:'衣物',rule:'Flexible_DefaultChecked',quantity:3,unit:'雙'}]};
 assert.throws(()=>validateBackup({...backup,version:5,lists:[snapshot]}));
 assert.equal(validateBackup({...backup,version:6,lists:[snapshot]}).lists[0].items[0].unit,'雙');
 assert.throws(()=>validateBackup({...backup,version:6,lists:[{...snapshot,luggageWeights:{carryActual:-1}}]}));
});

test('expenses require v7, validate money and reject duplicate IDs',()=>{const expense={id:'e1',title:'餐費',amount:'12.50',currency:'JPY',date:'2026-12-01',category:'food',disruptionId:'',receipt:'unknown',note:''};const snapshot={...list,expenses:[expense]};assert.equal(validateBackup({...backup,version:7,lists:[snapshot]}).lists[0].expenses[0].amount,'12.50');assert.throws(()=>validateBackup({...backup,version:6,lists:[snapshot]}));for(const bad of [{...expense,amount:'NaN'},{...expense,amount:'-1'},{...expense,date:'2026-02-30'},{...expense,currency:'NT$'}])assert.throws(()=>validateBackup({...backup,version:7,lists:[{...list,expenses:[bad]}]}));assert.throws(()=>validateBackup({...backup,version:7,lists:[{...list,expenses:[expense,expense]}]}));});

test('return item fields require v8 and reject malformed inputs',()=>{const expense={id:'e1',title:'購物',amount:'12',currency:'JPY',date:'',category:'shopping',disruptionId:'',receipt:'unknown',note:'',returnItem:{destination:'TW',ingredients:'牛肉',origin:'日本',quantity:'2 包',category:'animal'}};const snapshot={...list,expenses:[expense]};const migrated=validateBackup({...backup,version:8,lists:[snapshot]});assert.deepEqual(migrated.lists[0].crossBorderItems,[{...expense.returnItem,id:'legacy:e1',title:'購物',expenseId:'e1',intent:'carry'}]);assert.equal(migrated.lists[0].expenses[0].amount,'12');assert.equal(migrated.lists[0].expenses[0].returnItem,undefined);assert.deepEqual(validateBackup(migrated),migrated);assert.throws(()=>validateBackup({...backup,version:7,lists:[snapshot]}));assert.throws(()=>validateBackup({...backup,version:8,lists:[{...list,expenses:[{...expense,returnItem:{...expense.returnItem,destination:'bad'}}]}]}));});

test('manual rates require v9, reject invalid and duplicate currency pairs',()=>{const rate={base:'JPY',target:'TWD',rate:'0.21',date:'2026-11-13',source:'測試來源'},snapshot={...list,exchangeRates:[rate]};assert.equal(validateBackup({...backup,version:9,lists:[snapshot]}).lists[0].exchangeRates[0].rate,'0.21');assert.throws(()=>validateBackup({...backup,version:8,lists:[snapshot]}));for(const bad of [{...rate,rate:'0'},{...rate,date:'2026-02-30'},{...rate,target:'JPY'},{...rate,source:''}])assert.throws(()=>validateBackup({...backup,version:9,lists:[{...list,exchangeRates:[bad]}]}));assert.throws(()=>validateBackup({...backup,version:9,lists:[{...list,exchangeRates:[rate,rate]}]}));});
test('receipt images require v10 and reject unsupported or oversized data',()=>{const receiptImage='data:image/jpeg;base64,/9j/'+ 'A'.repeat(40);const expense={id:'e1',title:'票',amount:'1',currency:'TWD',date:'',category:'other',disruptionId:'',receipt:'unknown',note:'',receiptImage},snapshot={...list,expenses:[expense]};assert.equal(validateBackup({...backup,version:10,lists:[snapshot]}).lists[0].expenses[0].receiptImage,receiptImage);assert.throws(()=>validateBackup({...backup,version:9,lists:[snapshot]}));for(const bad of ['data:image/svg+xml;base64,AAAA','data:image/jpeg;base64,/9j/!!', 'data:image/jpeg;base64,/9j/'+ 'A'.repeat(700000)])assert.throws(()=>validateBackup({...backup,version:10,lists:[{...list,expenses:[{...expense,receiptImage:bad}]}]}));});


test('cross-border backup validates independent items, links and supported package images',()=>{
 const item={id:'i1',title:'泡麵',intent:'undecided',destination:'TW',category:'unknown',ingredients:'',origin:'',quantity:''};
 const snapshot={...list,crossBorderItems:[item]};
 assert.deepEqual(validateBackup({...backup,version:11,lists:[snapshot]}).lists,[snapshot]);
 assert.throws(()=>validateBackup({...backup,version:10,lists:[snapshot]}));
 for(const items of [[item,item],[{...item,expenseId:'missing'}],[{...item,packageImage:'data:image/svg+xml;base64,AAAA'}]]) {
  assert.throws(()=>validateBackup({...backup,version:11,lists:[{...snapshot,crossBorderItems:items}]}));
 }
});
test('booking references require backup v12 while older documents without one still restore',()=>{
 const doc={id:'d1',kind:'flight',source:'manual',createdAt:'2026-11-09T00:00:00Z',updatedAt:'2026-11-09T00:00:00Z',title:'航空',flightNumber:'',from:'',to:'',startDate:'',startTime:'',startZone:'',endDate:'',endTime:'',endZone:'',address:'',contact:''};
 const old={...list,documents:[doc]};const withRef={...list,documents:[{...doc,reference:'HX7Q2P'}]};
 assert.deepEqual(validateBackup({...backup,version:11,lists:[old]}).lists,[old]);
 assert.equal(validateBackup({...backup,version:11,lists:[old]}).version,12);
 assert.deepEqual(validateBackup({...backup,version:12,lists:[withRef]}).lists,[withRef]);
 assert.throws(()=>validateBackup({...backup,version:11,lists:[withRef]}),/訂位代號/);
 assert.throws(()=>validateBackup({...backup,version:13,lists:[old]}));
});
