import React, { useMemo } from 'react';
import { compareExpiry, type TravelProtection } from '../domain/travelProtection';
import type { TripDisruption } from '../domain/tripDisruptions';
import type { TripDocument } from '../domain/tripDocuments';
import type { Expense } from '../domain/expenses';
import type { TransportPlan } from '../domain/transportPlan';

type Area = 'documents' | 'transport' | 'protection' | 'expenses';
export default function DisruptionContext({ event, documents, plans, protection, expenses, onNavigate }: { event: TripDisruption; documents: TripDocument[]; plans: TransportPlan[]; protection?: TravelProtection; expenses: Expense[]; onNavigate: (area: Area) => void }) {
  const linked = plans.filter(plan => plan.flightId === event.flightId);
  const unlinked = plans.filter(plan => !plan.flightId).length;
  const relatedExpenses = expenses.filter(expense => expense.disruptionId === event.id);
  const stays = documents.filter(doc => doc.kind === 'lodging');
  const comparison = useMemo(() => protection ? compareExpiry(
    { date: protection.expiryDate, time: protection.expiryTime, zone: protection.expiryZone },
    { type: event.type, date: event.newDate, time: event.newTime, zone: event.newZone },
  ) : 'unknown', [event, protection]);
  const networkMessage = comparison === 'at_or_before'
    ? '已記錄的上網到期時間不晚於新出發時間；請確認延長與備援。'
    : comparison === 'after' ? '已記錄的上網到期時間晚於新出發時間；抵達時間和實際可用性仍須確認。'
      : '無法比較到期與新出發時間；資料不足或航班取消時，請自行確認。';
  return <div className="disruption-context">
    <p>以下為旅程中記錄的資料，不代表已受影響。請向相關業者確認最新安排。</p>
    <section><h4>機場交通</h4>{linked.length ? linked.map(plan => <p key={plan.id}>你關聯的交通：{plan.title}；聯絡方式：{plan.contact || '未記錄'}。</p>) : <p>這個航班沒有關聯的交通紀錄。</p>}{unlinked > 0 && <p>另有 {unlinked} 筆交通未關聯航班，請自行查看是否相關。</p>}<p>確認交通營運、時間與接送變更方式。</p><button type="button" onClick={() => onNavigate('transport')}>查看交通安排 →</button></section>
    <section><h4>住宿</h4>{stays.length ? stays.map(stay => <p key={stay.id}>{stay.title}；入住日期：{stay.startDate || '未記錄'}；聯絡方式：{stay.contact || '未記錄'}。</p>) : <p>尚未記錄住宿。</p>}<p>請自行確認哪一筆住宿與變動相關，必要時聯絡住宿方。</p><button type="button" onClick={() => onNavigate('documents')}>查看住宿資料 →</button></section>
    <section><h4>行動上網</h4><p>已記錄到期：{protection?.expiryDate || '日期未記錄'} {protection?.expiryTime || '時間未記錄'} {protection?.expiryZone || '時區未記錄'}。</p><p>{networkMessage}</p><p>延長或加購：{protection?.extension || '未記錄'}；備援：{protection?.backup || '未記錄'}。</p><button type="button" onClick={() => onNavigate('protection')}>查看通訊與保險 →</button></section>
    <section><h4>相關支出與單據</h4>{relatedExpenses.length ? relatedExpenses.map(expense => <p key={expense.id}>{expense.title}：{expense.currency} {expense.amount}；單據：{expense.receipt==='kept'?'已保留':expense.receipt==='needed'?'待保留':'未記錄'}。</p>) : <p>尚未關聯支出。</p>}<p>支出關聯不代表符合保險理賠條件。</p><button type="button" onClick={() => onNavigate('expenses')}>查看旅途記帳 →</button></section>
    <section><h4>旅遊保險</h4><p>保險公司：{protection?.insurer || '未記錄'}；聯絡方式：{protection?.insuranceContact || '未記錄'}。</p><p>保存航空公司通知及必要單據，保障與理賠條件請向保險公司確認。</p></section>
  </div>;
}
