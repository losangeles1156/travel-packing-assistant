export type EmergencyCountry = 'JP' | 'KR' | 'SG' | 'VN' | 'TH';
export type Phone = { display: string; tel: string };
export type ConsularOffice = { country: EmergencyCountry; name: string; area: string; places: string[]; phones: Phone[]; note?: string; url: string };

const phone = (display: string): Phone => ({ display, tel: '+' + display.replace(/\D/g, '') });
const office = (path: string) => `https://www.boca.gov.tw/${path}.html`;

// 外交部領事事務局「駐館位置及聯絡資訊」各館處頁面的緊急聯絡電話與領務轄區，2026-11-25 查閱。
export const EMERGENCY_CHECKED_ON = '2026-11-25';
export const consularOffices: readonly ConsularOffice[] = [
  { country:'JP', name:'台北駐日經濟文化代表處（東京）', area:'東京都、青森、岩手、宮城、秋田、福島、茨城、栃木、群馬、埼玉、千葉、新潟、山形、山梨、長野', places:['東京','青森','岩手','宮城','仙台','秋田','福島','茨城','栃木','日光','群馬','埼玉','千葉','新潟','山形','山梨','長野','輕井澤','軽井沢'], phones:[phone('+81-80-1009-7179'),phone('+81-80-1009-7436')], url:office('sp-foof-countrycp-02-29-77969-1') },
  { country:'JP', name:'台北駐日經濟文化代表處橫濱分處', area:'神奈川、靜岡', places:['神奈川','橫濱','横浜','鎌倉','箱根','靜岡','静岡'], phones:[phone('+81-90-3211-7576')], url:office('sp-foof-countrycp-02-30-147e1-1') },
  { country:'JP', name:'台北駐大阪經濟文化辦事處', area:'京都、大阪、兵庫、滋賀、奈良、和歌山、鳥取、島根、岡山、廣島、德島、香川、愛媛、高知、富山、石川、福井、岐阜、愛知、三重', places:['京都','大阪','兵庫','神戶','神戸','滋賀','奈良','和歌山','鳥取','島根','岡山','廣島','広島','德島','徳島','香川','愛媛','高知','富山','石川','金澤','金沢','福井','岐阜','愛知','名古屋','三重'], phones:[phone('+81-90-8794-4568')], url:office('sp-foof-countrycp-02-32-cb309-1') },
  { country:'JP', name:'台北駐大阪經濟文化辦事處福岡分處', area:'福岡、熊本、大分、宮崎、鹿兒島、長崎、佐賀、山口', places:['福岡','博多','北九州','熊本','大分','別府','由布院','湯布院','宮崎','鹿兒島','鹿児島','長崎','佐賀','山口'], phones:[phone('+81-90-1922-9740')], url:office('sp-foof-countrycp-02-31-92761-1') },
  { country:'JP', name:'台北駐日經濟文化代表處那霸分處', area:'沖繩', places:['沖繩','沖縄','那霸','那覇','石垣','宮古'], phones:[phone('+81-80-8056-0122')], url:office('sp-foof-countrycp-02-33-90862-1') },
  { country:'JP', name:'台北駐日經濟文化代表處札幌分處', area:'北海道', places:['北海道','札幌','函館','小樽','旭川','富良野','二世谷'], phones:[phone('+81-80-1460-2568')], url:office('sp-foof-countrycp-02-34-060b2-1') },
  { country:'KR', name:'駐韓國台北代表部（首爾）', area:'首爾、仁川、大田、世宗、京畿道、江原道、忠清北道、忠清南道、全羅北道', places:['首爾','서울','仁川','인천','大田','世宗','京畿','水原','江原','江陵','春川','忠清','全州'], phones:[phone('+82-10-9080-2761')], url:office('sp-foof-countrycp-02-1-6256a-1') },
  { country:'KR', name:'駐韓國台北代表部釜山辦事處', area:'釜山、大邱、蔚山、全南光州、慶尚南道、慶尚北道、濟州', places:['釜山','부산','大邱','대구','蔚山','光州','慶尚','慶州','濟州','済州','제주'], phones:[phone('+82-10-4537-7961')], note:'只限中文', url:office('sp-foof-countrycp-02-2-aff61-1') },
  { country:'SG', name:'駐新加坡台北代表處', area:'新加坡全境', places:['新加坡'], phones:[phone('+65-9638-9436')], note:'可用 WhatsApp 撥打', url:office('sp-foof-countrycp-02-10-fa952-1') },
  { country:'TH', name:'駐泰國台北經濟文化辦事處', area:'泰國全境', places:['泰國'], phones:[phone('+66-81-666-4006')], url:office('sp-foof-countrycp-02-24-dec45-1') },
  { country:'VN', name:'駐越南台北經濟文化辦事處（河內）', area:'越南北部（順化以北）', places:['河內','河内','下龍','海防','沙壩','寧平'], phones:[phone('+84-913-219-986')], url:office('sp-foof-countrycp-02-8-f4a19-1') },
  { country:'VN', name:'駐胡志明市台北經濟文化辦事處', area:'越南南部（峴港以南）', places:['胡志明','西貢','會安','芽莊','大叻','富國','頭頓'], phones:[phone('+84-903-927-019')], url:office('sp-foof-countrycp-02-9-6b662-1') },
];

// 外交部領事事務局「旅外國人急難救助服務專線」，2026-11-25 查閱。
export const mofaHotline = { phone: phone('+886-800-085-095'), url: 'https://www.boca.gov.tw/cp-87-2121-7a5da-1.html' };
export const tollFreeHotline: Partial<Record<EmergencyCountry, { numbers: { label: string; dial: string }[]; condition: string }>> = {
  JP: { numbers: [{ label:'KDDI', dial:'001-010-800-0885-0885' }, { label:'SoftBank', dial:'0061-010-800-0885-0885' }], condition:'當地申請的手機或市內電話可免費撥打；公用電話無法撥接。' },
  KR: { numbers: [{ label:'', dial:'001-800-0885-0885' }], condition:'當地 KT、SKT、LGU 手機可免費撥打。' },
  SG: { numbers: [{ label:'', dial:'001-800-0885-0885' }], condition:'限 SingTel 市話或已向 SingTel 註冊的手機門號。' },
  TH: { numbers: [{ label:'', dial:'001-800-0885-0885' }], condition:'當地 AIS、DTAC、True Move 手機及市內電話可免費撥打。' },
};
// 外交部領事事務局「在海外遭遇急難的應對方式」，2026-11-25 查閱。
export const emergencyGuideUrl = 'https://www.boca.gov.tw/cp-278-4447-9c49d-1.html';

/** Offices whose jurisdiction names appear in the trip text come first; with no match, every office in the country is relevant. */
export function officesForTrip(country: string, tripText: string) {
  const inCountry = consularOffices.filter(item => item.country === country);
  const matched = inCountry.filter(item => item.places.some(place => tripText.includes(place)));
  return matched.length ? { primary: matched, others: inCountry.filter(item => !matched.includes(item)) } : { primary: inCountry, others: [] };
}

const phonePattern = /\+?\d[\d\s()-]{5,}\d/;
/** Finds a dialable number inside free text such as "+81-3-1234-5678（24 小時）". */
export function findPhone(text: string): Phone | null {
  const match = text.match(phonePattern)?.[0];
  if (!match) return null;
  const digits = match.replace(/\D/g, '');
  return digits.length >= 7 ? { display: match.trim(), tel: (match.trim().startsWith('+') ? '+' : '') + digits } : null;
}
