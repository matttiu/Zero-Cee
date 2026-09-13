# Zero Cee Admin — Worker Setup

This is the one-time setup for the admin panel at `/admin/`. It only needs
to be done once by you (the repo owner) — after this, your friend just
uses the admin page, never anything in this folder.

Nothing here is exposed to visitors: this Worker is the only thing that
holds the real GitHub write access, and everything sensitive below is
stored as a Cloudflare **secret**, never committed to this (public) repo.

## Prerequisites

- Node.js installed locally
- The Cloudflare account that already manages `zerocee.ch`'s DNS
- Admin access to the `matttiu/Zero-Cee` GitHub repo

## Steps

### 1. Install Wrangler and log in

```sh
npm install -g wrangler
wrangler login
```

### 2. Create a fine-grained GitHub token

GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token
- Repository access: **Only select repositories** → `Zero-Cee`
- Permissions: **Contents: Read and write** (nothing else)
- Set an expiration (e.g. 1 year) and put a reminder somewhere to rotate it —
  the admin panel will start failing silently once it expires.

Copy the generated token; you'll paste it in step 5.

### 3. Create the rate-limit KV namespace

From this `worker/` folder:

```sh
npm install
wrangler kv namespace create RATE_LIMIT_KV
```

Copy the `id` it prints into `wrangler.toml`'s `[[kv_namespaces]]` block,
replacing `REPLACE_WITH_KV_NAMESPACE_ID`. This id isn't sensitive — it's
fine to commit.

### 4. Find your Cloudflare Zone ID

Cloudflare dashboard → `zerocee.ch` → Overview (right sidebar) → **Zone ID**.
Paste it into `wrangler.toml`'s `CF_ZONE_ID`, replacing `REPLACE_WITH_ZONE_ID`.
Also not sensitive.

### 5. Set the Worker's secrets

Each of these prompts for a value and stores it in Cloudflare, never in the repo:

```sh
wrangler secret put GITHUB_TOKEN
# paste the fine-grained PAT from step 2

wrangler secret put SESSION_SECRET
# paste a fresh random value, e.g. generate one with:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

wrangler secret put ADMIN_PASSWORD_SALT
# paste a fresh random value, e.g.:
#   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Now compute the password hash using the salt you just set:

```sh
node scripts/hash-password.mjs <the-salt-you-used> "<the password you want your friend to use>"
```

```sh
wrangler secret put ADMIN_PASSWORD_HASH
# paste the output of the command above
```

Finally, create a Cloudflare API token scoped to **only** `Zone > Cache Purge > Purge`
for the `zerocee.ch` zone (Cloudflare dashboard → My Profile → API Tokens → Create Token),
and set it:

```sh
wrangler secret put CF_API_TOKEN
```

### 6. Deploy the Worker

```sh
wrangler deploy
```

Confirm in the Cloudflare dashboard (Workers & Pages → your worker → Triggers)
that the route `www.zerocee.ch/api/*` is attached.

### 7. Add a cache rule for `/content/*`

Cloudflare dashboard → `zerocee.ch` → Caching → Cache Rules → create a rule matching
URL path starting with `/content/` → set **Cache eligibility: Bypass cache** (or a short
edge TTL). Without this, a proxied stale copy of a `content/*.json` file could keep being
served past the ~1 minute GitHub Pages deploy.

### 8. Add GitHub Actions secrets (separate from the Worker's secrets above)

Repo → Settings → Secrets and variables → **Actions** → add:
- `CF_API_TOKEN` — can reuse the same cache-purge-only token from step 5
- `CF_ZONE_ID` — same zone id from step 4

These are used only by `.github/workflows/process-incoming-photos.yml`'s final
cache-purge step.

### 9. Share the admin URL with your friend

`https://www.zerocee.ch/admin/` plus the password you chose in step 5 —
ideally shared somewhere other than plaintext email (a password manager
share, or a messaging app you both already trust).

## Local development

```sh
cp .dev.vars.example .dev.vars   # fill in test values — this file is gitignored
wrangler dev
```

Point `worker/.dev.vars` at a disposable test repo/branch (not the real
`matttiu/Zero-Cee` `main`) while iterating, so test edits don't hit the
live site.

## Rotating the password or token later

- **Password**: pick a new one, run `hash-password.mjs` again with the same salt,
  `wrangler secret put ADMIN_PASSWORD_HASH` with the new output.
- **GitHub token**: generate a new fine-grained token (step 2), then
  `wrangler secret put GITHUB_TOKEN` with the new value, then revoke the old one
  on GitHub.
