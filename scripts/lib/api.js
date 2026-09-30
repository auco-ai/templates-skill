/**
 * Client for Auco's public template API (/v1.5/ext/template).
 *
 * Two keys per company and environment, and they are not interchangeable:
 *   - GET  (list, read)   -> public key  (puk_)
 *   - POST / PUT (write)  -> private key (prk_)
 * The API resolves the company from the key, so each key only sees and edits
 * that company's templates.
 *
 * Keys are looked up as AUCO_{PUK|PRK}_{ENV}[_{CLIENT}], e.g. AUCO_PRK_PROD or AUCO_PRK_PROD_ACME,
 * first in the process environment and then in the first keys file found:
 *   $AUCO_KEYS_FILE, ./.env.api, ~/.auco/keys.env
 * They are never taken from the command line and never printed.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = {
  dev: 'https://dev.auco.ai/v1.5/ext/template',
  prod: 'https://api.auco.ai/v1.5/ext/template'
};

const keyFiles = () =>
  [process.env.AUCO_KEYS_FILE, path.resolve('.env.api'), path.join(os.homedir(), '.auco', 'keys.env')]
    .filter(Boolean)
    .filter((f) => fs.existsSync(f));

const parseEnvFile = (file) =>
  Object.fromEntries(
    fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')])
  );

const varName = (kind, env, client) =>
  ['AUCO', kind, env, client].filter(Boolean).join('_').toUpperCase().replace(/[^A-Z0-9_]/g, '_');

/** Returns the key or throws a message that tells the user exactly what to add. */
const keyFor = (kind, env, client) => {
  if (!BASE[env]) throw new Error(`unknown environment "${env}": use dev or prod`);
  const name = varName(kind, env, client);
  if (process.env[name]) return process.env[name];
  for (const file of keyFiles()) {
    const value = parseEnvFile(file)[name];
    if (value) return value;
  }
  const what = kind === 'PUK' ? 'public key (puk_, used to read)' : 'private key (prk_, used to write)';
  const where = keyFiles()[0] ?? '.env.api or ~/.auco/keys.env';
  throw new Error(
    `missing ${what}: add ${name}=... to ${where}. ` +
      'Ask whoever manages the client keys, and never paste a key in the chat.'
  );
};

const request = async (env, method, { query, body, client } = {}) => {
  const kind = method === 'GET' ? 'PUK' : 'PRK';
  const url = new URL(BASE[env]);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: { Authorization: keyFor(kind, env, client), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message = typeof data === 'object' ? data.message ?? JSON.stringify(data) : String(data);
    const err = new Error(`${method} ${env} -> HTTP ${res.status}: ${message}`);
    Object.assign(err, { status: res.status, data, apiMessage: message, kind });
    throw err;
  }
  return data;
};

/** Signed URLs from the API expire after 120 s: use them right away. */
const download = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  return res.text();
};

/** The API signs PUT URLs for Content-Type binary/octet-stream. */
const upload = async (url, content) => {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'binary/octet-stream' },
    body: content
  });
  if (!res.ok) throw new Error(`upload failed: HTTP ${res.status} ${await res.text()}`);
};

/** Tiny argv parser: positional args plus --flag value / --flag. */
const parseArgs = (argv) => {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) out._.push(a);
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = true;
  }
  return out;
};

module.exports = { BASE, request, download, upload, keyFor, parseArgs };
