import { validateExtraction, type ExtractionDraft } from './extractionDraft';

export type MockTransport = (input: { text: string; signal: AbortSignal }) => Promise<unknown>;
export type MockResult = { ok:true; draft:ExtractionDraft } | { ok:false; reason:'cancelled'|'timeout'|'invalid_output'|'unauthorized'|'rate_limited'|'unavailable' };

/** Fixture-only boundary: this module has no network, provider or credential handling. */
export async function runMockAssistant(text:string, transport:MockTransport, options:{ signal?:AbortSignal; timeoutMs?:number } = {}):Promise<MockResult> {
  if (!text.trim() || text.length>10000) return {ok:false,reason:'invalid_output'};
  const timeout = options.timeoutMs ?? 10000;
  if (!Number.isInteger(timeout) || timeout<1 || timeout>30000) return {ok:false,reason:'invalid_output'};
  if (options.signal?.aborted) return {ok:false,reason:'cancelled'};
  const controller=new AbortController();
  let timedOut=false;
  let timer:ReturnType<typeof setTimeout> | undefined;
  let cancel: (()=>void) | undefined;
  const interrupted=new Promise<never>((_,reject)=>{
    cancel=()=>{controller.abort(); reject(new Error('cancelled'));};
    options.signal?.addEventListener('abort',cancel,{once:true});
    timer=setTimeout(()=>{timedOut=true;controller.abort();reject(new Error('timeout'));},timeout);
  });
  try {
    // Fixture transport must be supplied by tests; this module does not make HTTP requests.
    const result=await Promise.race([transport({text,signal:controller.signal}),interrupted]);
    return {ok:true,draft:validateExtraction(result,text)};
  } catch (error) {
    if (timedOut) return {ok:false,reason:'timeout'};
    if (options.signal?.aborted) return {ok:false,reason:'cancelled'};
    const status=typeof error==='object' && error!==null && 'status' in error ? (error as {status:unknown}).status : null;
    if (status===401 || status===403) return {ok:false,reason:'unauthorized'};
    if (status===429) return {ok:false,reason:'rate_limited'};
    if (error instanceof Error && /^草稿|^欄位|^輸入/.test(error.message)) return {ok:false,reason:'invalid_output'};
    return {ok:false,reason:'unavailable'};
  } finally {
    if (timer) clearTimeout(timer);
    if (cancel) options.signal?.removeEventListener('abort',cancel);
  }
}
