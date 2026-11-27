export type DocumentKind = 'flight' | 'lodging';
export type TripDocument = {
  id: string; kind: DocumentKind; createdAt: string; updatedAt: string; source: 'manual' | 'pasted';
  title: string; flightNumber: string; from: string; to: string; startDate: string; startTime: string; startZone: string;
  endDate: string; endTime: string; endZone: string; address: string; contact: string;
  /** Added in backup v12; records saved earlier have no reference. */
  reference?: string;
};
export type DocumentFields = Omit<TripDocument, 'id' | 'kind' | 'createdAt' | 'updatedAt' | 'source'>;
export const emptyDocumentFields = (): DocumentFields => ({ title:'', flightNumber:'', from:'', to:'', startDate:'', startTime:'', startZone:'', endDate:'', endTime:'', endZone:'', address:'', contact:'', reference:'' });
const fieldKeys = Object.keys(emptyDocumentFields()) as (keyof DocumentFields)[];
const validField = (key: keyof DocumentFields, value: unknown) => key === 'reference' && value === undefined ? true : typeof value === 'string' && value.length <= 300;
const validDay = (s: string) => !s || (/^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0,10) === s);
const validTime = (s: string) => !s || /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const validZone = (s: string) => { if (!s) return true; try { new Intl.DateTimeFormat('en', {timeZone:s}); return true; } catch { return false; } };
export function documentError(kind: DocumentKind, fields: DocumentFields): string {
  if (fieldKeys.some(k => !validField(k, fields[k]))) return '欄位內容過長或格式不正確。';
  if ((fields.reference ?? '').length > 40) return '訂位代號最多 40 字。';
  if (!fields.title.trim()) return kind === 'flight' ? '請輸入航空公司或航班名稱。' : '請輸入住宿名稱。';
  if (!validDay(fields.startDate) || !validDay(fields.endDate)) return '請確認日期格式。';
  if (!validTime(fields.startTime) || !validTime(fields.endTime)) return '請確認時間格式。';
  if (!validZone(fields.startZone.trim()) || !validZone(fields.endZone.trim())) return '時區格式不正確，請使用例如 Asia/Tokyo。';
  if (kind === 'lodging' && fields.startDate && fields.endDate && fields.endDate < fields.startDate) return '退房日期不能早於入住日期。';
  return '';
}
export function isTripDocument(value: unknown): value is TripDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as TripDocument;
  return typeof v.id === 'string' && v.id.length > 0 && v.id.length <= 200 && (v.kind === 'flight' || v.kind === 'lodging') && (v.source === 'manual' || v.source === 'pasted') && typeof v.createdAt === 'string' && Number.isFinite(Date.parse(v.createdAt)) && typeof v.updatedAt === 'string' && Number.isFinite(Date.parse(v.updatedAt)) && fieldKeys.every(key => validField(key, v[key])) && !documentError(v.kind, v);
}
/** Only explicit labelled lines are copied; no dates, locations or times are guessed. Booking references are never extracted: with a surname they unlock the booking. */
export function parseDocumentText(kind: DocumentKind, text: string): DocumentFields {
  if (text.length > 10000) throw new Error('文字超過 10,000 字，請縮短後再試。');
  const result = emptyDocumentFields();
  const labels: Record<string, keyof DocumentFields> = kind === 'flight'
    ? { '航空公司':'title','航班':'flightNumber','航班號碼':'flightNumber','出發機場':'from','抵達機場':'to','出發日期':'startDate','出發時間':'startTime','出發時區':'startZone','抵達日期':'endDate','抵達時間':'endTime','抵達時區':'endZone' }
    : { '住宿名稱':'title','飯店名稱':'title','住宿地址':'address','入住日期':'startDate','入住時間':'startTime','入住時區':'startZone','退房日期':'endDate','退房時間':'endTime','退房時區':'endZone','聯絡方式':'contact' };
  const seen = new Set<keyof DocumentFields>();
  const conflicts = new Set<keyof DocumentFields>();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([^:：]+)[:：]\s*(.*?)\s*$/);
    const key = match && labels[match[1].trim()];
    if (!key || !match?.[2] || conflicts.has(key)) continue;
    const value = match[2].trim();
    if (value.length > 300 || ((key === 'startDate' || key === 'endDate') && !validDay(value)) || ((key === 'startTime' || key === 'endTime') && !validTime(value)) || ((key === 'startZone' || key === 'endZone') && !validZone(value))) continue;
    if (seen.has(key) && result[key] !== value) { result[key] = ''; conflicts.add(key); continue; }
    result[key] = value; seen.add(key);
  }
  return result;
}
