#!/usr/bin/env node

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value.replace(/\/+$/, '');
};

const optional = (name) => {
  const value = process.env[name]?.trim();
  return value ? value.replace(/\/+$/, '') : '';
};

const BACKEND_URL = required('BACKEND_URL');
const FRONTEND_URL = optional('FRONTEND_URL');

const results = [];

const check = async (name, fn) => {
  try {
    await fn();
    results.push({ name, ok: true });
    process.stdout.write(`PASS: ${name}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, message });
    process.stdout.write(`FAIL: ${name} -> ${message}\n`);
  }
};

const ensureOkJson = async (res, context) => {
  if (!res.ok) {
    throw new Error(`${context} HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!data || data.ok !== true) {
    throw new Error(`${context} payload not ok=true`);
  }
  return data;
};

await check('backend health', async () => {
  const res = await fetch(`${BACKEND_URL}/api/health`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data?.ok !== true) throw new Error('health payload not ok=true');
});

await check('share create/get roundtrip', async () => {
  const now = new Date().toISOString();
  const snapshot = {
    schemaVersion: 1,
    id: `smoke-${Date.now()}`,
    updatedAt: now,
    ui: { step: 1, activeCategory: 'ALL', sortBy: 'default' },
    trip: {
      destination: 'Tokyo',
      startDate: '2026-02-12',
      endDate: '2026-02-15',
      duration: 4,
      country: 'JP',
      direction: 'OUTBOUND',
    },
    items: [],
    tasks: [],
    packedItemIds: [],
    customRules: [],
  };

  const createRes = await fetch(`${BACKEND_URL}/api/share`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ snapshot }),
  });
  const createData = await ensureOkJson(createRes, 'share create');
  const shareId = createData.shareId;
  if (!shareId || typeof shareId !== 'string') {
    throw new Error('shareId missing');
  }

  const getRes = await fetch(`${BACKEND_URL}/api/share/${encodeURIComponent(shareId)}`);
  const getData = await ensureOkJson(getRes, 'share get');
  if (getData?.snapshot?.id !== snapshot.id) {
    throw new Error('snapshot id mismatch');
  }
});

if (FRONTEND_URL) {
  await check('frontend reachable', async () => {
    const res = await fetch(FRONTEND_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.includes('<html')) {
      throw new Error('frontend response is not html');
    }
  });

  await check('cors allow frontend origin', async () => {
    const res = await fetch(`${BACKEND_URL}/api/events`, {
      method: 'OPTIONS',
      headers: {
        Origin: FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    if (!(res.status === 204 || res.status === 200)) {
      throw new Error(`preflight HTTP ${res.status}`);
    }
    const allowed = res.headers.get('access-control-allow-origin');
    if (!(allowed === FRONTEND_URL || allowed === '*')) {
      throw new Error(`allow-origin mismatch: ${allowed || 'empty'}`);
    }
  });
}

const failed = results.filter((r) => !r.ok);
process.stdout.write('\n=== Smoke Summary ===\n');
for (const r of results) {
  process.stdout.write(`- ${r.ok ? 'PASS' : 'FAIL'} ${r.name}\n`);
}
if (failed.length > 0) {
  process.exitCode = 1;
  process.stdout.write('\nDeployment smoke failed.\n');
} else {
  process.stdout.write('\nDeployment smoke passed.\n');
}
