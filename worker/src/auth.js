// Password verification, session tokens, and login rate limiting.
// No secrets live in this file — they're passed in via `env` (Worker
// secrets set with `wrangler secret put`, never committed to the repo).

const PBKDF2_ITERATIONS = 100000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_SECONDS = 900; // 15 minutes

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2Hash(password, saltHex) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function verifyPassword(password, saltHex, expectedHashHex) {
  const computed = await pbkdf2Hash(password, saltHex);
  return constantTimeEqual(computed, expectedHashHex);
}

// ---- Session tokens: base64url(payload) + "." + base64url(HMAC-SHA256(payload)) ----

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function base64urlEncode(bytes) {
  let str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function createSession(secret, ttlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();
  const payloadBytes = new TextEncoder().encode(JSON.stringify({ iat: now, exp: now + ttlSeconds, jti }));
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, payloadBytes);
  return `${base64urlEncode(payloadBytes)}.${base64urlEncode(new Uint8Array(sig))}`;
}

// Returns the decoded payload ({ iat, exp, jti }) for a valid, unexpired
// token, or null otherwise. Callers that only check truthiness keep working
// unchanged since an object is truthy and null is falsy.
export async function verifySession(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadPart, sigPart] = token.split('.');
  if (!payloadPart || !sigPart) return null;

  let payloadBytes, sigBytes;
  try {
    payloadBytes = base64urlDecode(payloadPart);
    sigBytes = base64urlDecode(sigPart);
  } catch {
    return null;
  }

  const key = await importHmacKey(secret);
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, payloadBytes);
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---- Session revocation (KV-backed, keyed by the session's jti) ----
// HMAC session tokens are stateless by design, so "log out" alone can't
// invalidate a copy of one that's already out in the world. This lets the
// server actively kill one specific session (used on logout) by remembering
// its jti in KV until the token would have expired anyway.

export async function isSessionRevoked(kv, jti) {
  if (!jti) return false;
  return (await kv.get(`revoked:${jti}`)) !== null;
}

export async function revokeSession(kv, jti, ttlSeconds) {
  if (!jti) return;
  await kv.put(`revoked:${jti}`, '1', { expirationTtl: Math.max(Math.ceil(ttlSeconds), 60) });
}

// ---- Login rate limiting (KV-backed, per IP) ----
// A second, config-only layer (a Cloudflare dashboard Rate Limiting rule
// on /api/login) is recommended in addition to this — see worker/README.md.

export async function checkRateLimit(kv, ip) {
  const raw = await kv.get(`login-attempts:${ip}`);
  const count = raw ? parseInt(raw, 10) : 0;
  return count < MAX_LOGIN_ATTEMPTS;
}

export async function recordFailedAttempt(kv, ip) {
  const key = `login-attempts:${ip}`;
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  await kv.put(key, String(count + 1), { expirationTtl: LOGIN_WINDOW_SECONDS });
}

export async function clearRateLimit(kv, ip) {
  await kv.delete(`login-attempts:${ip}`);
}
