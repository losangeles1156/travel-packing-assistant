import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    locale TEXT,
    user_agent TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    last_seen TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    payload TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS shared_lists (
    share_id TEXT PRIMARY KEY,
    snapshot TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
  CREATE INDEX IF NOT EXISTS idx_events_name_created_at ON events(name, created_at);
  CREATE INDEX IF NOT EXISTS idx_events_session_created_at ON events(session_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen);
  CREATE INDEX IF NOT EXISTS idx_shared_lists_created_at ON shared_lists(created_at);
`);

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const isLocalRequest = (req) => {
  const ip = req.ip || '';
  return ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1');
};

const tokensEqual = (a, b) => {
  if (!a || !b) return false;
  const aa = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
};

const requireAdmin = (req, res, next) => {
  const headerToken = req.get('x-admin-token') || '';
  const token = headerToken;

  if (ADMIN_TOKEN) {
    if (tokensEqual(token, ADMIN_TOKEN)) {
      next();
      return;
    }
    res.status(401).json({ ok: false });
    return;
  }

  if (process.env.NODE_ENV !== 'production' && isLocalRequest(req)) {
    next();
    return;
  }
  res.status(401).json({ ok: false });
};

const safeParseJson = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const toIsoDaysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

const clampInt = (value, min, max, fallback) => {
  const n = Number.parseInt(String(value), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const isValidClientId = (value, max = 128) => {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > max) return false;
  return /^[a-zA-Z0-9_.:-]+$/.test(value);
};

const normalizeText = (value, max) => {
  if (typeof value !== 'string') return null;
  const next = value.trim();
  if (!next) return null;
  return next.slice(0, max);
};

const isValidShareSnapshot = (snapshot) => {
  if (!snapshot || typeof snapshot !== 'object') return false;
  if (snapshot.schemaVersion !== 1) return false;
  if (!isValidClientId(String(snapshot.id || ''), 128)) return false;
  if (!snapshot.trip || typeof snapshot.trip !== 'object') return false;
  if (!Array.isArray(snapshot.items)) return false;
  if (!Array.isArray(snapshot.tasks)) return false;
  return true;
};

const upsertUser = db.prepare(`
  INSERT INTO users (user_id, first_seen, last_seen, locale, user_agent)
  VALUES (@userId, @now, @now, @locale, @userAgent)
  ON CONFLICT(user_id) DO UPDATE SET
    last_seen = excluded.last_seen,
    locale = COALESCE(excluded.locale, users.locale),
    user_agent = COALESCE(excluded.user_agent, users.user_agent)
`);

const upsertSession = db.prepare(`
  INSERT INTO sessions (session_id, user_id, started_at, last_seen)
  VALUES (@sessionId, @userId, @now, @now)
  ON CONFLICT(session_id) DO UPDATE SET
    last_seen = excluded.last_seen
`);

const insertEvent = db.prepare(`
  INSERT INTO events (user_id, session_id, name, payload, created_at)
  VALUES (@userId, @sessionId, @name, @payload, @createdAt)
`);

const insertSharedList = db.prepare(`
  INSERT INTO shared_lists (share_id, snapshot, created_at)
  VALUES (@shareId, @snapshot, @createdAt)
`);

const getSharedList = db.prepare(`
  SELECT snapshot, created_at
  FROM shared_lists
  WHERE share_id = ?
`);
const deleteSharedListById = db.prepare(`
  DELETE FROM shared_lists
  WHERE share_id = ?
`);

const deleteExpiredSharedLists = db.prepare(`
  DELETE FROM shared_lists
  WHERE created_at < ?
`);

const deleteOldEvents = db.prepare(`
  DELETE FROM events
  WHERE created_at < ?
`);

const deleteOldSessions = db.prepare(`
  DELETE FROM sessions
  WHERE last_seen < ?
`);

const deleteOldUsers = db.prepare(`
  DELETE FROM users
  WHERE last_seen < ?
`);

const generateShareId = () => crypto.randomBytes(9).toString('base64url');

const app = express();
const trustProxyRaw = process.env.TRUST_PROXY || '1';
const trustProxy = trustProxyRaw === 'true' ? true : trustProxyRaw === 'false' ? false : Number(trustProxyRaw);
app.set('trust proxy', Number.isNaN(trustProxy) ? trustProxyRaw : trustProxy);
app.disable('x-powered-by');
const port = process.env.PORT ? Number(process.env.PORT) : 4000;
const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes('*')) return true;
  return allowedOrigins.includes(origin);
};

app.use(
  cors({
    origin(origin, cb) {
      if (isAllowedOrigin(origin)) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-admin-token'],
  })
);
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use(express.json({ limit: '256kb' }));

const EVENT_IP_LIMIT = Number(process.env.EVENT_IP_LIMIT || '120');
const EVENT_SESSION_LIMIT = Number(process.env.EVENT_SESSION_LIMIT || '60');
const EVENT_WINDOW_MS = Number(process.env.EVENT_WINDOW_MS || '60000');
const SHARE_IP_LIMIT = Number(process.env.SHARE_IP_LIMIT || '30');
const SHARE_WINDOW_MS = Number(process.env.SHARE_WINDOW_MS || '60000');
const SHARE_TTL_DAYS = clampInt(process.env.SHARE_TTL_DAYS, 1, 365, 30);
const EVENT_RETENTION_DAYS = clampInt(process.env.EVENT_RETENTION_DAYS, 7, 3650, 180);
const AUTO_CLEANUP_INTERVAL_HOURS = clampInt(process.env.AUTO_CLEANUP_INTERVAL_HOURS, 1, 168, 24);
const ENABLE_ADMIN_BACKUP = process.env.ENABLE_ADMIN_BACKUP === '1' || process.env.NODE_ENV !== 'production';

const ipEventMap = new Map();
const sessionEventMap = new Map();
const ipShareMap = new Map();

const limitHit = (map, key, limit, windowMs) => {
  const now = Date.now();
  const cur = map.get(key);
  if (!cur || now >= cur.reset) {
    map.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  if (cur.count >= limit) return true;
  cur.count += 1;
  return false;
};

const isValidEventName = (name) => {
  if (typeof name !== 'string') return false;
  if (name.length === 0 || name.length > 64) return false;
  return /^[a-zA-Z0-9_.:-]+$/.test(name);
};

const runAutoCleanup = () => {
  const sharedBefore = toIsoDaysAgo(SHARE_TTL_DAYS);
  const eventsBefore = toIsoDaysAgo(EVENT_RETENTION_DAYS);

  const tx = db.transaction(() => {
    const shared = deleteExpiredSharedLists.run(sharedBefore);
    const events = deleteOldEvents.run(eventsBefore);
    const sessions = deleteOldSessions.run(eventsBefore);
    const users = deleteOldUsers.run(eventsBefore);
    return {
      sharedDeleted: shared.changes,
      eventsDeleted: events.changes,
      sessionsDeleted: sessions.changes,
      usersDeleted: users.changes,
    };
  });

  return tx();
};

try {
  runAutoCleanup();
} catch {
  // Ignore startup cleanup failures to keep API available.
}

const cleanupTimer = setInterval(() => {
  try {
    runAutoCleanup();
  } catch {
    // Ignore periodic cleanup failures.
  }
}, AUTO_CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000);
cleanupTimer.unref();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/admin/metrics', requireAdmin, (req, res) => {
  const days = clampInt(req.query?.days, 1, 180, 30);
  const since = toIsoDaysAgo(days);

  const dailyActive = db
    .prepare(
      `
      SELECT substr(created_at, 1, 10) AS day,
             COUNT(DISTINCT user_id) AS dau,
             COUNT(DISTINCT session_id) AS sessions,
             COUNT(*) AS events
      FROM events
      WHERE created_at >= ?
      GROUP BY day
      ORDER BY day ASC
      `
    )
    .all(since);

  const topEvents = db
    .prepare(
      `
      SELECT name, COUNT(*) AS count
      FROM events
      WHERE created_at >= ?
      GROUP BY name
      ORDER BY count DESC
      LIMIT 30
      `
    )
    .all(since);

  const funnel = db
    .prepare(
      `
      WITH base AS (
        SELECT session_id,
               MAX(CASE WHEN name = 'trip_started' THEN 1 ELSE 0 END) AS started,
               MAX(CASE WHEN name = 'list_finalized' THEN 1 ELSE 0 END) AS finalized,
               MAX(CASE WHEN name = 'list_shared' THEN 1 ELSE 0 END) AS shared,
               MAX(CASE WHEN name = 'list_exported' THEN 1 ELSE 0 END) AS exported
        FROM events
        WHERE created_at >= ?
        GROUP BY session_id
      )
      SELECT
        SUM(started) AS startedSessions,
        SUM(finalized) AS finalizedSessions,
        SUM(shared) AS sharedSessions,
        SUM(exported) AS exportedSessions,
        SUM(CASE WHEN started = 1 AND finalized = 1 THEN 1 ELSE 0 END) AS startedToFinalized,
        SUM(CASE WHEN finalized = 1 AND shared = 1 THEN 1 ELSE 0 END) AS finalizedToShared
      FROM base
      `
    )
    .get(since);

  const recentTripEvents = db
    .prepare(
      `
      SELECT payload
      FROM events
      WHERE created_at >= ? AND name = 'trip_started'
      ORDER BY created_at DESC
      LIMIT 5000
      `
    )
    .all(since);

  const destinationCounts = new Map();
  for (const row of recentTripEvents) {
    const payload = safeParseJson(row.payload);
    const destination = typeof payload?.destination === 'string' ? payload.destination.trim() : '';
    if (!destination) continue;
    destinationCounts.set(destination, (destinationCounts.get(destination) || 0) + 1);
  }
  const topDestinations = Array.from(destinationCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([destination, count]) => ({ destination, count }));

  const bulkOps = db
    .prepare(
      `
      SELECT name, payload
      FROM events
      WHERE created_at >= ? AND name IN (
        'items_bulk_checked_set',
        'packing_bulk_set',
        'packing_search_bulk_set',
        'packing_scenario_bulk_set'
      )
      ORDER BY created_at DESC
      LIMIT 5000
      `
    )
    .all(since);

  let bulkCheckedOn = 0;
  let bulkCheckedOff = 0;
  let bulkPackedOn = 0;
  let bulkPackedOff = 0;
  const searchTerms = new Map();
  const packSearchTerms = new Map();

  for (const row of bulkOps) {
    const payload = safeParseJson(row.payload);
    if (!payload || typeof payload !== 'object') continue;
    if ('packed' in payload) {
      if (payload.packed === true) bulkPackedOn += 1;
      if (payload.packed === false) bulkPackedOff += 1;
    }
    if ('checked' in payload) {
      if (payload.checked === true) bulkCheckedOn += 1;
      if (payload.checked === false) bulkCheckedOff += 1;
    }
    const q = typeof payload.query === 'string' ? payload.query.trim().toLowerCase() : '';
    if (q) searchTerms.set(q, (searchTerms.get(q) || 0) + 1);

    if (row.name === 'packing_search_bulk_set') {
      if (q) packSearchTerms.set(q, (packSearchTerms.get(q) || 0) + 1);
    }
  }

  const topSearchTerms = Array.from(searchTerms.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([query, count]) => ({ query, count }));

  const topPackSearchTerms = Array.from(packSearchTerms.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([query, count]) => ({ query, count }));

  const templateRows = db
    .prepare(
      `
      SELECT name, payload
      FROM events
      WHERE created_at >= ? AND name IN ('template_selected', 'template_applied')
      ORDER BY id DESC
      LIMIT 20000
      `
    )
    .all(since);

  const templateSelectedCounts = new Map();
  const templateAppliedCounts = new Map();
  for (const row of templateRows) {
    const payload = safeParseJson(row.payload);
    const templateId = typeof payload?.templateId === 'string' ? payload.templateId.trim() : '';
    if (!templateId) continue;
    if (row.name === 'template_selected') {
      templateSelectedCounts.set(templateId, (templateSelectedCounts.get(templateId) || 0) + 1);
    }
    if (row.name === 'template_applied') {
      templateAppliedCounts.set(templateId, (templateAppliedCounts.get(templateId) || 0) + 1);
    }
  }

  const topTemplatesSelected = Array.from(templateSelectedCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([templateId, count]) => ({ templateId, count }));

  const topTemplatesApplied = Array.from(templateAppliedCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([templateId, count]) => ({ templateId, count }));

  const scenarioRows = db
    .prepare(
      `
      SELECT name, payload
      FROM events
      WHERE created_at >= ? AND name IN ('packing_scenario_selected', 'packing_scenario_bulk_set', 'packing_scenario_filter_toggled')
      ORDER BY id DESC
      LIMIT 20000
      `
    )
    .all(since);

  const scenarioSelectedCounts = new Map();
  const scenarioBulkCounts = new Map();
  let scenarioFilterOn = 0;
  let scenarioFilterOff = 0;
  for (const row of scenarioRows) {
    const payload = safeParseJson(row.payload);
    if (!payload || typeof payload !== 'object') continue;

    if (row.name === 'packing_scenario_filter_toggled') {
      if (payload.enabled === true) scenarioFilterOn += 1;
      if (payload.enabled === false) scenarioFilterOff += 1;
    }

    const scenarioId = typeof payload.scenarioId === 'string' ? payload.scenarioId.trim() : '';
    if (!scenarioId) continue;

    if (row.name === 'packing_scenario_selected') {
      scenarioSelectedCounts.set(scenarioId, (scenarioSelectedCounts.get(scenarioId) || 0) + 1);
    }
    if (row.name === 'packing_scenario_bulk_set') {
      scenarioBulkCounts.set(scenarioId, (scenarioBulkCounts.get(scenarioId) || 0) + 1);
    }
  }

  const topScenariosSelected = Array.from(scenarioSelectedCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([scenarioId, count]) => ({ scenarioId, count }));

  const topScenariosBulkSet = Array.from(scenarioBulkCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([scenarioId, count]) => ({ scenarioId, count }));

  const shareFailedRows = db
    .prepare(
      `
      SELECT payload
      FROM events
      WHERE created_at >= ? AND name = 'list_share_failed'
      ORDER BY created_at DESC
      LIMIT 5000
      `
    )
    .all(since);

  const shareFailureCounts = new Map();
  for (const row of shareFailedRows) {
    const payload = safeParseJson(row.payload);
    const reason = typeof payload?.reason === 'string' ? payload.reason.trim() : '';
    const key = reason || 'unknown';
    shareFailureCounts.set(key, (shareFailureCounts.get(key) || 0) + 1);
  }
  const shareFailures = Array.from(shareFailureCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([reason, count]) => ({ reason, count }));

  const noResultRows = db
    .prepare(
      `
      SELECT payload
      FROM events
      WHERE created_at >= ? AND name = 'search_no_results'
      ORDER BY created_at DESC
      LIMIT 8000
      `
    )
    .all(since);

  const noResultCounts = new Map();
  for (const row of noResultRows) {
    const payload = safeParseJson(row.payload);
    const query = typeof payload?.query === 'string' ? payload.query.trim().toLowerCase() : '';
    if (!query) continue;
    noResultCounts.set(query, (noResultCounts.get(query) || 0) + 1);
  }
  const noResultSearchTerms = Array.from(noResultCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([query, count]) => ({ query, count }));

  const stepRows = db
    .prepare(
      `
      SELECT session_id AS sessionId, payload
      FROM events
      WHERE created_at >= ? AND name = 'generator_step_viewed'
      ORDER BY created_at DESC
      LIMIT 20000
      `
    )
    .all(since);

  const sessionSteps = new Map();
  for (const row of stepRows) {
    const payload = safeParseJson(row.payload);
    const step = typeof payload?.step === 'number' ? payload.step : Number.parseInt(String(payload?.step ?? ''), 10);
    if (!Number.isFinite(step)) continue;
    const s = row.sessionId;
    if (!s) continue;
    const prev = sessionSteps.get(s) || { step0: false, step1: false, step2: false };
    const next = {
      step0: prev.step0 || step === 0,
      step1: prev.step1 || step === 1,
      step2: prev.step2 || step === 2,
    };
    sessionSteps.set(s, next);
  }

  let step0Sessions = 0;
  let step1Sessions = 0;
  let step2Sessions = 0;
  let step0To1 = 0;
  let step1To2 = 0;
  for (const v of sessionSteps.values()) {
    if (v.step0) step0Sessions += 1;
    if (v.step1) step1Sessions += 1;
    if (v.step2) step2Sessions += 1;
    if (v.step0 && v.step1) step0To1 += 1;
    if (v.step1 && v.step2) step1To2 += 1;
  }

  const riskRows = db
    .prepare(
      `
      SELECT session_id AS sessionId, name, payload
      FROM events
      WHERE created_at >= ? AND name IN ('risk_gate_blocked', 'risk_issue_resolved', 'risk_blocking_cleared')
      ORDER BY id DESC
      LIMIT 30000
      `
    )
    .all(since);

  let riskGateBlocked = 0;
  let riskBlockingCleared = 0;
  const resolvedByAction = new Map();
  const resolvedByType = new Map();
  const blockedSessions = new Set();
  const clearedSessions = new Set();

  for (const row of riskRows) {
    if (row.name === 'risk_gate_blocked') {
      riskGateBlocked += 1;
      if (row.sessionId) blockedSessions.add(row.sessionId);
      continue;
    }
    if (row.name === 'risk_blocking_cleared') {
      riskBlockingCleared += 1;
      if (row.sessionId) clearedSessions.add(row.sessionId);
      continue;
    }
    if (row.name === 'risk_issue_resolved') {
      const payload = safeParseJson(row.payload);
      const action = typeof payload?.action === 'string' ? payload.action.trim() : '';
      const issueType = typeof payload?.issueType === 'string' ? payload.issueType.trim() : '';
      if (action) resolvedByAction.set(action, (resolvedByAction.get(action) || 0) + 1);
      if (issueType) resolvedByType.set(issueType, (resolvedByType.get(issueType) || 0) + 1);
    }
  }

  const riskResolvedActions = Array.from(resolvedByAction.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([action, count]) => ({ action, count }));

  const riskResolvedTypes = Array.from(resolvedByType.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([issueType, count]) => ({ issueType, count }));

  const riskClearanceRate = blockedSessions.size
    ? Math.round((clearedSessions.size / blockedSessions.size) * 100)
    : 0;

  res.json({
    ok: true,
    range: {
      days,
      since,
      until: new Date().toISOString(),
    },
    dailyActive,
    topEvents,
    funnel,
    topDestinations,
    featureUsage: {
      bulkCheckedOn,
      bulkCheckedOff,
      bulkPackedOn,
      bulkPackedOff,
    },
    topSearchTerms,
    topPackSearchTerms,
    templateUsage: {
      selected: topTemplatesSelected,
      applied: topTemplatesApplied,
    },
    scenarioUsage: {
      selected: topScenariosSelected,
      bulkSet: topScenariosBulkSet,
      filterToggledOn: scenarioFilterOn,
      filterToggledOff: scenarioFilterOff,
    },
    shareFailures,
    noResultSearchTerms,
    stepFunnel: {
      step0Sessions,
      step1Sessions,
      step2Sessions,
      step0To1,
      step1To2,
    },
    riskKpi: {
      blockedEvents: riskGateBlocked,
      clearedEvents: riskBlockingCleared,
      blockedSessions: blockedSessions.size,
      clearedSessions: clearedSessions.size,
      clearanceRate: riskClearanceRate,
      resolvedByAction: riskResolvedActions,
      resolvedByType: riskResolvedTypes,
    },
  });
});

app.get('/api/admin/recent-events', requireAdmin, (req, res) => {
  const limit = clampInt(req.query?.limit, 1, 500, 100);
  const name = typeof req.query?.name === 'string' ? req.query.name.trim() : '';
  const q = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
  const sinceRaw = typeof req.query?.since === 'string' ? req.query.since.trim() : '';
  const since = sinceRaw && Number.isFinite(Date.parse(sinceRaw)) ? sinceRaw : '';

  const where = [];
  const params = [];
  if (since) {
    where.push('created_at >= ?');
    params.push(since);
  }
  if (name) {
    where.push('name = ?');
    params.push(name);
  } else if (q) {
    where.push('name LIKE ?');
    params.push(`%${q}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `
      SELECT id, user_id AS userId, session_id AS sessionId, name, payload, created_at AS createdAt
      FROM events
      ${whereSql}
      ORDER BY id DESC
      LIMIT ?
    `;

  const rows = db
    .prepare(sql)
    .all(...params, limit)
    .map(r => ({
      ...r,
      payload: safeParseJson(r.payload) ?? {},
    }));

  res.json({ ok: true, events: rows });
});

app.post('/api/admin/cleanup', requireAdmin, (req, res) => {
  const days = clampInt(req.body?.days, 7, 3650, 120);
  const before = toIsoDaysAgo(days);

  const deleteEvents = db.prepare(`DELETE FROM events WHERE created_at < ?`);
  const deleteSessions = db.prepare(`DELETE FROM sessions WHERE last_seen < ?`);
  const deleteUsers = db.prepare(`DELETE FROM users WHERE last_seen < ?`);

  const tx = db.transaction(() => {
    const r1 = deleteEvents.run(before);
    const r2 = deleteSessions.run(before);
    const r3 = deleteUsers.run(before);
    return {
      eventsDeleted: r1.changes,
      sessionsDeleted: r2.changes,
      usersDeleted: r3.changes,
    };
  });

  const result = tx();
  res.json({ ok: true, before, ...result });
});

app.post('/api/events', (req, res) => {
  const { userId, sessionId, name, payload, meta } = req.body || {};
  const ip = req.ip || '';
  if (limitHit(ipEventMap, ip, EVENT_IP_LIMIT, EVENT_WINDOW_MS)) {
    res.status(429).json({ ok: false });
    return;
  }
  if (sessionId && limitHit(sessionEventMap, String(sessionId), EVENT_SESSION_LIMIT, EVENT_WINDOW_MS)) {
    res.status(429).json({ ok: false });
    return;
  }
  if (!isValidClientId(String(userId || ''), 128) || !isValidClientId(String(sessionId || ''), 128) || !name) {
    res.status(400).json({ ok: false });
    return;
  }
  if (!isValidEventName(name)) {
    res.status(400).json({ ok: false });
    return;
  }
  let payloadSize = 0;
  try {
    payloadSize = JSON.stringify(payload ?? {}).length;
  } catch {
    res.status(400).json({ ok: false });
    return;
  }
  if (payloadSize > 5000) {
    res.status(413).json({ ok: false });
    return;
  }

  const now = new Date().toISOString();
  const locale = normalizeText(meta?.locale, 64);
  const userAgent = normalizeText(meta?.userAgent, 512) ?? normalizeText(req.get('user-agent'), 512);

  upsertUser.run({ userId, now, locale, userAgent });
  upsertSession.run({ sessionId, userId, now });
  insertEvent.run({
    userId,
    sessionId,
    name,
    payload: JSON.stringify(payload ?? {}),
    createdAt: now,
  });

  res.json({ ok: true });
});

app.post('/api/share', (req, res) => {
  const { snapshot } = req.body || {};
  const ip = req.ip || '';
  if (limitHit(ipShareMap, ip, SHARE_IP_LIMIT, SHARE_WINDOW_MS)) {
    res.status(429).json({ ok: false });
    return;
  }
  if (!isValidShareSnapshot(snapshot)) {
    res.status(400).json({ ok: false });
    return;
  }

  let serialized;
  try {
    serialized = JSON.stringify(snapshot);
  } catch {
    res.status(400).json({ ok: false });
    return;
  }
  if (serialized.length > 180 * 1024) {
    res.status(413).json({ ok: false });
    return;
  }

  const createdAt = new Date().toISOString();
  for (let i = 0; i < 5; i += 1) {
    const shareId = generateShareId();
    try {
      insertSharedList.run({ shareId, snapshot: serialized, createdAt });
      res.json({ ok: true, shareId });
      return;
    } catch {
      continue;
    }
  }

  res.status(500).json({ ok: false });
});

app.get('/api/share/:shareId', (req, res) => {
  const shareId = req.params.shareId;
  if (!isValidClientId(String(shareId || ''), 64)) {
    res.status(400).json({ ok: false });
    return;
  }

  const row = getSharedList.get(shareId);
  if (!row) {
    res.status(404).json({ ok: false });
    return;
  }

  const expiresAt = new Date(row.created_at);
  expiresAt.setDate(expiresAt.getDate() + SHARE_TTL_DAYS);
  if (Date.now() > expiresAt.getTime()) {
    try {
      deleteSharedListById.run(shareId);
    } catch {
      // Ignore deletion failures.
    }
    res.status(404).json({ ok: false });
    return;
  }

  try {
    const snapshot = JSON.parse(row.snapshot);
    res.json({ ok: true, snapshot });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.get('/api/admin/backup', requireAdmin, (req, res) => {
  if (!ENABLE_ADMIN_BACKUP) {
    res.status(404).json({ ok: false });
    return;
  }

  const days = clampInt(req.query?.days, 1, 3650, 90);
  const limit = clampInt(req.query?.limit, 0, 50000, 5000);
  const since = toIsoDaysAgo(days);

  try {
    const users = db
      .prepare(
        `SELECT user_id AS userId, first_seen AS firstSeen, last_seen AS lastSeen, locale, user_agent AS userAgent FROM users`
      )
      .all();
    const sessions = db
      .prepare(
        `SELECT session_id AS sessionId, user_id AS userId, started_at AS startedAt, last_seen AS lastSeen FROM sessions`
      )
      .all();
    const events = db
      .prepare(
        `SELECT id, user_id AS userId, session_id AS sessionId, name, payload, created_at AS createdAt FROM events WHERE created_at >= ? ORDER BY id DESC LIMIT ?`
      )
      .all(since, limit)
      .map(r => ({ ...r, payload: safeParseJson(r.payload) ?? {} }));
    const shared = db
      .prepare(`SELECT share_id AS shareId, created_at AS createdAt FROM shared_lists ORDER BY created_at DESC LIMIT 10000`)
      .all();

    res.json({
      ok: true,
      exportedAt: new Date().toISOString(),
      range: { days, since, until: new Date().toISOString() },
      counts: {
        users: users.length,
        sessions: sessions.length,
        events: events.length,
        sharedLists: shared.length,
      },
      users,
      sessions,
      events,
      shared,
    });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

const server = app.listen(port, () => {
  process.stdout.write(`analytics server running on ${port}`);
});

const shutdown = () => {
  clearInterval(cleanupTimer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
