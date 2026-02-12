import { createClient } from '@supabase/supabase-js';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

// --- Supabase Config ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ Supply SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run the backend.');
}

// Initialize Supabase Client (Service Role for backend operations)
const supabase = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_ROLE_KEY || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// --- App Config ---
const app = express();
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const EVENT_IP_LIMIT = Number(process.env.EVENT_IP_LIMIT || '120');
const EVENT_SESSION_LIMIT = Number(process.env.EVENT_SESSION_LIMIT || '60');
const EVENT_WINDOW_MS = Number(process.env.EVENT_WINDOW_MS || '60000');
const SHARE_IP_LIMIT = Number(process.env.SHARE_IP_LIMIT || '30');
const SHARE_WINDOW_MS = Number(process.env.SHARE_WINDOW_MS || '60000');
const SHARE_TTL_DAYS = clampInt(process.env.SHARE_TTL_DAYS, 1, 365, 30);

// In-memory rate limiting (Note: In Serverless, this is per-instance and ephemeral)
// Ideally, use a Redis or Supabase table for distributed rate limiting.
// For now, keeping in-memory as a simple safeguard against burst traffic on a single instance.
const ipEventMap = new Map();
const sessionEventMap = new Map();
const ipShareMap = new Map();

function clampInt(value, min, max, fallback) {
  const n = parseInt(String(value), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
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
  // Allow local dev bypass if needed, but safer to always require token
  if (process.env.NODE_ENV !== 'production' && req.hostname === 'localhost') {
    next();
    return;
  }
  res.status(401).json({ ok: false });
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

// --- Middleware ---
app.use(cors({
  origin: (origin, cb) => {
    // Basic CORS allowing all for now or check process.env.ALLOWED_ORIGIN
    // Vercel handles some of this, but express content type options are good
    cb(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-admin-token'],
}));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(express.json({ limit: '256kb' }));

// --- Routes ---

app.get('/api/health', (req, res) => {
  res.json({ ok: true, provider: 'supabase' });
});

// Admin Metrics - Replaced complex SQL with RPC calls
app.get('/api/admin/metrics', requireAdmin, async (req, res) => {
  const days = clampInt(req.query?.days, 1, 180, 30);
  
  try {
    const [
      { data: dailyActive },
      { data: topEvents },
      { data: funnel },
      { data: topDestinations },
      { data: searchTerms },
      { data: templateUsage },
      { data: riskKpi } // new RPC needed or fetch partially
    ] = await Promise.all([
      supabase.rpc('get_daily_metrics', { p_days: days }),
      supabase.rpc('get_top_events', { p_days: days, p_limit: 30 }),
      supabase.rpc('get_funnel_stats', { p_days: days }),
      supabase.rpc('get_top_destinations', { p_days: days, p_limit: 20 }),
      supabase.rpc('get_top_search_terms', { p_days: days, p_limit: 20 }),
      supabase.rpc('get_template_usage', { p_days: days, p_limit: 20 }),
      // Risk KPI logic can be moved to RPC or keep simple counts if volume is low.
      Promise.resolve({ data: {} }) 
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
      riskKpi: riskKpi || {} // Placeholder until full RPC implemented
    });

  } catch (err) {
    console.error('Metrics Error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/admin/recent-events', requireAdmin, async (req, res) => {
  const limit = clampInt(req.query?.limit, 1, 500, 100);
  const name = typeof req.query?.name === 'string' ? req.query.name.trim() : null;
  const q = typeof req.query?.q === 'string' ? req.query.q.trim() : null;
  const sinceRaw = req.query?.since;
  const since = typeof sinceRaw === 'string' && !isNaN(Date.parse(sinceRaw)) ? sinceRaw : null;

  const { data, error } = await supabase.rpc('get_recent_events', {
    p_limit: limit,
    p_name: name || null,
    p_q: q || null,
    p_since: since
  });

  if (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }

  // Postgres returns snake_case columns usually unless aliased. 
  // Our RPC aliases them to camelCase.
  res.json({ ok: true, events: data });
});

app.post('/api/events', async (req, res) => {
  const { userId, sessionId, name, payload, meta } = req.body || {};
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

  // Simple Rate Limit Check
  if (limitHit(ipEventMap, ip, EVENT_IP_LIMIT, EVENT_WINDOW_MS)) {
    return res.status(429).json({ ok: false });
  }
  
  if (!isValidClientId(userId) || !isValidClientId(sessionId) || !isValidEventName(name)) {
    return res.status(400).json({ ok: false });
  }

  const locale = normalizeText(meta?.locale, 64);
  const userAgent = normalizeText(meta?.userAgent, 512) || normalizeText(req.get('user-agent'), 512);

  // Parallel Execution
  const p1 = supabase.rpc('upsert_user', { 
    p_user_id: userId, 
    p_locale: locale, 
    p_user_agent: userAgent 
  });
  
  const p2 = supabase.rpc('upsert_session', { 
    p_session_id: sessionId, 
    p_user_id: userId 
  });

  const p3 = supabase.from('events').insert({
    user_id: userId,
    session_id: sessionId,
    name,
    payload: payload || {}, // JSONB handles object directly
  });

  // We don't await strictly for p1/p2 to fail p3, but usually we want consistency.
  // Using Promise.allSettled or just all.
  await Promise.all([p1, p2, p3]);

  res.json({ ok: true });
});

app.post('/api/share', async (req, res) => {
  const { snapshot } = req.body || {};
  const ip = req.headers['x-forwarded-for'] || '';

  if (limitHit(ipShareMap, ip, SHARE_IP_LIMIT, SHARE_WINDOW_MS)) {
    return res.status(429).json({ ok: false });
  }

  // (Optional) Re-validate snapshot structure here

  let serialized = snapshot; // Postgres JSONB can take object, no need to stringify if using client
  
  const shareId = generateShareId();
  
  const { error } = await supabase.from('shared_lists').insert({
    share_id: shareId,
    snapshot: serialized
  });

  if (error) {
    console.error('Share Error', error);
    return res.status(500).json({ ok: false });
  }

  res.json({ ok: true, shareId });
});

app.get('/api/share/:shareId', async (req, res) => {
  const { shareId } = req.params;
  if (!isValidClientId(shareId, 64)) return res.status(400).json({ ok: false });

  const { data, error } = await supabase
    .from('shared_lists')
    .select('snapshot, created_at')
    .eq('share_id', shareId)
    .single();

  if (error || !data) {
    return res.status(404).json({ ok: false });
  }

  // Check TTL
  const created = new Date(data.created_at);
  const expiry = new Date(created.getTime() + (SHARE_TTL_DAYS * 24 * 60 * 60 * 1000));
  
  if (Date.now() > expiry.getTime()) {
    // Lazy delete
    await supabase.from('shared_lists').delete().eq('share_id', shareId);
    return res.status(404).json({ ok: false });
  }

  res.json({ ok: true, snapshot: data.snapshot });
});

// Cleanup Endpoint (Cron Job can call this)
app.post('/api/admin/cleanup', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.rpc('cleanup_old_data', {
    p_share_ttl_days: SHARE_TTL_DAYS,
    p_event_retention_days: 180
  });
  
  if (error) return res.status(500).json({ ok: false, error: error.message });
  res.json({ ok: true, result: data });
});

// For Vercel Serverless, we export the app
export default app;
