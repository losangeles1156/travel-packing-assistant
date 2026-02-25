const normalizeMode = (mode) => {
  if (mode === 'standard') return 'standard';
  if (mode === 'conservative') return 'conservative';
  return null;
};

const toEpoch = (value) => {
  const t = Date.parse(String(value || ''));
  return Number.isFinite(t) ? t : 0;
};

export const computeRiskModeKpi = (events = []) => {
  const sessionLastMode = new Map();
  let switchedToStandard = 0;
  let switchedToConservative = 0;

  const normalized = [...events]
    .map((event) => ({
      sessionId: typeof event?.session_id === 'string' ? event.session_id : '',
      mode: normalizeMode(event?.payload?.mode),
      createdAt: toEpoch(event?.created_at),
    }))
    .filter((event) => event.sessionId && event.mode)
    .sort((a, b) => a.createdAt - b.createdAt);

  for (const event of normalized) {
    if (event.mode === 'standard') switchedToStandard += 1;
    if (event.mode === 'conservative') switchedToConservative += 1;
    sessionLastMode.set(event.sessionId, event.mode);
  }

  let sessionsStayedStandard = 0;
  let sessionsStayedConservative = 0;
  for (const mode of sessionLastMode.values()) {
    if (mode === 'standard') sessionsStayedStandard += 1;
    if (mode === 'conservative') sessionsStayedConservative += 1;
  }

  const sessionsChanged = sessionLastMode.size;
  return {
    totalChanges: switchedToStandard + switchedToConservative,
    switchedToStandard,
    switchedToConservative,
    sessionsChanged,
    sessionsStayedStandard,
    sessionsStayedConservative,
    standardStayRate: sessionsChanged ? Math.round((sessionsStayedStandard / sessionsChanged) * 100) : 0,
  };
};
