import React, { useRef, useState } from 'react';
import type { TripDocument } from '../domain/tripDocuments';
import type { TravelProtection } from '../domain/travelProtection';
import { EMERGENCY_CHECKED_ON, emergencyGuideUrl, findPhone, mofaHotline, officesForTrip, tollFreeHotline, type ConsularOffice } from '../domain/emergencyContacts';

function Contact({ text, label }: { text: string; label: string }) {
  const found = findPhone(text);
  return <p>{text}{found && <> <a className="emergency-call" href={`tel:${found.tel}`} aria-label={`撥打${label} ${found.display}`}>撥打 {found.display}</a></>}</p>;
}

function Office({ item }: { key?: string; item: ConsularOffice }) {
  return <li>
    <strong>{item.name}</strong>
    <small>轄區：{item.area}</small>
    {item.phones.map(p => <a key={p.tel} className="emergency-call" href={`tel:${p.tel}`} aria-label={`撥打${item.name}緊急電話 ${p.display}`}>撥打 {p.display}</a>)}
    {item.note && <small>{item.note}</small>}
  </li>;
}

export default function EmergencyCard({ country, destination, documents, protection, onEdit }: {
  country: string;
  destination: string;
  documents: TripDocument[];
  protection?: TravelProtection;
  onEdit: (area: 'documents' | 'protection') => void;
}) {
  const [driverStay, setDriverStay] = useState<TripDocument | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const byDate = (a: TripDocument, b: TripDocument) => (a.startDate || '9999').localeCompare(b.startDate || '9999');
  const stays = documents.filter(doc => doc.kind === 'lodging').sort(byDate);
  const flights = documents.filter(doc => doc.kind === 'flight').sort(byDate);
  const offices = officesForTrip(country, [destination, ...stays.map(stay => stay.address)].join(' '));
  const tollFree = tollFreeHotline[country as keyof typeof tollFreeHotline];
  const showDriver = (stay: TripDocument) => { setDriverStay(stay); requestAnimationFrame(() => dialogRef.current?.showModal()); };

  return <section className="trip-documents emergency-card" aria-labelledby="emergency-title">
    <div className="trip-documents-heading"><div><h2 id="emergency-title"><i className="fa-solid fa-kit-medical" aria-hidden="true" /> 緊急資訊卡</h2><p>資料存在這台裝置，離線也能查看。遇到狀況時先看這裡。</p></div></div>

    <div className="emergency-block">
      <h3>住宿</h3>
      {stays.length ? <ul>{stays.map(stay => <li key={stay.id}>
        <strong>{stay.title}</strong>
        {stay.startDate && <small>{stay.startDate}{stay.endDate ? ` – ${stay.endDate}` : ''}</small>}
        {stay.address ? <p className="emergency-address">{stay.address}</p> : <p>地址未記錄，建議填當地文字地址，方便給司機看。</p>}
        {stay.contact && <Contact text={stay.contact} label={stay.title} />}
        {stay.address && <button type="button" onClick={() => showDriver(stay)} aria-label={`把「${stay.title}」地址放大給司機看`}>放大給司機看</button>}
      </li>)}</ul> : <p>尚未記錄住宿。<button type="button" className="emergency-link" onClick={() => onEdit('documents')}>新增住宿</button></p>}
    </div>

    <div className="emergency-block">
      <h3>航班</h3>
      {flights.length ? <ul>{flights.map(flight => <li key={flight.id}>
        <strong>{flight.title}{flight.flightNumber ? ` ${flight.flightNumber}` : ''}</strong>
        <small>{[flight.startDate, flight.startTime].filter(Boolean).join(' ') || '時間未記錄'}{(flight.from || flight.to) ? ` · ${flight.from || '出發地未記錄'} → ${flight.to || '抵達地未記錄'}` : ''}</small>
      </li>)}</ul> : <p>尚未記錄航班。<button type="button" className="emergency-link" onClick={() => onEdit('documents')}>新增航班</button></p>}
    </div>

    <div className="emergency-block">
      <h3>旅遊保險</h3>
      {protection?.insurer || protection?.insuranceContact ? <>
        {protection.insurer && <strong>{protection.insurer}</strong>}
        {protection.insuranceContact && <Contact text={protection.insuranceContact} label={protection.insurer || '保險公司'} />}
        {protection.incidentSteps && <p>出事時：{protection.incidentSteps}</p>}
      </> : <p>尚未記錄保險公司與聯絡方式。<button type="button" className="emergency-link" onClick={() => onEdit('protection')}>新增保險資料</button></p>}
    </div>

    <div className="emergency-block">
      <h3>駐外館處緊急電話</h3>
      {offices.primary.length ? <>
        <ul>{offices.primary.map(item => <Office key={item.name} item={item} />)}</ul>
        {offices.others.length > 0 && <details><summary>其他館處（{offices.others.length}）</summary><ul>{offices.others.map(item => <Office key={item.name} item={item} />)}</ul></details>}
        <p className="emergency-note">僅供遭遇急難時撥打，例如護照遺失、重大事故、緊急就醫；一般領務請在上班時間洽辦公室。</p>
      </> : <p>目前只收錄日本、韓國、新加坡、泰國、越南的館處。其他地區請查<a href="https://www.boca.gov.tw/sp-foof-countrylp-02-1.html" target="_blank" rel="noopener noreferrer">外交部駐外館處聯絡資訊</a>。</p>}
    </div>

    <div className="emergency-block">
      <h3>外交部緊急聯絡中心</h3>
      <p>聯絡不到駐外館處時撥打：</p>
      <a className="emergency-call" href={`tel:${mofaHotline.phone.tel}`} aria-label={`撥打外交部旅外國人緊急服務專線 ${mofaHotline.phone.display}`}>撥打 {mofaHotline.phone.display}</a>
      <small>自國外撥打須自付國際電話費。</small>
      {tollFree ? <p>全球免付費專線：{tollFree.numbers.map(n => `${n.dial}${n.label ? `（${n.label}）` : ''}`).join('、')}。{tollFree.condition}</p>
        : country === 'VN' ? <p>越南目前不適用外交部全球免付費專線。</p> : null}
    </div>

    <p className="emergency-note">館處與專線電話依外交部領事事務局公告整理（{EMERGENCY_CHECKED_ON} 查閱），可能異動：<a href={offices.primary[0]?.url ?? mofaHotline.url} target="_blank" rel="noopener noreferrer">館處聯絡資訊</a>、<a href={mofaHotline.url} target="_blank" rel="noopener noreferrer">急難救助專線</a>、<a href={emergencyGuideUrl} target="_blank" rel="noopener noreferrer">海外急難應對方式</a>。</p>

    <dialog ref={dialogRef} className="driver-dialog" aria-labelledby="driver-title" onClose={() => setDriverStay(null)}>
      {driverStay && <>
        <p id="driver-title" className="driver-name">{driverStay.title}</p>
        <p className="driver-address">{driverStay.address}</p>
        <form method="dialog"><button type="submit">關閉</button></form>
      </>}
    </dialog>
  </section>;
}
