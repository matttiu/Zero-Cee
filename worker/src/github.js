// Every GitHub write the admin panel makes goes through here. Small JSON
// files use the simple Contents API (with sha-based optimistic
// concurrency); photo uploads use the four-call Git Data API sequence
// since raw phone photos routinely exceed the Contents API's ~1MB
// reliable ceiling.

const API_BASE = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function headers(env, extra = {}) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'User-Agent': 'zerocee-admin-worker',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  };
}

function decodeBase64Utf8(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}

function encodeBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Reads a small JSON file from the repo. Returns { data, sha }. */
export async function getFile(env, path) {
  const url = `${API_BASE}/repos/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH}`;
  // cacheTtl 0: the sha read here is what the next write is checked against,
  // so an edge-cached response would hand back a stale sha and turn every
  // save into a spurious "content changed elsewhere" conflict.
  const res = await fetch(url, { headers: headers(env), cf: { cacheTtl: 0 } });
  if (!res.ok) throw new GitHubError(`Failed to read ${path} (GitHub ${res.status})`, res.status);
  const json = await res.json();
  if (json.encoding !== 'base64' || typeof json.content !== 'string') {
    throw new GitHubError(`Unexpected response reading ${path}`, 502);
  }
  return { data: JSON.parse(decodeBase64Utf8(json.content)), sha: json.sha };
}

/** Writes a small JSON file back via the Contents API, sha-checked. */
export async function putFile(env, path, data, sha, message) {
  const url = `${API_BASE}/repos/${env.GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: headers(env, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      message,
      content: encodeBase64Utf8(JSON.stringify(data, null, 2) + '\n'),
      sha,
      branch: env.GITHUB_BRANCH,
      committer: { name: env.COMMIT_AUTHOR_NAME, email: env.COMMIT_AUTHOR_EMAIL },
    }),
  });
  if (res.status === 409 || res.status === 422) {
    throw new GitHubError('Content changed elsewhere — please reload and try again', 409);
  }
  if (res.status === 403 || res.status === 404) {
    // 404 on a write to a file we just read means the token can read but not
    // write — GitHub hides write-denied as "not found" on fine-grained PATs.
    throw new GitHubError(
      `GitHub refused the write (${res.status}) — the GITHUB_TOKEN secret needs Contents: read and write on ${env.GITHUB_REPO}`,
      res.status
    );
  }
  if (!res.ok) throw new GitHubError(`Failed to write ${path} (GitHub ${res.status})`, res.status);
  const json = await res.json();
  return { sha: json.content.sha };
}

/** Lists a directory's entries (name/sha/size/type) without fetching content. */
export async function listDirectory(env, dirPath) {
  const url = `${API_BASE}/repos/${env.GITHUB_REPO}/contents/${dirPath}?ref=${env.GITHUB_BRANCH}`;
  const res = await fetch(url, { headers: headers(env) });
  if (res.status === 404) return [];
  if (!res.ok) throw new GitHubError(`Failed to list ${dirPath}`, res.status);
  return res.json();
}

/**
 * Commits a binary file via the Git Data API (blob -> tree -> commit -> ref),
 * used for photo uploads which can exceed the Contents API's size ceiling.
 * `base64Content` is the file's raw bytes, base64-encoded.
 */
export async function commitBlob(env, path, base64Content, message) {
  const h = headers(env, { 'Content-Type': 'application/json' });

  const blobRes = await fetch(`${API_BASE}/repos/${env.GITHUB_REPO}/git/blobs`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ content: base64Content, encoding: 'base64' }),
  });
  if (!blobRes.ok) throw new GitHubError('Failed to create blob', blobRes.status);
  const blob = await blobRes.json();

  const refRes = await fetch(`${API_BASE}/repos/${env.GITHUB_REPO}/git/ref/heads/${env.GITHUB_BRANCH}`, { headers: h });
  if (!refRes.ok) throw new GitHubError('Failed to read branch ref', refRes.status);
  const ref = await refRes.json();
  const baseCommitSha = ref.object.sha;

  const baseCommitRes = await fetch(`${API_BASE}/repos/${env.GITHUB_REPO}/git/commits/${baseCommitSha}`, { headers: h });
  if (!baseCommitRes.ok) throw new GitHubError('Failed to read base commit', baseCommitRes.status);
  const baseCommit = await baseCommitRes.json();

  const treeRes = await fetch(`${API_BASE}/repos/${env.GITHUB_REPO}/git/trees`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: [{ path, mode: '100644', type: 'blob', sha: blob.sha }],
    }),
  });
  if (!treeRes.ok) throw new GitHubError('Failed to create tree', treeRes.status);
  const tree = await treeRes.json();

  const commitRes = await fetch(`${API_BASE}/repos/${env.GITHUB_REPO}/git/commits`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [baseCommitSha],
      committer: { name: env.COMMIT_AUTHOR_NAME, email: env.COMMIT_AUTHOR_EMAIL },
    }),
  });
  if (!commitRes.ok) throw new GitHubError('Failed to create commit', commitRes.status);
  const commit = await commitRes.json();

  const updateRefRes = await fetch(`${API_BASE}/repos/${env.GITHUB_REPO}/git/refs/heads/${env.GITHUB_BRANCH}`, {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  if (!updateRefRes.ok) {
    throw new GitHubError('Branch moved while uploading — please try again', updateRefRes.status);
  }

  return { sha: commit.sha };
}
