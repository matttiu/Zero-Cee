// Zero Cee admin API — the only thing in this whole setup that ever
// talks to GitHub with write access. Routed at www.zerocee.ch/api/* (see
// wrangler.toml), so calls from /admin/ are same-origin.
import { verifyPassword, createSession, verifySession, checkRateLimit, recordFailedAttempt, clearRateLimit } from './auth.js';
import { getFile, putFile, listDirectory, commitBlob, GitHubError } from './github.js';
import { validateAbout, validateEvents, validateMusic, validatePhotos, CONTENT_TYPES } from './validate.js';
import { purgeCache } from './cache-purge.js';

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

function error(env, message, status = 400) {
  return json(env, { error: message }, status);
}

async function requireSession(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return false;
  return verifySession(token, env.SESSION_SECRET);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Strip the /api prefix the Worker route matches on.
    const path = url.pathname.replace(/^\/api/, '') || '/';
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    try {
      if (path === '/login' && method === 'POST') return handleLogin(request, env);
      if (path === '/me' && method === 'GET') return handleMe(request, env);

      const contentMatch = path.match(/^\/content\/([a-z]+)$/);
      if (contentMatch && method === 'GET') return handleGetContent(request, env, contentMatch[1]);
      if (contentMatch && method === 'PUT') return handlePutContent(request, env, contentMatch[1]);

      if (path === '/photos/upload' && method === 'POST') return handleUpload(request, env);
      if (path === '/music/resolve' && method === 'POST') return handleResolveMusic(request, env);

      const statusMatch = path.match(/^\/photos\/status\/([A-Za-z0-9_.-]+)$/);
      if (statusMatch && method === 'GET') return handlePhotoStatus(request, env, statusMatch[1]);

      return error(env, 'Not found', 404);
    } catch (err) {
      console.error(err);
      if (err instanceof GitHubError) return error(env, err.message, err.status === 409 ? 409 : 502);
      return error(env, 'Internal error', 500);
    }
  },
};

async function handleLogin(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await checkRateLimit(env.RATE_LIMIT_KV, ip))) {
    return error(env, 'Too many attempts. Please try again in a few minutes.', 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return error(env, 'Invalid request', 400);
  }

  const password = typeof body.password === 'string' ? body.password : '';
  const ok = password.length > 0 && (await verifyPassword(password, env.ADMIN_PASSWORD_SALT, env.ADMIN_PASSWORD_HASH));

  if (!ok) {
    await recordFailedAttempt(env.RATE_LIMIT_KV, ip);
    return error(env, 'Incorrect password', 401);
  }

  await clearRateLimit(env.RATE_LIMIT_KV, ip);
  const token = await createSession(env.SESSION_SECRET, Number(env.SESSION_TTL_SECONDS) || 43200);
  return json(env, { token });
}

async function handleMe(request, env) {
  if (!(await requireSession(request, env))) return error(env, 'Not authenticated', 401);
  return json(env, { ok: true });
}

async function handleGetContent(request, env, type) {
  if (!(await requireSession(request, env))) return error(env, 'Not authenticated', 401);
  if (!CONTENT_TYPES.includes(type)) return error(env, 'Unknown content type', 404);

  const { data, sha } = await getFile(env, `content/${type}.json`);
  return json(env, { data, sha });
}

async function handlePutContent(request, env, type) {
  if (!(await requireSession(request, env))) return error(env, 'Not authenticated', 401);
  if (!CONTENT_TYPES.includes(type)) return error(env, 'Unknown content type', 404);

  let body;
  try {
    body = await request.json();
  } catch {
    return error(env, 'Invalid request', 400);
  }
  const { data, sha } = body || {};
  if (!data || !sha) return error(env, 'Missing data or sha', 400);

  let validationError = null;
  if (type === 'about') validationError = validateAbout(data);
  else if (type === 'events') validationError = validateEvents(data);
  else if (type === 'music') validationError = validateMusic(data);
  else if (type === 'photos') {
    const current = await getFile(env, 'content/photos.json');
    validationError = validatePhotos(data, current.data.photos);
  }
  if (validationError) return error(env, validationError, 422);

  const result = await putFile(env, `content/${type}.json`, data, sha, `Update ${type} via admin panel`);
  await purgeCache(env, [`https://www.zerocee.ch/content/${type}.json`]);
  return json(env, { sha: result.sha });
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

function sniffImageExt(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'webp';
  return null;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function handleUpload(request, env) {
  if (!(await requireSession(request, env))) return error(env, 'Not authenticated', 401);

  let form;
  try {
    form = await request.formData();
  } catch {
    return error(env, 'Invalid upload', 400);
  }
  const file = form.get('photo');
  if (!file || typeof file === 'string') return error(env, 'No file provided', 400);
  if (file.size > MAX_UPLOAD_BYTES) return error(env, 'File too large (max 15MB)', 413);

  const buffer = await file.arrayBuffer();
  const ext = sniffImageExt(new Uint8Array(buffer));
  if (!ext) return error(env, 'File is not a recognized image (JPEG, PNG or WebP)', 422);

  // Server-generated name — never trust the client's filename.
  const name = `incoming-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const base64 = arrayBufferToBase64(buffer);

  await commitBlob(env, `photos/incoming/${name}`, base64, `Stage uploaded photo ${name} via admin panel`);
  return json(env, { name });
}

// Lets the friend paste just a SoundCloud track URL — resolves the
// numeric track ID (and a suggested title) via SoundCloud's public
// oEmbed endpoint instead of requiring them to find the ID by hand.
async function handleResolveMusic(request, env) {
  if (!(await requireSession(request, env))) return error(env, 'Not authenticated', 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return error(env, 'Invalid request', 400);
  }
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!/^https:\/\/(www\.)?soundcloud\.com\//.test(url)) {
    return error(env, 'Enter a valid SoundCloud track URL (https://soundcloud.com/...)', 422);
  }

  const oembedRes = await fetch(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`);
  if (!oembedRes.ok) return error(env, 'Could not find that SoundCloud track — check the link', 422);
  const oembed = await oembedRes.json();

  const match = /tracks%3A(\d+)|tracks\/(\d+)/.exec(oembed.html || '');
  const trackId = match ? match[1] || match[2] : null;
  if (!trackId) return error(env, 'Could not read a track ID from that link', 422);

  return json(env, { trackId, title: oembed.title || '', url });
}

async function handlePhotoStatus(request, env, name) {
  if (!(await requireSession(request, env))) return error(env, 'Not authenticated', 401);
  const listing = await listDirectory(env, 'photos/incoming');
  const pending = listing.some(f => f.name === name);
  return json(env, { pending });
}
