import type { GateId } from './guardian';

export type SourceEntry = { id: string; gate: GateId; label: string; url: string; scope: string; checkedOn: string; reviewDue: string };

// The date records an entrance-page check, not verification of an individual's eligibility.
export const officialSources: readonly SourceEntry[] = [
  { id:'tw-travel-alert', gate:'G1', label:'臺灣外交部旅遊警示', url:'https://www.boca.gov.tw/sp-trwa-list-1.html', scope:'臺灣旅客參考', checkedOn:'2026-11-07', reviewDue:'2027-02-05' },
  { id:'jp-visa', gate:'G1', label:'日本外務省簽證資訊', url:'https://www.mofa.go.jp/j_info/visit/visa/index.html', scope:'前往日本參考', checkedOn:'2026-11-07', reviewDue:'2027-02-05' },
  { id:'tw-customs', gate:'G5', label:'臺灣海關旅客申報須知', url:'https://web.customs.gov.tw/taipei/singlehtml/3130?cntId=cus2_157042_3130', scope:'入境臺灣參考', checkedOn:'2026-11-07', reviewDue:'2027-02-05' },
  { id:'jp-customs', gate:'G5', label:'日本海關旅客通關', url:'https://www.customs.go.jp/english/summary/passenger.htm', scope:'入境日本參考', checkedOn:'2026-11-07', reviewDue:'2027-02-05' },
  { id:'jp-animal', gate:'G5', label:'日本動物檢疫所：動物產品', url:'https://www.maff.go.jp/aqs/english/product/import.html', scope:'入境日本動物產品參考', checkedOn:'2026-11-07', reviewDue:'2027-02-05' },
  { id:'jp-plant', gate:'G5', label:'日本植物防疫所：旅客須知', url:'https://www.maff.go.jp/pps/j/pqaqinfo_en.html', scope:'入境日本植物產品參考', checkedOn:'2026-11-07', reviewDue:'2027-02-05' },
];

export function sourceReviewState(source: SourceEntry, now: Date): 'review_due' | 'entry_checked' | 'unknown' {
  if (!Number.isFinite(now.getTime())) return 'unknown';
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (!day.test(source.checkedOn) || !day.test(source.reviewDue)) return 'unknown';
  const checked = Date.parse(`${source.checkedOn}T00:00:00Z`);
  const due = Date.parse(`${source.reviewDue}T00:00:00Z`);
  if (!Number.isFinite(checked) || !Number.isFinite(due) || new Date(checked).toISOString().slice(0,10) !== source.checkedOn || new Date(due).toISOString().slice(0,10) !== source.reviewDue || due <= checked || now.getTime() < checked) return 'unknown';
  return now.getTime() >= due ? 'review_due' : 'entry_checked';
}
