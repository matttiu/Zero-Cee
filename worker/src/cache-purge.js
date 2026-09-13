// Best-effort Cloudflare edge cache purge so a freshly-committed
// content/*.json doesn't keep serving stale data from the CDN edge
// after a successful write. Never throws — a purge failure must not
// fail the user-facing save request.
export async function purgeCache(env, urls) {
  if (!env.CF_API_TOKEN || !env.CF_ZONE_ID) return;
  try {
    await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/purge_cache`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files: urls }),
    });
  } catch (err) {
    console.error('Cache purge failed (non-fatal):', err);
  }
}
