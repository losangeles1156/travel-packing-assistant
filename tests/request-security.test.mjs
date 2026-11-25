import test from 'node:test';
import assert from 'node:assert/strict';
import { adminTokenMatches, requestPeerAddress } from '../api/requestSecurity.js';

test('rate limit peer address ignores spoofed forwarding headers', () => {
  const req = { socket: { remoteAddress: '203.0.113.10' }, headers: { 'x-forwarded-for': '127.0.0.1', 'x-real-ip': '127.0.0.1' } };
  assert.equal(requestPeerAddress(req), '203.0.113.10');
  assert.equal(requestPeerAddress({ headers: {} }), 'unknown');
});

test('admin access requires a nonempty exact token', () => {
  assert.equal(adminTokenMatches('', ''), false);
  assert.equal(adminTokenMatches('secret', 'secret'), true);
  assert.equal(adminTokenMatches('secret', 'secreT'), false);
  assert.equal(adminTokenMatches('secret', 'secret-extra'), false);
  assert.equal(adminTokenMatches('secret', undefined), false);
});
