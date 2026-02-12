import { apiUrl } from './apiBase';

export type MetricsResponse = {
  ok: boolean;
  range: { days: number; since: string; until: string };
  dailyActive: Array<{ day: string; dau: number; sessions: number; events: number }>;
  topEvents: Array<{ name: string; count: number }>;
  funnel: {
    startedSessions: number;
    finalizedSessions: number;
    sharedSessions: number;
    exportedSessions: number;
    startedToFinalized: number;
    finalizedToShared: number;
  };
  topDestinations: Array<{ destination: string; count: number }>;
  featureUsage: {
    bulkCheckedOn: number;
    bulkCheckedOff: number;
    bulkPackedOn: number;
    bulkPackedOff: number;
  };
  topSearchTerms: Array<{ query: string; count: number }>;
  topPackSearchTerms?: Array<{ query: string; count: number }>;
  templateUsage?: {
    selected: Array<{ templateId: string; count: number }>;
    applied: Array<{ templateId: string; count: number }>;
  };
  scenarioUsage?: {
    selected: Array<{ scenarioId: string; count: number }>;
    bulkSet: Array<{ scenarioId: string; count: number }>;
    filterToggledOn: number;
    filterToggledOff: number;
  };
  shareFailures?: Array<{ reason: string; count: number }>;
  noResultSearchTerms?: Array<{ query: string; count: number }>;
  stepFunnel?: {
    step0Sessions: number;
    step1Sessions: number;
    step2Sessions: number;
    step0To1: number;
    step1To2: number;
  };
  riskKpi?: {
    blockedEvents: number;
    clearedEvents: number;
    blockedSessions: number;
    clearedSessions: number;
    clearanceRate: number;
    resolvedByAction: Array<{ action: string; count: number }>;
    resolvedByType: Array<{ issueType: string; count: number }>;
  };
};

export type RecentEventsResponse = {
  ok: boolean;
  events: Array<{
    id: number;
    userId: string;
    sessionId: string;
    name: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
};

export type CleanupResponse = {
  ok: boolean;
  before: string;
  eventsDeleted: number;
  sessionsDeleted: number;
  usersDeleted: number;
};

export class AdminApiError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.status = status;
  }
}

export const buildAdminHeaders = (token: string) => {
  const h: Record<string, string> = {};
  if (token.trim()) h['x-admin-token'] = token.trim();
  return h;
};

export const fetchAdminMetrics = async (days: number, headers: Record<string, string>) => {
  const res = await fetch(apiUrl(`/api/admin/metrics?days=${encodeURIComponent(String(days))}`), { headers });
  if (!res.ok) throw new AdminApiError(`載入失敗（${res.status}）`, res.status);
  const data = (await res.json()) as MetricsResponse;
  if (!data?.ok) throw new AdminApiError('載入失敗');
  return data;
};

export const fetchRecentEvents = async (
  params: { limit: number; name?: string; q?: string },
  headers: Record<string, string>
) => {
  const search = new URLSearchParams();
  search.set('limit', String(params.limit));
  if (params.name) search.set('name', params.name);
  if (params.q) search.set('q', params.q);
  const res = await fetch(apiUrl(`/api/admin/recent-events?${search.toString()}`), { headers });
  if (!res.ok) throw new AdminApiError(`載入失敗（${res.status}）`, res.status);
  const data = (await res.json()) as RecentEventsResponse;
  if (!data?.ok) throw new AdminApiError('載入失敗');
  return data.events || [];
};

export const runAdminCleanup = async (days: number, headers: Record<string, string>) => {
  const res = await fetch(apiUrl('/api/admin/cleanup'), {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ days }),
  });
  if (!res.ok) throw new AdminApiError(`清理失敗（${res.status}）`, res.status);
  const data = (await res.json()) as CleanupResponse;
  if (!data?.ok) throw new AdminApiError('清理失敗');
  return data;
};
