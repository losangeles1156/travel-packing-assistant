import React, {useState} from 'react';
import {verifiedRegulations,regulationCheckedOn} from '../domain/verifiedRegulations';

export default function RegulationsTab() {
  const [query,setQuery]=useState('');
  const q=query.trim().toLowerCase();
  const results=verifiedRegulations.filter(entry=>!q || [entry.title,entry.summary,...entry.keywords].some(text=>text.toLowerCase().includes(q)));
  return <div className="max-w-2xl mx-auto pb-24"><div className="mb-6"><h2 className="text-2xl font-bold">法規查詢</h2><p className="text-sm mt-2">官方來源核對：{regulationCheckedOn}。資料不是即時更新；出發機場、航線、入境地及物品規格會影響適用條件。</p></div>
    <label className="block font-bold">搜尋物品<input className="block w-full border rounded-lg p-3 mt-2" value={query} onChange={e=>setQuery(e.target.value)} placeholder="例如：行動電源、剪刀、藥品" /></label>
    <p className="text-sm mt-3">目前僅整理指定台灣與日本官方來源；其他地區請查當地主管機關與航空公司。沒有搜尋結果不代表可攜帶。</p>
    <div className="space-y-4 mt-5">{results.length?results.map(entry=><article key={entry.id} className="bg-white p-5 rounded-xl border border-slate-200"><h3 className="font-bold text-lg">{entry.title}</h3><p className="text-xs text-slate-600 mt-1">適用：{entry.scope}</p><p className="text-sm mt-3 leading-relaxed">{entry.summary}</p><div className="mt-3 flex flex-wrap gap-3">{entry.sources.map(source=><a className="text-blue-700 underline text-sm" key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a>)}</div></article>):<p>未找到相符資料，請向出發機場、航空公司及入境地主管機關查詢。</p>}</div>
  </div>;
}
