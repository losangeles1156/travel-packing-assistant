import React, { useState } from 'react';
import { applyReceiptDraft, parseReceiptText, type ReceiptForm } from '../domain/receiptText';

const missingLabels = { store: '店名', date: '日期', currency: '幣別', total: '合計金額' } as const;

export default function ReceiptTextImport({ form, onApply }: { key?: string; form: ReceiptForm; onApply: (next: ReceiptForm) => void }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<{ lines: string[]; error?: boolean } | null>(null);

  const apply = () => {
    if (!text.trim()) { setResult({ lines: ['請先貼上收據文字。'], error: true }); return; }
    try {
      const draft = parseReceiptText(text);
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

  return <details className="receipt-text">
    <summary>貼上收據文字，自動填入</summary>
    <p>先用手機內建的文字辨識（例如 Google 智慧鏡頭的「選取文字」）複製收據文字，再貼到這裡。文字只在這台裝置解析，不會上傳，也不會保存原文。</p>
    <label>收據文字<textarea value={text} maxLength={10000} rows={6} onChange={event => { setText(event.target.value); setResult(null); }} /></label>
    <button type="button" onClick={apply}>解析並填入</button>
    {result && <div role={result.error ? 'alert' : 'status'} className={result.error ? 'receipt-text-error' : 'receipt-text-result'}>{result.lines.map(line => <p key={line}>{line}</p>)}</div>}
  </details>;
}
