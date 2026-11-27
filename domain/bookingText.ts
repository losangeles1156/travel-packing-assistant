import type { DocumentFields, DocumentKind } from './tripDocuments';

export type BookingDraft = { kind: DocumentKind; fields: DocumentFields; missing: string[] };

const MAX_SOURCE = 10000;
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
// Three-letter words that look like airport codes but are currencies, weekdays, months or itinerary jargon.
const NOT_AIRPORT = new Set(('JPY TWD NTD USD KRW THB SGD VND EUR GBP CNY HKD MOP GMT UTC PNR AND THE FOR VIA ETA ETD ARR DEP '
  + 'MON TUE WED THU FRI SAT SUN JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC ADT CHD INF ECO PAX TAX FEE TEL FAX NON REF').split(' '));
const AIRLINES: Record<string, string> = {
  CI: '中華航空', BR: '長榮航空', JX: '星宇航空', IT: '台灣虎航', AE: '華信航空', B7: '立榮航空',
  JL: '日本航空', NH: '全日空', MM: '樂桃航空', GK: '捷星日本', BC: '天馬航空',
  KE: '大韓航空', OZ: '韓亞航空', '7C': '濟州航空', LJ: '真航空', TW: '德威航空',
  SQ: '新加坡航空', TR: '酷航', TG: '泰國航空', FD: '泰國亞洲航空', VZ: '泰越捷航空', VN: '越南航空', VJ: '越捷航空', CX: '國泰航空',
};
const flightWords = /航班|班機|便名|搭乘|FLIGHT|FLT/i;
// A number followed by ":" is a time ("T1 08:50"), not a flight.
const flightNumber = /\b([A-Z][A-Z0-9]|[0-9][A-Z])\s?(\d{2,4})\b(?![:\d])/g;
const NOT_AIRLINE = new Set('NO TO AT OR ON IN IS OF BY UP AM PM ID'.split(' '));
const checkInWords = /入住|CHECK-?IN|チェックイン|체크인/i;
const checkOutWords = /退房|CHECK-?OUT|チェックアウト|체크아웃/i;
const hotelLabel = /^(?:飯店|酒店|旅館|住宿|飯店名稱|住宿名稱|HOTEL|PROPERTY|宿泊施設|施設名|ホテル名|호텔)\s*(?:名稱)?\s*[:：]\s*(.+)$/i;
const addressLabel = /^(?:地址|住所|ADDRESS|주소)\s*[:：]\s*(.*)$/i;
const phoneLabel = /^(?:電話|電話番号|TEL|PHONE|전화)\s*[:：]?\s*(\+?\d[\d\s()-]{5,}\d)/i;

const pad = (n: number) => String(n).padStart(2, '0');
function isoDate(y: number, m: number, d: number) {
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === iso ? iso : null;
}

/** Dates in reading order; only forms that carry a year are accepted. */
export function findDates(text: string): string[] {
  const found: { at: number; iso: string }[] = [];
  const add = (at: number, iso: string | null) => { if (iso && !found.some(f => f.at === at)) found.push({ at, iso }); };
  for (const m of text.matchAll(/(20\d{2})\s?[年/.-]\s?(\d{1,2})\s?[月/.-]\s?(\d{1,2})/g)) add(m.index!, isoDate(+m[1], +m[2], +m[3]));
  for (const m of text.matchAll(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?,?\s+(20\d{2})/gi)) add(m.index!, isoDate(+m[3], MONTHS[m[2].toLowerCase()], +m[1]));
  for (const m of text.matchAll(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(20\d{2})/gi)) add(m.index!, isoDate(+m[3], MONTHS[m[1].toLowerCase()], +m[2]));
  return found.sort((a, b) => a.at - b.at).map(f => f.iso);
}
function findTimes(text: string) {
  return [...text.matchAll(/(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])/g)].map(m => `${pad(+m[1])}:${m[2]}`);
}
function airportsIn(text: string): string[] {
  const inBrackets = [...text.matchAll(/\(([A-Z]{3})\)/g)].map(m => m[1]).filter(code => !NOT_AIRPORT.has(code));
  if (inBrackets.length >= 2) return inBrackets;
  const arrow = text.match(/\b([A-Z]{3})\s*(?:→|->|>|–|—|-|\bto\b)\s*([A-Z]{3})\b/);
  if (arrow && !NOT_AIRPORT.has(arrow[1]) && !NOT_AIRPORT.has(arrow[2])) return [arrow[1], arrow[2]];
  return [...text.matchAll(/\b([A-Z]{3})\b/g)].map(m => m[1]).filter(code => !NOT_AIRPORT.has(code));
}

function parseFlights(lines: string[]): BookingDraft[] {
  const hits = lines.flatMap((line, index) => [...line.matchAll(flightNumber)].filter(m => !NOT_AIRLINE.has(m[1])).map(m => ({ index, code: m[1], number: m[2] })));
  const drafts: BookingDraft[] = [];
  hits.forEach((hit, n) => {
    const nextLine = hits.slice(n + 1).find(other => other.index > hit.index)?.index ?? lines.length;
    // Each flight reads only its own paragraph; the line before is used solely for a date or route header it lacks.
    const ownLines: string[] = [];
    for (let j = hit.index; j < Math.min(nextLine, hit.index + 7) && (j === hit.index || lines[j] !== ''); j++) ownLines.push(lines[j]);
    const own = ownLines.join('\n');
    const before = lines[hit.index - 1] ?? '';
    const ownAirports = airportsIn(own);
    const airports = ownAirports.length >= 2 ? ownAirports : airportsIn(`${before}\n${own}`);
    const dates = findDates(own).length ? findDates(own) : findDates(before);
    if (airports.length < 2 && !flightWords.test(lines[hit.index])) return;
    if (airports.length < 2 && !dates.length) return;
    const flightNo = `${hit.code}${hit.number}`;
    const times = findTimes(own);
    const fields: DocumentFields = {
      title: AIRLINES[hit.code] ?? `${hit.code} 航班`, flightNumber: flightNo, from: airports[0] ?? '', to: airports[1] ?? '',
      startDate: dates[0] ?? '', startTime: times[0] ?? '', startZone: '', endDate: dates[1] ?? '', endTime: times[1] ?? '', endZone: '',
      address: '', contact: '', reference: '',
    };
    if (drafts.some(d => d.fields.flightNumber === flightNo && d.fields.startDate === fields.startDate)) return;
    const missing = [!fields.from || !fields.to ? '起訖機場' : '', !fields.startDate ? '出發日期' : '', !fields.startTime ? '出發時間' : '', !fields.endDate ? '抵達日期' : ''].filter(Boolean);
    drafts.push({ kind: 'flight', fields, missing });
  });
  return drafts;
}

function valueAfter(lines: string[], index: number, pattern: RegExp) {
  const same = lines[index].match(pattern)?.[1]?.trim();
  return same || lines[index + 1]?.trim() || '';
}

function parseStay(lines: string[]): BookingDraft[] {
  let title = '', address = '', contact = '', checkIn = { date: '', time: '' }, checkOut = { date: '', time: '' };
  const fullText = lines.join('\n');
  const named = fullText.match(/(?:booking|reservation|stay)\s+at\s+(.+?)\s+(?:is|has been)\s+confirmed/i)
    ?? fullText.match(/您在\s*(.+?)\s*的(?:預訂|訂單|訂房)/);
  if (named) title = named[1].trim();
  lines.forEach((line, i) => {
    const label = line.match(hotelLabel);
    if (label && !title) title = label[1].trim();
    if (addressLabel.test(line) && !address) address = valueAfter(lines, i, addressLabel);
    const phone = line.match(phoneLabel);
    if (phone && !contact) contact = phone[1].trim();
    for (const [words, slot] of [[checkInWords, checkIn], [checkOutWords, checkOut]] as const) {
      if (!words.test(line) || slot.date) continue;
      const scope = findDates(line).length ? line : `${line}\n${lines[i + 1] ?? ''}`;
      slot.date = findDates(scope)[0] ?? '';
      slot.time = findTimes(scope)[0] ?? '';
    }
  });
  if (!title && !(checkIn.date && checkOut.date)) return [];
  const fields: DocumentFields = {
    title: title.slice(0, 120) || '住宿', flightNumber: '', from: '', to: '', startDate: checkIn.date, startTime: checkIn.time, startZone: '',
    endDate: checkOut.date, endTime: checkOut.time, endZone: '', address: address.slice(0, 300), contact: contact.slice(0, 300), reference: '',
  };
  const missing = [!title ? '住宿名稱' : '', !fields.startDate ? '入住日期' : '', !fields.endDate ? '退房日期' : '', !fields.address ? '地址' : ''].filter(Boolean);
  return [{ kind: 'lodging', fields, missing }];
}

/** Heuristic reading of a shared or pasted booking confirmation. Booking references are deliberately left out. */
export function parseBookingText(source: string): BookingDraft[] {
  if (source.length > MAX_SOURCE) throw new Error('文字超過 10,000 字，請只分享一封確認信。');
  const text = source.replace(/[！-～　]/g, ch => ch.normalize('NFKC'));
  // Blank lines are kept so a flight never reads dates from the hotel paragraph below it.
  const lines = text.split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim());
  return [...parseFlights(lines), ...parseStay(lines.filter(Boolean))];
}
