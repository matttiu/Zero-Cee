#!/usr/bin/env node
// One-off local helper: prints the PBKDF2 hash that ADMIN_PASSWORD_HASH
// must be set to for a given salt + password (see ../README.md, step 5).
// This script contains no secret itself — it only computes one when run,
// using the exact same PBKDF2 parameters as worker/src/auth.js.
//
// 1. Generate a random salt (once):
//      node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
// 2. Compute the hash for your chosen password:
//      node scripts/hash-password.mjs <salt-hex> "<password>"
// 3. `wrangler secret put ADMIN_PASSWORD_SALT` (paste the salt from step 1)
//    `wrangler secret put ADMIN_PASSWORD_HASH` (paste the hash this prints)
import { webcrypto as crypto } from 'node:crypto';

const [, , saltHex, password] = process.argv;
if (!saltHex || !password) {
  console.error('Usage: node hash-password.mjs <salt-hex> <password>');
  process.exit(1);
}

const ITERATIONS = 100000;

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

const keyMaterial = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(password),
  { name: 'PBKDF2' },
  false,
  ['deriveBits']
);
const bits = await crypto.subtle.deriveBits(
  { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: ITERATIONS, hash: 'SHA-256' },
  keyMaterial,
  256
);

console.log(bytesToHex(new Uint8Array(bits)));
