import React, { useEffect, useRef, useState } from 'react';
import { applyReceiptDraft, parseReceiptText, type ReceiptForm, type ReceiptRequest } from '../domain/receiptText';

const missingLabels = { store: '店名', date: '日期', currency: '幣別', total: '合計金額' } as const;

export default function ReceiptTextImport({ form, onApply, seed }: { key?: string; form: ReceiptForm; onApply: (next: ReceiptForm) => void; seed?: ReceiptRequest | null }) {
  const [text, setText] = useState(seed?.text ?? '');
  const [expanded, setExpanded] = useState(!!seed);
  const [result, setResult] = useState<{ lines: string[]; error?: boolean } | null>(null);
  const panelRef = useRef<HTMLDetailsElement>(null);

  const apply = (source = text) => {
    if (!source.trim()) { setResult({ lines: ['請先貼上收據文字。'], error: true }); return; }
    try {
      const draft = parseReceiptText(source);
      if (!draft.total && !draft.items.length && !draft.date && !draft.store) {
        setResult({ lines: ['沒有辨識到可用的內容，請確認貼上的是收據文字。'], error: true });
        return;
      }
      const { next, filled, kept } = applyReceiptDraft(form, draft);
      onApply(next);
      setResult({ lines: [
        filled.length ? `已填入：${filled.join('、')}${draft.items.length ? `（辨識到 ${draft.items.length} 個品項）` : ''}。` : '沒有需要填入的空白欄位。',
        ...(kept.length ? [`保留你已填的：${kept.join('、')}。`] : []),
        ...(draft.missing.length ? [`沒有辨識到：${draft.missing.map(key => missingLabels[key]).join('、')}，請手動填寫。`] : []),
        '請核對下方欄位後，再按「儲存支出」。',
      ] });
    } catch (error) {
      setResult({ lines: [error instanceof Error ? error.message : '無法解析這段文字。'], error: true });
    }
  };

  useEffect(() => {
    if (!seed) return;
    if (seed.text) apply(seed.text);
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      panelRef.current?.querySelector('summary')?.focus({ preventScroll: true });
    });
  }, []);

  return <details ref={panelRef} className="receipt-text" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary><i className="fa-solid fa-camera" aria-hidden="true" /> 拍收據記帳</summary>
    <ol className="receipt-steps">
      <li>打開 Google 智慧鏡頭或相機的文字辨識，對準收據拍照。</li>
      <li>選取文字後按「分享」，選「旅程準備」，會自動回到這裡並填好。</li>
      <li>沒有「分享」可選時，改按「複製」，再貼到下方。</li>
    </ol>
    <label>收據文字<textarea value={text} maxLength={10000} rows={6} onChange={event => { setText(event.target.value); setResult(null); }} /></label>
    <button type="button" onClick={() => apply()}>解析並填入</button>
    <p className="receipt-text-note">文字只在這台裝置解析，不會保存原文。</p>
    {result && <div role={result.error ? 'alert' : 'status'} className={result.error ? 'receipt-text-error' : 'receipt-text-result'}>{result.lines.map(line => <p key={line}>{line}</p>)}</div>}
  </details>;
}
