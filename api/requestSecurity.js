import crypto from 'node:crypto';

// Forwarded headers are client-controlled unless a deployment has verified its proxy chain.
export function requestPeerAddress(req) {
  return typeof req.socket?.remoteAddress === 'string' && req.socket.remoteAddress
    ? req.socket.remoteAddress
    : 'unknown';
}

export function adminTokenMatches(expected, supplied) {
  if (typeof expected !== 'string' || typeof supplied !== 'string' || !expected || !supplied) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(supplied, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
