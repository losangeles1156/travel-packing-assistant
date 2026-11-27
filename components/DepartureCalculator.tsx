import React, { useState } from 'react';
import { calculateDepartureReference } from '../domain/departure';

export default function DepartureCalculator({values,onChange}:{values:Record<string,string>;onChange:(values:Record<string,string>)=>void}) {
  const [result,setResult]=useState('');
  const [error,setError]=useState('');
  const [confirmed,setConfirmed]=useState(false);
  const fields=[
    {key:'calcDate',label:'航班當地日期',type:'date'}, {key:'calcTime',label:'航班當地時間',type:'time'},
    {key:'calcFlightZone',label:'航班時區（例如 Asia/Tokyo）',type:'text'}, {key:'calcDepartureZone',label:'出發地時區（例如 Asia/Taipei）',type:'text'},
    {key:'calcTravel',label:'預估交通時間（分鐘）',type:'number'}, {key:'calcBuffer',label:'抵達機場到起飛預留時間（分鐘）',type:'number'},
  ];
  const calculate=()=>{
    try {
      if (!confirmed) throw new Error('請先確認交通與航班資料已自行查證。');
      if (!values.calcTravel?.trim() || !values.calcBuffer?.trim()) throw new Error('請明確填寫交通及預留分鐘數。');
      const reference=calculateDepartureReference({flightDate:values.calcDate ?? '',flightTime:values.calcTime ?? '',flightZone:values.calcFlightZone ?? '',departureZone:values.calcDepartureZone ?? '',travelMinutes:Number(values.calcTravel),bufferMinutes:Number(values.calcBuffer)});
      setResult(`${reference.leaveLocal}（${reference.departureZone}）${Number(values.calcBuffer) === 0 ? '；你填寫的預留時間為 0 分鐘，請確認是否足夠' : ''}`);setError('');
    } catch(e) {setResult('');setError(e instanceof Error ? e.message : '無法計算，請確認輸入。');}
  };
  return <details className="border rounded p-3"><summary className="cursor-pointer font-bold">試算參考出發時間</summary><p className="mt-2">依你填的交通時間與預留時間倒推，不包含即時交通、路線查詢或航空公司報到規定，不能保證趕上航班。</p><div className="grid gap-2 sm:grid-cols-2 mt-2">{fields.map(field=><label key={field.key}>{field.label}<input className="block border rounded p-2 w-full" type={field.type} value={values[field.key] ?? ''} onChange={e=>{onChange({...values,[field.key]:e.target.value});setConfirmed(false);setResult('');setError('')}} /></label>)}</div><label className="block mt-2"><input type="checkbox" checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);setResult('')}} /> 我已自行查證所填的航班與交通資料，了解狀況仍可能改變</label><button type="button" className="border rounded p-2 mt-2" onClick={calculate}>計算參考時間</button>{result && <p role="status" className="mt-2">參考出發時間：{result}。請自行確認交通與航班資訊。</p>}{error && <p role="alert" className="mt-2 text-red-700">{error}</p>}</details>;
}
