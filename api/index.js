import { createClient } from '@supabase/supabase-js';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const EVENT_IP_LIMIT = Number(process.env.EVENT_IP_LIMIT || '120');
const EVENT_SESSION_LIMIT = Number(process.env.EVENT_SESSION_LIMIT || '60');
const EVENT_WINDOW_MS = Number(process.env.EVENT_WINDOW_MS || '60000');
const SHARE_IP_LIMIT = Number(process.env.SHARE_IP_LIMIT || '30');
const SHARE_WINDOW_MS = Number(process.env.SHARE_WINDOW_MS || '60000');
const SHARE_TTL_DAYS = clampInt(process.env.SHARE_TTL_DAYS, 1, 365, 30);

const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

const backendConfig = validateBackendConfig(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
let supabase = null;
let supabaseInitError = null;

if (backendConfig.ok) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } catch (error) {
    supabaseInitError = error instanceof Error ? error.message : String(error);
    console.error('Failed to initialize Supabase client:', supabaseInitError);
  }
} else {
  console.warn(
    `Backend misconfigured. missing=[${backendConfig.missing.join(',')}] invalid=[${backendConfig.invalid.join(',')}]`
  );
}

const backendReady = backendConfig.ok && !!supabase && !supabaseInitError;

const app = express();
const api = express.Router();

const ipEventMap = new Map();
const sessionEventMap = new Map();
const ipShareMap = new Map();

function clampInt(value, min, max, fallback) {
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function validateBackendConfig(url, key) {
  const missing = [];
  const invalid = [];

  if (!url) {
    missing.push('SUPABASE_URL');
  } else {
    try {
      // eslint-disable-next-line no-new
      new URL(url);
    } catch {
      invalid.push('SUPABASE_URL');
    }
  }

  if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}

function buildMisconfiguredPayload() {
  return {
    ok: false,
    code: 'BACKEND_MISCONFIGURED',
    message: 'Supabase environment variables are missing or invalid.',
    missing: backendConfig.missing,
    invalid: backendConfig.invalid,
  };
}

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.length === 0) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

const tokensEqual = (a, b) => {
  if (!a || !b) return false;
  const aa = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
};

const requireAdmin = (req, res, next) => {
  const headerToken = req.get('x-admin-token') || '';
  if (ADMIN_TOKEN && tokensEqual(headerToken, ADMIN_TOKEN)) {
    next();
    return;
  }
  if (process.env.NODE_ENV !== 'production' && req.hostname === 'localhost') {
    next();
    return;
  }
  res.status(401).json({ ok: false, code: 'UNAUTHORIZED' });
};

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

const isValidClientId = (value, max = 128) => {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > max) return false;
  return /^[a-zA-Z0-9_.:-]+$/.test(value);
};

const isValidEventName = (name) => {
  if (typeof name !== 'string') return false;
  if (name.length === 0 || name.length > 64) return false;
  return /^[a-zA-Z0-9_.:-]+$/.test(name);
};

const normalizeText = (value, max) => {
  if (typeof value !== 'string') return null;
  const next = value.trim();
  if (!next) return null;
  return next.slice(0, max);
};

const generateShareId = () => crypto.randomBytes(9).toString('base64url');

const getRequestIp = (req) => {
  const raw = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if (Array.isArray(raw)) return raw[0] || 'unknown';
  return String(raw).split(',')[0].trim() || 'unknown';
};

app.use(
  cors({
    origin: (origin, cb) => {
      cb(null, isOriginAllowed(origin));
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

api.get('/health', (_req, res) => {
  if (!backendReady) {
    res.status(503).json({
      ...buildMisconfiguredPayload(),
      provider: 'supabase',
    });
    return;
  }
  res.json({ ok: true, provider: 'supabase' });
});

api.use((req, res, next) => {
  if (req.path === '/health') {
    next();
    return;
  }
  if (!backendReady) {
    res.status(503).json(buildMisconfiguredPayload());
    return;
  }
  next();
});

api.get('/admin/metrics', requireAdmin, async (req, res) => {
  const days = clampInt(req.query?.days, 1, 180, 30);

  try {
    const [
      { data: dailyActive },
      { data: topEvents },
      { data: funnel },
      { data: topDestinations },
      { data: searchTerms },
      { data: templateUsage },
      { data: riskKpi },
    ] = await Promise.all([
      supabase.rpc('get_daily_metrics', { p_days: days }),
      supabase.rpc('get_top_events', { p_days: days, p_limit: 30 }),
      supabase.rpc('get_funnel_stats', { p_days: days }),
      supabase.rpc('get_top_destinations', { p_days: days, p_limit: 20 }),
      supabase.rpc('get_top_search_terms', { p_days: days, p_limit: 20 }),
      supabase.rpc('get_template_usage', { p_days: days, p_limit: 20 }),
      supabase.rpc('get_risk_kpi', { p_days: days }),
    ]);

    res.json({
      ok: true,
      range: { days, until: new Date().toISOString() },
      dailyActive: dailyActive || [],
      topEvents: topEvents || [],
      funnel: funnel || {},
      topDestinations: topDestinations || [],
      topSearchTerms: searchTerms || [],
      templateUsage: templateUsage || {},
      riskKpi: riskKpi || {},
    });
  } catch (err) {
    console.error('Metrics Error:', err);
    res.status(500).json({ ok: false, code: 'ADMIN_METRICS_FAILED' });
  }
});

api.get('/admin/recent-events', requireAdmin, async (req, res) => {
  const limit = clampInt(req.query?.limit, 1, 500, 100);
  const name = typeof req.query?.name === 'string' ? req.query.name.trim() : null;
  const q = typeof req.query?.q === 'string' ? req.query.q.trim() : null;
  const sinceRaw = req.query?.since;
  const since = typeof sinceRaw === 'string' && !Number.isNaN(Date.parse(sinceRaw)) ? sinceRaw : null;

  const { data, error } = await supabase.rpc('get_recent_events', {
    p_limit: limit,
    p_name: name || null,
    p_q: q || null,
    p_since: since,
  });

  if (error) {
    return res.status(500).json({ ok: false, code: 'ADMIN_RECENT_EVENTS_FAILED' });
  }

  res.json({ ok: true, events: data || [] });
});

api.post('/events', async (req, res) => {
  const { userId, sessionId, name, payload, meta } = req.body || {};
  const ip = getRequestIp(req);

  if (limitHit(ipEventMap, ip, EVENT_IP_LIMIT, EVENT_WINDOW_MS)) {
    return res.status(429).json({ ok: false, code: 'RATE_LIMITED' });
  }

  const sessionKey = `${userId || ''}:${sessionId || ''}`;
  if (limitHit(sessionEventMap, sessionKey, EVENT_SESSION_LIMIT, EVENT_WINDOW_MS)) {
    return res.status(429).json({ ok: false, code: 'SESSION_RATE_LIMITED' });
  }

  if (!isValidClientId(userId) || !isValidClientId(sessionId) || !isValidEventName(name)) {
    return res.status(400).json({ ok: false, code: 'INVALID_EVENT_PAYLOAD' });
  }

  const locale = normalizeText(meta?.locale, 64);
  const userAgent = normalizeText(meta?.userAgent, 512) || normalizeText(req.get('user-agent'), 512);

  const [userUpsert, sessionUpsert, eventInsert] = await Promise.all([
    supabase.rpc('upsert_user', {
      p_user_id: userId,
      p_locale: locale,
      p_user_agent: userAgent,
    }),
    supabase.rpc('upsert_session', {
      p_session_id: sessionId,
      p_user_id: userId,
    }),
    supabase.from('events').insert({
      user_id: userId,
      session_id: sessionId,
      name,
      payload: payload || {},
    }),
  ]);

  if (userUpsert.error || sessionUpsert.error || eventInsert.error) {
    console.error('Event write failed', {
      userError: userUpsert.error?.message,
      sessionError: sessionUpsert.error?.message,
      eventError: eventInsert.error?.message,
    });
    return res.status(500).json({ ok: false, code: 'EVENT_WRITE_FAILED' });
  }

  res.json({ ok: true });
});

api.post('/share', async (req, res) => {
  const { snapshot } = req.body || {};
  const ip = getRequestIp(req);

  if (limitHit(ipShareMap, ip, SHARE_IP_LIMIT, SHARE_WINDOW_MS)) {
    return res.status(429).json({ ok: false, code: 'RATE_LIMITED' });
  }

  const shareId = generateShareId();

  const { error } = await supabase.from('shared_lists').insert({
    share_id: shareId,
    snapshot,
  });

  if (error) {
    console.error('Share Error', error);
    return res.status(500).json({ ok: false, code: 'SHARE_CREATE_FAILED' });
  }

  res.json({ ok: true, shareId });
});

api.get('/share/:shareId', async (req, res) => {
  const { shareId } = req.params;
  if (!isValidClientId(shareId, 64)) return res.status(400).json({ ok: false, code: 'INVALID_SHARE_ID' });

  const { data, error } = await supabase.from('shared_lists').select('snapshot, created_at').eq('share_id', shareId).single();

  if (error || !data) {
    return res.status(404).json({ ok: false, code: 'SHARE_NOT_FOUND' });
  }

  const created = new Date(data.created_at);
  const expiry = new Date(created.getTime() + SHARE_TTL_DAYS * 24 * 60 * 60 * 1000);

  if (Date.now() > expiry.getTime()) {
    await supabase.from('shared_lists').delete().eq('share_id', shareId);
    return res.status(404).json({ ok: false, code: 'SHARE_EXPIRED' });
  }

  res.json({ ok: true, snapshot: data.snapshot });
});

api.post('/admin/cleanup', requireAdmin, async (_req, res) => {
  const { data, error } = await supabase.rpc('cleanup_old_data', {
    p_share_ttl_days: SHARE_TTL_DAYS,
    p_event_retention_days: 180,
  });

  if (error) return res.status(500).json({ ok: false, code: 'ADMIN_CLEANUP_FAILED' });
  res.json({ ok: true, result: data });
});

app.get('/api/test-direct', (req, res) => {
  res.json({ ok: true, message: 'Direct Express response' });
});

app.use('/api', api);
app.use('/', api);

// 404 handler for debugging
app.use((req, res) => {
  console.log(`404 at ${req.url}`);
  res.status(404).json({ error: 'not_found', path: req.url });
});

export default app;
