/** Local, deterministic task assessment; never a statement of legal compliance. */
export type GateId = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'snoozed' | 'skipped';
export type EvidenceState = 'confirmed_by_user' | 'needs_review' | 'missing' | 'conflict' | 'review_due';
export type Applicability = 'applicable' | 'not_applicable' | 'unknown';
export type ConfirmedInput = { value: string | boolean | number; confirmedAt: string; source: 'user' };
export type InputMap = Record<string, ConfirmedInput | undefined>;
export type GateRule = { id: string; gate: GateId; required: string[]; watch?: string[]; impact: string; next: string; version: string; sourceRefs: string[]; reviewDue?: string };
export type Finding = { ruleId: string; gate: GateId; severity: 'attention'; evidenceState: EvidenceState; applicability: Applicability; missingFields: string[]; sourceRefs: string[]; impact: string; actions: string[]; ruleVersion: string; calculatedAt: string };

export const initialRules: GateRule[] = [
  {id:'documents-check',gate:'G1',required:['nationality','destination','transit'],impact:'證件與轉機條件需依個人情況確認。',next:'查閱主管機關與航空公司資訊，記錄尚待確認事項。',version:'1',sourceRefs:['tw-travel-alert','jp-visa']},
  {id:'connectivity-check',gate:'G2',required:['device','compatibility','connectionPlan'],watch:['networkNeed','purchaseStatus','activationTiming'],impact:'裝置相容性及方案啟用條件可能影響連線。',next:'向裝置與方案供應商確認，並準備離線備案。',version:'2',sourceRefs:[]},
  {id:'luggage-check',gate:'G3',required:['airline','cabin','luggageItems'],impact:'物品及行李規定可能依航線與航空公司不同。',next:'逐項確認航空公司與主管機關資訊。',version:'1',sourceRefs:[]},
  {id:'departure-check',gate:'G4',required:['flightTime','flightTimezone','terminal','departurePoint','groundTransport','buffer'],watch:['lodgingContact','lodgingCheckIn','lodgingNotes'],impact:'出發交通及預留時間需要確認。',next:'確認交通時間、航廈及替代方案。',version:'1',sourceRefs:[]},
  {id:'return-check',gate:'G5',required:['returnDestination','returnItems'],impact:'回程物品可能有申報或檢疫條件。',next:'查詢入境地官方資料並確認是否需要申報。',version:'1',sourceRefs:['tw-customs','jp-customs','jp-animal','jp-plant']},
  {id:'reflection',gate:'G6',required:[],impact:'旅後可留下自主回饋。',next:'選擇性記錄有幫助或需要改進的地方。',version:'1',sourceRefs:[]},
];

export function evaluateGate(gate: GateId, inputs: InputMap, rules: readonly GateRule[], clock: Date, applicability: Applicability = 'unknown'): Finding[] {
  if (!Number.isFinite(clock.getTime())) throw new Error('Invalid clock');
  return rules.filter(rule => rule.gate === gate).map(rule => {
    const missingFields = rule.required.filter(key => {
      const input = inputs[key];
      return !input || input.source !== 'user' || !Number.isFinite(Date.parse(input.confirmedAt)) || (typeof input.value === 'string' && !input.value.trim()) || (gate === 'G2' && key === 'compatibility' && !['支援','不支援'].includes(String(input.value).trim()));
    });
    const due = !!rule.reviewDue && Number.isFinite(Date.parse(rule.reviewDue)) && clock.getTime() >= Date.parse(rule.reviewDue);
    return {ruleId:rule.id,gate,severity:'attention',evidenceState: missingFields.length ? 'missing' : due ? 'review_due' : 'needs_review',applicability,missingFields,sourceRefs:[...rule.sourceRefs],impact:rule.impact,actions:[rule.next],ruleVersion:rule.version,calculatedAt:clock.toISOString()};
  });
}

/** Task completion and sufficient information are separate; neither implies legal compliance. */
export function needsGateAttention(state: GuardianState, gate: GateId, clock: Date): boolean {
  const task = state.tasks[gate];
  if (!task || task.needsReview) return true;
  if (task.status === 'skipped' || task.applicability === 'not_applicable') return false;
  if (task.status !== 'done') return true;
  const findings = evaluateGate(gate, state.inputs, initialRules, clock, task.applicability ?? 'unknown');
  return task.applicability !== 'applicable' || findings.length === 0 || findings.some(f => f.evidenceState === 'missing' || f.evidenceState === 'review_due' || f.evidenceState === 'conflict');
}

export function affectedGates(changedFields: readonly string[], rules: readonly GateRule[]): GateId[] {
  const changed = new Set(changedFields);
  return [...new Set(rules.filter(rule => [...rule.required, ...(rule.watch ?? [])].some(field => changed.has(field))).map(rule => rule.gate))];
}

export type GuardianTask = { status: TaskStatus; needsReview: boolean; note: string; snoozedUntil?: string; applicability?: Applicability };
export type GuardianDraft = { values: Record<string, string>; note: string };
export type GateRun = { id: string; recordedAt: string; ruleId: string; ruleVersion: string; evidenceState: EvidenceState; applicability: Applicability; missingFields: string[]; sourceRefs: string[]; inputs: InputMap; impact?: string; actions?: string[]; taskStatus?: TaskStatus };
export type GuardianState = { schemaVersion: 1; inputs: InputMap; tasks: Partial<Record<GateId, GuardianTask>>; cancelled?: boolean; drafts?: Partial<Record<GateId, GuardianDraft>>; runs?: Partial<Record<GateId, GateRun[]>> };
export const emptyGuardian = (): GuardianState => ({ schemaVersion: 1, inputs: {}, tasks: {} });
/** Draft edits do not change confirmed values, but must reopen a previously recorded task. */
export function updateGateDraft(state: GuardianState, gate: GateId, values: Record<string, string>, note: string): GuardianState {
  const keys = new Set(initialRules.filter(rule => rule.gate === gate).flatMap(rule => [...rule.required, ...(rule.watch ?? [])]));
  if (gate === 'G6') keys.add('feedback');
  const differs = [...keys].some(key => key in values && values[key].trim() !== String(state.inputs[key]?.value ?? '').trim());
  const task = state.tasks[gate];
  const tasks = differs && task ? { ...state.tasks, [gate]: { ...task, needsReview: true } } : state.tasks;
  return { ...state, tasks, drafts: { ...state.drafts, [gate]: { values, note } } };
}
export function hasUnrecordedGateInputs(state: GuardianState, gate: GateId): boolean {
  const values = state.drafts?.[gate]?.values;
  if (!values) return false;
  const keys = new Set(initialRules.filter(rule => rule.gate === gate).flatMap(rule => [...rule.required, ...(rule.watch ?? [])]));
  if (gate === 'G6') keys.add('feedback');
  return [...keys].some(key => key in values && values[key].trim() !== String(state.inputs[key]?.value ?? '').trim());
}
/** Record an explicit user review, never an automatic assertion of compliance. */
export function recordGateReview(state: GuardianState, gate: GateId, clock: Date): GuardianState {
  if (hasUnrecordedGateInputs(state, gate)) throw new Error('請先記錄尚未確認的資料');
  const task = state.tasks[gate];
  const [finding] = evaluateGate(gate, state.inputs, initialRules, clock, task?.applicability ?? 'unknown');
  if (!finding) throw new Error('找不到檢查規則');
  const rule = initialRules.find(item => item.id === finding.ruleId)!;
  const inputs: InputMap = {};
  for (const key of [...rule.required, ...(rule.watch ?? []), ...(gate === 'G6' ? ['feedback'] : [])]) {
    if (state.inputs[key]) inputs[key] = { ...state.inputs[key]! };
  }
  const old = state.runs?.[gate] ?? [];
  let serial = 0;
  let id = `${gate}:${clock.toISOString()}:${serial}`;
  while (old.some(run => run.id === id)) id = `${gate}:${clock.toISOString()}:${++serial}`;
  const run: GateRun = { id, recordedAt: clock.toISOString(), ruleId: finding.ruleId, ruleVersion: finding.ruleVersion, evidenceState: finding.evidenceState, applicability: finding.applicability, missingFields: finding.missingFields, sourceRefs: finding.sourceRefs, inputs, impact: finding.impact, actions: finding.actions, taskStatus: task?.status ?? 'todo' };
  return { ...state, runs: { ...state.runs, [gate]: [...old, run].slice(-20) } };
}
/** On reopening, retain the prior review while flagging a changed or removed rule. */
export function markChangedRules(state: GuardianState, rules: readonly GateRule[]): GuardianState {
  let tasks = state.tasks;
  for (const gate of ['G1','G2','G3','G4','G5','G6'] as const) {
    const last = state.runs?.[gate]?.at(-1);
    const task = tasks[gate];
    if (!last || !task || task.needsReview) continue;
    const rule = rules.find(item => item.gate === gate && item.id === last.ruleId);
    const changed = !rule || rule.version !== last.ruleVersion || JSON.stringify([...rule.sourceRefs].sort()) !== JSON.stringify([...last.sourceRefs].sort());
    if (changed) tasks = { ...tasks, [gate]: { ...task, needsReview: true } };
  }
  return tasks === state.tasks ? state : { ...state, tasks };
}
export function updateConfirmedInputs(state: GuardianState, values: Record<string, string>, confirmedAt: string): GuardianState {
  if (!Number.isFinite(Date.parse(confirmedAt))) throw new Error('Invalid confirmation time');
  const inputs = { ...state.inputs };
  const changed: string[] = [];
  for (const [key, raw] of Object.entries(values)) {
    const value = raw.trim();
    if (!value) { if (inputs[key]) { delete inputs[key]; changed.push(key); } continue; }
    if (inputs[key]?.value !== value) changed.push(key);
    inputs[key] = { value, confirmedAt, source: 'user' };
  }
  const tasks = { ...state.tasks };
  for (const gate of affectedGates(changed, initialRules)) {
    if (tasks[gate]) tasks[gate] = { ...tasks[gate]!, needsReview: true };
  }
  return { ...state, schemaVersion: 1, inputs, tasks };
}
export function isGuardianState(value: unknown): value is GuardianState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as GuardianState;
  if (v.schemaVersion !== 1 || !v.inputs || typeof v.inputs !== 'object' || Array.isArray(v.inputs) || !v.tasks || typeof v.tasks !== 'object' || Array.isArray(v.tasks)) return false;
  if (v.cancelled !== undefined && typeof v.cancelled !== 'boolean') return false;
  const validInputs = Object.values(v.inputs).every(x => x && typeof x === 'object' && (typeof x.value === 'string' || typeof x.value === 'boolean' || (typeof x.value === 'number' && Number.isFinite(x.value))) && x.source === 'user' && typeof x.confirmedAt === 'string' && Number.isFinite(Date.parse(x.confirmedAt)));
  const validTasks = Object.entries(v.tasks).every(([key, t]) => ['G1','G2','G3','G4','G5','G6'].includes(key) && t && ['todo','in_progress','done','snoozed','skipped'].includes(t.status) && typeof t.needsReview === 'boolean' && typeof t.note === 'string' && (t.applicability === undefined || ['applicable','not_applicable','unknown'].includes(t.applicability)) && (t.snoozedUntil === undefined || (typeof t.snoozedUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.snoozedUntil) && Number.isFinite(Date.parse(t.snoozedUntil)) && new Date(t.snoozedUntil).toISOString().slice(0,10) === t.snoozedUntil)));
  const validDrafts = v.drafts === undefined || (!!v.drafts && typeof v.drafts === 'object' && !Array.isArray(v.drafts) && Object.entries(v.drafts).every(([key, d]) => ['G1','G2','G3','G4','G5','G6'].includes(key) && d && typeof d.note === 'string' && d.note.length <= 500 && d.values && typeof d.values === 'object' && !Array.isArray(d.values) && Object.values(d.values).every(value => typeof value === 'string' && value.length <= 500)));
  const validRuns = v.runs === undefined || (!!v.runs && typeof v.runs === 'object' && !Array.isArray(v.runs) && Object.entries(v.runs).every(([gate, runs]) => ['G1','G2','G3','G4','G5','G6'].includes(gate) && Array.isArray(runs) && runs.length <= 20 && runs.every(run => run && typeof run.id === 'string' && run.id.length <= 200 && typeof run.recordedAt === 'string' && Number.isFinite(Date.parse(run.recordedAt)) && typeof run.ruleId === 'string' && typeof run.ruleVersion === 'string' && ['confirmed_by_user','needs_review','missing','conflict','review_due'].includes(run.evidenceState) && ['applicable','not_applicable','unknown'].includes(run.applicability) && Array.isArray(run.missingFields) && run.missingFields.every((x: unknown) => typeof x === 'string') && Array.isArray(run.sourceRefs) && run.sourceRefs.every((x: unknown) => typeof x === 'string') && (run.impact === undefined || typeof run.impact === 'string') && (run.actions === undefined || (Array.isArray(run.actions) && run.actions.every((x: unknown) => typeof x === 'string'))) && (run.taskStatus === undefined || ['todo','in_progress','done','snoozed','skipped'].includes(run.taskStatus)) && run.inputs && typeof run.inputs === 'object' && !Array.isArray(run.inputs) && Object.values(run.inputs).every((input: any) => input && typeof input === 'object' && (typeof input.value === 'string' || typeof input.value === 'boolean' || (typeof input.value === 'number' && Number.isFinite(input.value))) && input.source === 'user' && typeof input.confirmedAt === 'string' && Number.isFinite(Date.parse(input.confirmedAt))))));
  return validInputs && validTasks && validDrafts && validRuns;
}

/** Keep the user's existing task status but flag only gates affected by a date change. */
export function markScheduleChanges(state: GuardianState, startChanged: boolean, endChanged: boolean): GuardianState {
  const impacted = new Set<GateId>();
  if (startChanged) for (const id of ['G1','G2','G3','G4'] as const) impacted.add(id);
  if (endChanged) for (const id of ['G2','G5','G6'] as const) impacted.add(id);
  const tasks = { ...state.tasks };
  for (const id of impacted) if (tasks[id]) tasks[id] = { ...tasks[id]!, needsReview: true };
  return { ...state, tasks };
}

/** Confirmed itinerary edits can affect these checks; do not overwrite their data. */
export function markDocumentChanges(state: GuardianState, kind: 'flight' | 'lodging'): GuardianState {
  const impacted: GateId[] = kind === 'flight' ? ['G1','G3','G4'] : ['G4'];
  const tasks = { ...state.tasks };
  for (const id of impacted) if (tasks[id]) tasks[id] = { ...tasks[id]!, needsReview: true };
  return { ...state, tasks };
}

/** A restored trip retains prior task history, but all existing tasks need review. */
export function setTripCancelled(state: GuardianState, cancelled: boolean): GuardianState {
  if (state.cancelled === true && !cancelled) {
    const tasks = { ...state.tasks };
    for (const id of Object.keys(tasks) as GateId[]) if (tasks[id]) tasks[id] = { ...tasks[id]!, needsReview: true };
    return { ...state, cancelled: false, tasks };
  }
  return { ...state, cancelled };
}
