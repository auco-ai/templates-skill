/**
 * Publishes a pulled template: validate -> backup the live version -> PUT the
 * config -> upload both HTML -> re-read from the environment and compare.
 *
 * The PUT replaces the config wholesale and bumps `build` on the server (that
 * is what makes deployed SDKs drop their cached copy). Its response carries
 * signed upload URLs that expire in 120 s, so the HTML goes up right after.
 *
 * Usage: node push.js <folder> [--env dev|prod] [--client NAME] [--force]
 *   env, id and client default to what pull.js recorded in <folder>/.source.json.
 *   --force publishes despite HTML errors; it never skips errors the API itself
 *   would reject.
 */
const fs = require('fs');
const path = require('path');
const { request, upload, parseArgs } = require('./lib/api');
const { checkTemplate, toBody } = require('./lib/schema');
const { pullInto } = require('./lib/pull');
const { verifyAgainstRemote } = require('./lib/verify');
const { validateFolder, report } = require('./validate');

const args = parseArgs(process.argv.slice(2));
const [folder] = args._;
if (!folder) {
  console.error('Usage: node push.js <folder> [--env dev|prod] [--client NAME] [--force]');
  process.exit(1);
}

const dir = path.resolve(folder);
const sourceFile = path.join(dir, '.source.json');
const source = fs.existsSync(sourceFile) ? JSON.parse(fs.readFileSync(sourceFile, 'utf8')) : {};
const env = args.env ?? source.env;
const id = args.id ?? source.id ?? path.basename(dir);
const client = args.client ?? source.client ?? undefined;

const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

(async () => {
  if (!env) fail('no environment: pass --env, or pull the template first so .source.json records it');
  // Template ids differ per environment: a folder pulled from dev pushed to prod
  // would target the wrong document, or none.
  if (source.env && args.env && source.env !== args.env) {
    fail(`this folder was pulled from ${source.env}; refusing to push it to ${args.env}. ` +
         'To move a template across environments use create.js with the destination key.');
  }

  const result = validateFolder(dir);
  report(result);
  const apiErrors = checkTemplate(result.doc).errors;
  if (apiErrors.length) fail('\nnot published: the API would reject this request (see ERROR above)');
  if (result.errors.length && !args.force) {
    fail('\nnot published: fix the HTML errors above, or pass --force if they are intended');
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(dir, 'backup', stamp);
  await pullInto({ env, id, client, dir: backup });
  console.log(`\nbackup of the live version: ${path.relative(process.cwd(), backup)}`);

  const body = toBody(result.doc, id);
  const res = await request(env, 'PUT', { body, client });
  const urls = (res.data ?? res).urls;
  await Promise.all([
    upload(urls.mask, fs.readFileSync(path.join(dir, 'mask.html'))),
    upload(urls.complete, fs.readFileSync(path.join(dir, 'complete.html')))
  ]);
  console.log(`published to ${env}: config + mask + complete`);

  const check = await verifyAgainstRemote({ env, id, client, dir, sent: body });
  const ok = (v) => (v ? 'matches' : 'DIFFERS');
  console.log(`verified against ${env}: config ${ok(check.config)}` +
              `${check.drift.length ? ` (${check.drift.join(', ')})` : ''}, ` +
              `mask ${ok(check.mask)}, complete ${ok(check.complete)}`);
  if (!check.config || !check.mask || !check.complete) process.exit(2);
})().catch((e) => fail(e.message));
