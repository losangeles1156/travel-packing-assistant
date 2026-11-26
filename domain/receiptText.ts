export type ReceiptItem = { name: string; amount: string };
export type ReceiptDraft = { store?: string; date?: string; currency?: string; total?: string; items: ReceiptItem[]; missing: ('store' | 'date' | 'currency' | 'total')[] };
export type ReceiptForm = { title: string; amount: string; currency: string; date: string; note: string; category: string };

const MAX_SOURCE = 10000;
const NOTE_LIMIT = 500;

// "\" stands in for ¥ in many Japanese receipt fonts, so OCR often returns it.
const money = String.raw`(?:(¥|\\|NT\$|S\$|\$|₩|฿|₫)\s?)?(-?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|-?\d+(?:[.,]\d{1,2})?)\s?(円|원|บาท|đ|₫|VND|SGD|THB|KRW|JPY)?`;
const taxMarks = String.raw`(?:\s?(?:※|\*|軽|内|外|税|\(?\d{1,2}%\)?))*`;
const priceAtEnd = new RegExp(`^(.*?)[\\s:：]*${money}${taxMarks}\\s*$`);
const moneyOnly = new RegExp(`^${money}${taxMarks}$`);

const totalWords = /合計|総計|お買上|ご請求|TOTAL|Amount Due|합계|총액|결제\s?금액|ยอดรวม|รวมทั้งสิ้น|Tổng cộng|Tổng tiền|Thành tiền/i;
const notTotal = /小計|SUB\s?TOTAL|消費税|内税|外税|対象|点数|個数|お預|預り|釣|CHANGE|Tendered|부가세|거스름|ทอน|VAT|GST/i;
const notItem = /小計|合計|総計|お買上|ご請求|税|対象|お預|預り|釣|つり|現金|クレジット|ポイント|割引|値引|TEL|電話|〒|レジ|担当|点数|TOTAL|CHANGE|CASH|VISA|MASTER|합계|부가세|거스름|받은|ยอด|รวม|ภาษี|ทอน|เงินสด|Tổng|Tiền|VAT|GST|SERVICE/i;
const quantityLine = /[@＠単]|[x×]\s?\d|\d\s?[x×]/i;
const notStore = /領収|レシート|RECEIPT|いらっしゃいませ|ありがとう|WELCOME|영수증|ใบเสร็จ|HÓA ĐƠN/i;
const timeOrDate = /\d{1,2}:\d{2}|(?:19|20|25)\d{2}\s?[年/.-]|令和/;

const currencyHints: [RegExp, string][] = [
  [/NT\$|TWD|新臺幣|新台幣/, 'TWD'], [/S\$|SGD/, 'SGD'], [/₩|원|KRW/, 'KRW'], [/฿|บาท|THB/, 'THB'],
  [/₫|VND|\dđ\b|\d\s?đ/, 'VND'], [/円|¥|JPY|\\\d/, 'JPY'],
];

function normalizeAmount(raw: string) {
  const negative = raw.startsWith('-');
  const digits = raw.replace(/^-/, '');
  const decimal = digits.match(/[.,](\d{1,2})$/);
  const whole = (decimal ? digits.slice(0, decimal.index) : digits).replace(/[.,]/g, '');
  if (negative || !/^\d{1,10}$/.test(whole)) return null;
  const value = decimal && Number(decimal[1]) ? `${Number(whole)}.${decimal[1]}` : String(Number(whole));
  return value;
}

function validDay(y: number, m: number, d: number) {
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === iso ? iso : null;
}

function findDate(text: string) {
  const reiwa = text.match(/令和\s?(\d{1,2}|元)\s?年\s?(\d{1,2})\s?月\s?(\d{1,2})\s?日/);
  if (reiwa) return validDay(2018 + (reiwa[1] === '元' ? 1 : Number(reiwa[1])), Number(reiwa[2]), Number(reiwa[3]));
  const ymd = text.match(/((?:20|25)\d{2})\s?[年/.-]\s?(\d{1,2})\s?[月/.-]\s?(\d{1,2})/);
  if (ymd) { const y = Number(ymd[1]); return validDay(y > 2400 ? y - 543 : y, Number(ymd[2]), Number(ymd[3])); }
  // Day-first is the norm in Singapore, Thailand and Vietnam.
  const dmy = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-]((?:20|25)\d{2})\b/);
  if (dmy) { const y = Number(dmy[3]); return validDay(y > 2400 ? y - 543 : y, Number(dmy[2]), Number(dmy[1])); }
  return null;
}

/** Heuristic parse of OCR text copied from a receipt. Nothing here is authoritative; the user confirms every field. */
export function parseReceiptText(source: string): ReceiptDraft {
  if (source.length > MAX_SOURCE) throw new Error('收據文字超過 10,000 字，請只貼上一張收據。');
  // Only fold full-width forms; NFKC on the whole text would split Thai vowels such as ำ.
  const text = source.replace(/[！-～￥　]/g, ch => ch.normalize('NFKC'));
  const lines = text.split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const priceOf = (line: string) => { const m = line.match(priceAtEnd); return m ? { label: m[1].trim(), amount: normalizeAmount(m[3]) } : null; };

  let total: string | undefined, totalIndex = -1;
  for (let i = 0; i < lines.length && total === undefined; i++) {
    if (!totalWords.test(lines[i]) || notTotal.test(lines[i])) continue;
    const sameLine = priceOf(lines[i]);
    const nextLine = lines[i + 1]?.match(moneyOnly) ? normalizeAmount(lines[i + 1].match(moneyOnly)![2]) : null;
    const amount = sameLine?.amount ?? nextLine;
    if (amount && Number(amount) > 0) { total = amount; totalIndex = i; }
  }

  const items: ReceiptItem[] = [];
  for (const line of totalIndex >= 0 ? lines.slice(0, totalIndex) : lines) {
    if (notItem.test(line) || quantityLine.test(line) || timeOrDate.test(line)) continue;
    const price = priceOf(line);
    const name = price?.label.replace(/^\d{4,}\s*/, '').replace(/[\s.:：-]+$/, '').trim();
    if (!price?.amount || Number(price.amount) <= 0 || !name || !/\p{L}/u.test(name)) continue;
    items.push({ name, amount: price.amount });
  }

  const store = lines.slice(0, 5).find(line => line.length >= 2 && line.length <= 40 && /\p{L}/u.test(line) && !notStore.test(line) && !timeOrDate.test(line) && !totalWords.test(line) && !priceOf(line)?.amount && !/TEL|電話|〒/i.test(line));
  const currency = currencyHints.find(([pattern]) => pattern.test(text))?.[1];
  const date = findDate(text) ?? undefined;
  const missing = (['store', 'date', 'currency', 'total'] as const).filter(key => !({ store, date, currency, total })[key]);
  return { store, date, currency, total, items, missing };
}

/** Fills only fields the user left empty; anything already typed is kept and reported. */
export function applyReceiptDraft(form: ReceiptForm, draft: ReceiptDraft) {
  const next = { ...form };
  const filled: string[] = [], kept: string[] = [];
  const fill = (key: 'title' | 'amount' | 'date', value: string | undefined, label: string) => {
    if (!value) return;
    if (!form[key].trim()) { next[key] = value; filled.push(label); }
    else if (form[key].trim() !== value) kept.push(label);
  };
  fill('title', draft.store, '名稱');
  fill('amount', draft.total, '金額');
  fill('date', draft.date, '日期');
  if (draft.currency) {
    if (!form.amount.trim() || form.currency === draft.currency) { if (form.currency !== draft.currency) filled.push('幣別'); next.currency = draft.currency; }
    else kept.push('幣別');
  }
  if (draft.items.length) {
    if (form.category === 'other') next.category = 'shopping';
    const names = draft.items.map(item => item.name);
    const room = NOTE_LIMIT - form.note.trim().length - (form.note.trim() ? 1 : 0) - '品項：'.length;
    let listed = names.join('、');
    if (listed.length > room) {
      const shown: string[] = [];
      for (const name of names) { const candidate = [...shown, name].join('、') + `…等 ${names.length} 項`; if (candidate.length > room) break; shown.push(name); }
      listed = shown.length ? shown.join('、') + `…等 ${names.length} 項` : '';
    }
    if (listed && !form.note.includes(listed)) { next.note = [form.note.trim(), `品項：${listed}`].filter(Boolean).join('\n'); filled.push('品項'); }
  }
  return { next, filled, kept };
}
