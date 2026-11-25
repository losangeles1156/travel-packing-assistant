import type { TripDocument } from './tripDocuments';

export type DisruptionKind = 'delay' | 'cancellation';
export type DisruptionGuidance = { title: string; action: string };

/** A traveller-selected scenario, not a live flight status or an impact calculation. */
export function disruptionGuidance(kind: DisruptionKind, documents: TripDocument[]): DisruptionGuidance[] {
  const lodgingCount = documents.filter(document => document.kind === 'lodging').length;
  return [
    { title: '確認航班安排', action: kind === 'delay' ? '向航空公司確認最新起飛時間、登機資訊及後續安排。' : '向航空公司確認取消狀態、改票或退款方式。' },
    { title: '檢查機場交通', action: '查詢交通業者的最新營運與末班時間，若已預約接送，聯絡服務商確認更改方式。' },
    { title: '確認住宿', action: lodgingCount ? `旅程中有 ${lodgingCount} 筆住宿記錄，請自行確認是否受影響，必要時聯絡住宿方。` : '若有住宿安排，確認入住時間與延遲抵達的聯絡方式。' },
    { title: '保持聯絡', action: '查看上網方案有效期與加購方式，準備可使用的備援聯絡方式。' },
    { title: '保存必要資料', action: '保存航空公司通知、支出與單據；保障範圍與理賠條件請向保險公司確認。' },
  ];
}
