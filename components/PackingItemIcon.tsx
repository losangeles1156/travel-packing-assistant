import React from 'react';
import type { ItemCategory } from '../types';

type Illustration = 'power' | 'camera' | 'clothes' | 'toothbrush' | 'umbrella';

/** Decorative only: the item name remains the accessible label and source of truth. */
export default function PackingItemIcon({ id, category }: { id: string; category: ItemCategory }) {
  const illustrations: Record<string, Illustration> = { e1: 'power', e4: 'camera', c1: 'clothes', t2: 'toothbrush', l1: 'umbrella' };
  const illustration = illustrations[id];
  const categoryIcons: Record<string, string> = { '3C產品': 'fa-plug', '衣物': 'fa-shirt', '盥洗物品': 'fa-pump-soap', '生活用品': 'fa-suitcase', '雜項': 'fa-box-open' };
  return <span className="packing-item-art" aria-hidden="true">
    {illustration ? <svg viewBox="0 0 48 48" focusable="false">
      {illustration === 'power' && <><rect x="9" y="12" width="29" height="23" rx="5" fill="#718a77"/><rect x="11" y="28" width="25" height="5" rx="2" fill="#f8f3e7"/><circle cx="15" cy="22" r="1" fill="#f9f5eb"/><circle cx="19" cy="22" r="1" fill="#f9f5eb"/><circle cx="23" cy="22" r="1" fill="#f9f5eb"/><path d="M18 30h9" stroke="#506858" strokeWidth="2" strokeLinecap="round"/></>}
      {illustration === 'camera' && <><path d="M12 15h7l2-4h7l2 4h6a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3V18a3 3 0 0 1 3-3Z" fill="#668176"/><path d="M10 20h28v4H10z" fill="#d5b29b"/><circle cx="24" cy="26" r="8" fill="#f8f3e7"/><circle cx="24" cy="26" r="5.5" fill="#405d56"/><circle cx="22" cy="24" r="1.5" fill="#d7e5da"/></>}
      {illustration === 'clothes' && <><path d="M17 10 11 13 6 20l5 4 3-3v15h20V21l3 3 5-4-5-7-6-3-3 4h-8z" fill="#f8f2e6" stroke="#7e9682" strokeWidth="1.5" strokeLinejoin="round"/><path d="M20 11c0 4 8 4 8 0M14 30h20" stroke="#c7ad91" strokeWidth="1.5" fill="none"/><path d="M15 37h18" stroke="#cfad80" strokeWidth="2.5" strokeLinecap="round"/></>}
      {illustration === 'toothbrush' && <><path d="M9 36 23 13" stroke="#63816f" strokeWidth="5" strokeLinecap="round"/><path d="m20 14 3-5 4 2-3 5" fill="#f6eee0" stroke="#ba9b84" strokeWidth="1"/><path d="M29 12h9l-1 23h-9z" fill="#e0bca6"/><path d="M29 19h8v11h-8z" fill="#789383"/><path d="M31 23h4m-2-2v4" stroke="#fffaf1" strokeWidth="1.5" strokeLinecap="round"/></>}
      {illustration === 'umbrella' && <><path d="M24 10v23c0 6 7 6 7 1" fill="none" stroke="#526e60" strokeWidth="2.5" strokeLinecap="round"/><path d="M9 24c1-10 7-15 15-15s14 5 15 15c-4-3-7-3-10 0-3-3-7-3-10 0-3-3-6-3-10 0Z" fill="#809b85" stroke="#526e60" strokeWidth="1.4" strokeLinejoin="round"/><path d="M24 10c-4 4-5 8-5 14m5-14c4 4 5 8 5 14" fill="none" stroke="#d8e2d3" strokeWidth="1.3"/></>}
    </svg> : <i className={`fa-solid ${categoryIcons[category] || 'fa-suitcase'}`} />}
  </span>;
}
