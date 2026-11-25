import type { InputMap } from './guardian';

export type Compatibility = 'unknown' | 'supported' | 'unsupported';
export type ConnectivityFinding = { compatibility: Compatibility; state: 'missing' | 'needs_review'; actions: string[] };

/** Only explicit user choices are classified; arbitrary text never establishes compatibility. */
export function evaluateConnectivity(inputs: InputMap): ConnectivityFinding {
  const confirmed = (key: string) => { const input = inputs[key]; return input?.source === 'user' && Number.isFinite(Date.parse(input.confirmedAt)) ? String(input.value).trim() : ''; };
  const device = confirmed('device');
  const raw = confirmed('compatibility');
  const plan = confirmed('connectionPlan');
  const timing = confirmed('activationTiming');
  const purchase = confirmed('purchaseStatus');
  const compatibility: Compatibility = raw === '支援' ? 'supported' : raw === '不支援' ? 'unsupported' : 'unknown';
  const actions: string[] = [];
  if (!device) actions.push('先記錄裝置型號，並確認裝置版本與電信鎖定狀態。');
  if (compatibility === 'unknown') actions.push('向裝置製造商或電信商確認 eSIM 相容性；在確認前先保留其他連線方式。');
  if (compatibility === 'unsupported') actions.push('暫不使用 eSIM；可查詢實體 SIM、漫遊、分享器或 Wi-Fi 的適用條件。');
  if (compatibility === 'supported') actions.push('再確認方案服務範圍、流量限制及啟用條件，並準備離線備案。');
  if (!plan) actions.push('記錄選用的網路方式、啟用條件及備案。');
  else actions.push('依供應商說明再次確認方案的計時方式與啟用步驟。');
  if (purchase === '已購買') actions.push('保留訂購資訊與客服聯絡方式，確認已購方案是否適用行程。');
  if (timing === '安裝後') actions.push('已記錄安裝後開始計時；安裝前請再次核對供應商說明。');
  else if (timing === '抵達連線後') actions.push('已記錄抵達連線後開始計時；請確認目的地及實際連線條件。');
  else if (timing === '指定日期') actions.push('已記錄依指定日期計時；請確認日期、時區與啟用方式。');
  else actions.push('尚未記錄或確認計時起點；請查明安裝、抵達連線或指定日期何時開始。');
  return {compatibility,state:!device || compatibility === 'unknown' || !plan ? 'missing':'needs_review',actions};
}
