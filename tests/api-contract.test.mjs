import test from 'node:test';
import assert from 'node:assert/strict';

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ADMIN_TOKEN', 'ALLOWED_ORIGIN', 'NODE_ENV'];

const snapshotEnv = () => {
  const snapshot = {};
  for (const key of ENV_KEYS) snapshot[key] = process.env[key];
  return snapshot;
};

const restoreEnv = (snapshot) => {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

const withServer = async (app, run) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

const loadAppWithEnv = async (nextEnv) => {
  const prev = snapshotEnv();
  try {
    for (const key of ENV_KEYS) delete process.env[key];
    Object.assign(process.env, nextEnv);
    const mod = await import(`../api/index.js?case=${Date.now()}-${Math.random()}`);
    return mod.default;
  } finally {
    restoreEnv(prev);
  }
};

test('api health returns 503 + readable code when backend env is missing', async () => {
  const app = await loadAppWithEnv({});

  await withServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 503);
    const payload = await res.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.code, 'BACKEND_MISCONFIGURED');
  });
});

test('api non-health endpoint returns 503 (not 500) when backend env is missing', async () => {
  const app = await loadAppWithEnv({});

  await withServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'u1', sessionId: 's1', name: 'evt' }),
    });
    assert.equal(res.status, 503);
    const payload = await res.json();
    assert.equal(payload.code, 'BACKEND_MISCONFIGURED');
  });
});

test('api health returns 200 when backend env exists', async () => {
  const app = await loadAppWithEnv({
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'dummy-service-role-key',
  });

  await withServer(app, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const payload = await res.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.provider, 'supabase');
  });
});
