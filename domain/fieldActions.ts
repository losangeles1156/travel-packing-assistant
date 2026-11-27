import { localInstant } from './travelProtection';
import type { TravelProtection } from './travelProtection';
import type { TripDisruption } from './tripDisruptions';
import type { TransportPlan } from './transportPlan';
import type { TripDocument } from './tripDocuments';

// Several events often refer to the same deadline. Reuse the civil-time conversion.
const instants = new Map<string,number|null>();
function instant(date:string, time:string, zone:string) {
  if (!date || !time || !zone) return null;
  const key = JSON.stringify([date,time,zone]);
  if (!instants.has(key)) {
    if (instants.size >= 256) instants.clear();
    instants.set(key,localInstant(date,time,zone));
  }
  return instants.get(key) ?? null;
}

export function fieldActions(event: TripDisruption, plans: TransportPlan[], documents: TripDocument[], protection?: TravelProtection) {
  const actions: {id:string; title:string; detail:string; evidence:string}[] = [];
  function add(id:string, title:string, detail:string) {
    actions.push({id, title, detail, evidence:JSON.stringify([event.type,event.newDate,event.newTime,event.newZone,title,detail])});
  }
  const departure = event.type === 'cancelled' ? null : instant(event.newDate,event.newTime,event.newZone);
  if (departure === null) {
    add('flight','先向航空公司確認後續航班',event.type === 'cancelled' ? '航班已記錄為取消，請確認替代航班與出發時間。' : '請確認新出發日期、時間與時區。');
  }
  const expiry = protection && instant(protection.expiryDate,protection.expiryTime,protection.expiryZone);
  if (departure !== null && expiry != null && expiry <= departure && protection) {
    add('network','確認上網續用或備援',`方案於 ${protection.expiryDate} ${protection.expiryTime} ${protection.expiryZone} 到期，屆時尚未起飛。客服：${protection.networkContact || '未記錄'}。備援：${protection.backup || '未記錄'}。`);
  }
  for (const plan of plans.filter(plan=>plan.flightId===event.flightId)) {
    add('transport-'+plan.id,'確認'+plan.title,`原安排：${[plan.date,plan.time,plan.timezone].filter(Boolean).join(' ') || '時間待確認'}。請確認是否需要改約。聯絡方式：${plan.contact || '未記錄'}。`);
  }
  if (departure !== null && expiry == null) add('network','查證上網方案到期時間','目前無法比較期限，請核對方案日期、時間與時區。');
  for (const stay of documents.filter(doc=>doc.kind==='lodging')) {
    add('stay-'+stay.id,'核對住宿是否相關',`${stay.title}，入住 ${stay.startDate || '日期待確認'}。若抵達安排受影響，請聯絡 ${stay.contact || '住宿業者'}。`);
  }
  if (!actions.length) add('arrangements','核對新航班的機場交通','尚無關聯的接送紀錄，請查證前往機場的安排。');
  return actions;
}
