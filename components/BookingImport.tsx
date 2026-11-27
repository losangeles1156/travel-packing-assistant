import React, { useEffect, useRef, useState } from 'react';
import { parseBookingText, type BookingDraft } from '../domain/bookingText';
import type { ReceiptRequest } from '../domain/receiptText';

export type ReviewDraft = BookingDraft & { id: string };

const summary = (draft: BookingDraft) => draft.kind === 'flight'
  ? `${draft.fields.title} ${draft.fields.flightNumber}｜${[draft.fields.from, draft.fields.to].filter(Boolean).join(' → ') || '機場未辨識'}｜${draft.fields.startDate || '日期未辨識'} ${draft.fields.startTime}`.trim()
  : `${draft.fields.title}｜${draft.fields.startDate || '入住日未辨識'} → ${draft.fields.endDate || '退房日未辨識'}`;

export default function BookingImport({ seed, onReview, addedDraftId }: { seed?: ReceiptRequest | null; onReview: (draft: ReviewDraft) => void; addedDraftId: string | null }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<ReviewDraft[]>([]);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const panelRef = useRef<HTMLDetailsElement>(null);

  const parse = (source = text) => {
    if (!source.trim()) { setDrafts([]); setMessage({ text: '請先貼上確認信文字。', error: true }); return; }
    try {
      const found = parseBookingText(source).map((draft, index) => ({ ...draft, id: `${Date.now()}-${index}` }));
      setDrafts(found);
      setMessage(found.length
        ? { text: `辨識到 ${found.length} 筆。請逐筆按「檢查後加入」，核對後才會存進旅程。訂位代號不會自動擷取，需要時請自行填寫。` }
        : { text: '沒有辨識到航班或住宿。可以改用下方「＋ 新增航班」或「＋ 新增住宿」手動輸入。', error: true });
    } catch (error) {
      setDrafts([]);
      setMessage({ text: error instanceof Error ? error.message : '無法解析這段文字。', error: true });
    }
  };

  useEffect(() => {
    if (!seed) return;
    setText(seed.text);
    setOpen(true);
    parse(seed.text);
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      panelRef.current?.querySelector('summary')?.focus({ preventScroll: true });
    });
  }, [seed?.id]);

  useEffect(() => {
    if (addedDraftId) setDrafts(previous => previous.filter(draft => draft.id !== addedDraftId));
  }, [addedDraftId]);

  return <details ref={panelRef} className="receipt-text booking-import" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><i className="fa-solid fa-envelope-open-text" aria-hidden="true" /> 匯入訂位確認信</summary>
    <ol className="receipt-steps">
      <li>在 Gmail 或航空公司、訂房 App 打開確認信，長按選取信件文字。</li>
      <li>按「分享」，選「旅程準備」，會自動回到這裡並列出辨識結果。</li>
      <li>沒有「分享」可選時，改按「複製」，再貼到下方。</li>
    </ol>
    <label>確認信文字<textarea value={text} maxLength={10000} rows={6} onChange={event => { setText(event.target.value); setMessage(null); }} /></label>
    <button type="button" onClick={() => parse()}>解析確認信</button>
    <p className="receipt-text-note">文字只在這台裝置解析，不會保存原文。</p>
    {message && <p role={message.error ? 'alert' : 'status'} className={message.error ? 'receipt-text-error' : 'receipt-text-result'}>{message.text}</p>}
    {drafts.length > 0 && <ul className="booking-drafts">{drafts.map(draft => <li key={draft.id}>
      <div><span className="trip-document-type">{draft.kind === 'flight' ? '航班' : '住宿'}</span><strong>{summary(draft)}</strong>
        {draft.missing.length > 0 && <small>未辨識：{draft.missing.join('、')}</small>}</div>
      <button type="button" aria-label={`檢查後加入：${summary(draft)}`} onClick={() => onReview(draft)}>檢查後加入</button>
    </li>)}</ul>}
  </details>;
}
