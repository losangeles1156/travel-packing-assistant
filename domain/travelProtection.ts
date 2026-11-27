export type TravelProtection = {
  device:string; compatibility:'unknown'|'supported'|'unsupported'; need:string; method:'unknown'|'esim'|'sim'|'roaming'|'wifi'|'other';
  region:string; dataAllowance:string; activation:'unknown'|'installation'|'first_connection'|'fixed_date'|'other';
  expiryDate:string; expiryTime:string; expiryZone:string; extension:string; networkContact:string; backup:string;
  insurer:string; policyStart:string; policyEnd:string; insuranceContact:string; policyNotes:string; incidentSteps:string;
};
export const emptyProtection = ():TravelProtection => ({device:'',compatibility:'unknown',need:'',method:'unknown',region:'',dataAllowance:'',activation:'unknown',expiryDate:'',expiryTime:'',expiryZone:'',extension:'',networkContact:'',backup:'',insurer:'',policyStart:'',policyEnd:'',insuranceContact:'',policyNotes:'',incidentSteps:''});
const day=(s:string)=>!s||(/^\d{4}-\d\d-\d\d$/.test(s)&&Number.isFinite(Date.parse(`${s}T00:00:00Z`))&&new Date(`${s}T00:00:00Z`).toISOString().slice(0,10)===s);
const time=(s:string)=>!s||/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const zone=(s:string)=>{if(!s)return true;try{new Intl.DateTimeFormat('en',{timeZone:s});return true;}catch{return false;}};
export function isTravelProtection(value:unknown):value is TravelProtection {
  if(!value||typeof value!=='object'||Array.isArray(value)) return false;
  const v=value as TravelProtection;
  if(!Object.keys(emptyProtection()).every(key=>typeof (v as unknown as Record<string,unknown>)[key]==='string' && ((v as unknown as Record<string,string>)[key].length<=1000)))return false;
  return ['unknown','supported','unsupported'].includes(v.compatibility)&&['unknown','esim','sim','roaming','wifi','other'].includes(v.method)&&['unknown','installation','first_connection','fixed_date','other'].includes(v.activation)&&day(v.expiryDate)&&time(v.expiryTime)&&zone(v.expiryZone)&&day(v.policyStart)&&day(v.policyEnd)&&(!v.policyStart||!v.policyEnd||v.policyStart<=v.policyEnd);
}

/** Returns null for incomplete, nonexistent, or ambiguous local civil time. */
export function localInstant(date:string,clock:string,tz:string):number|null {
  if(!date||!clock||!tz||!day(date)||!time(clock)||!zone(tz))return null;
  const [y,m,d]=date.split('-').map(Number), [h,min]=clock.split(':').map(Number);
  const base=Date.UTC(y,m-1,d,h,min), matches:number[]=[];
  const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  for(let delta=-14*60;delta<=14*60;delta++){
    const candidate=base+delta*60000; const parts=fmt.formatToParts(new Date(candidate)); const get=(type:string)=>parts.find(p=>p.type===type)?.value??'';
    if(`${get('year')}-${get('month')}-${get('day')}`===date && `${get('hour')}:${get('minute')}`===clock)matches.push(candidate);
  }
  return matches.length===1?matches[0]:null;
}
export function compareExpiry(expiry:{date:string;time:string;zone:string},event:{type:string;date:string;time:string;zone:string}):'unknown'|'at_or_before'|'after' {
  if(event.type==='cancelled')return 'unknown';
  const a=localInstant(expiry.date,expiry.time,expiry.zone),b=localInstant(event.date,event.time,event.zone);
  if(a===null||b===null)return 'unknown';
  return a<=b?'at_or_before':'after';
}
