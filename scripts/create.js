/**
 * Creates a new template from a folder with config.json, mask.html and complete.html.
 * The company is the one behind the private key, so --client picks the destination.
 * Also the way to move a template between environments: pull it with the source
 * key, then create it with the destination key (it gets a new id).
 *
 * Usage: node create.js <folder> --env dev|prod [--client NAME]
 */
const fs = require('fs');
const path = require('path');
const { request, upload, parseArgs } = require('./lib/api');
const { toBody } = require('./lib/schema');
const { verifyAgainstRemote } = require('./lib/verify');
const { validateFolder, report } = require('./validate');

const args = parseArgs(process.argv.slice(2));
const [folder] = args._;
if (!folder || !args.env) {
  console.error('Usage: node create.js <folder> --env dev|prod [--client NAME]');
  process.exit(1);
}

(async () => {
  const dir = path.resolve(folder);
  const result = validateFolder(dir);
  report(result);
  if (result.errors.length) {
    console.error('\nnot created: fix the errors above first');
    process.exit(1);
  }

  const body = toBody(result.doc);
  const res = await request(args.env, 'POST', { body, client: args.client });
  const { id, urls } = res.data ?? res;
  await Promise.all([
    upload(urls.mask, fs.readFileSync(path.join(dir, 'mask.html'))),
    upload(urls.complete, fs.readFileSync(path.join(dir, 'complete.html')))
  ]);
  fs.writeFileSync(
    path.join(dir, '.source.json'),
    JSON.stringify({ env: args.env, id, client: args.client ?? null, createdAt: new Date().toISOString() }, null, 2)
  );
  console.log(`\ncreated in ${args.env}: ${id}`);

  const check = await verifyAgainstRemote({ env: args.env, id, client: args.client, dir, sent: body });
  console.log(`verified: config ${check.config ? 'matches' : 'DIFFERS'}, ` +
              `mask ${check.mask ? 'matches' : 'DIFFERS'}, complete ${check.complete ? 'matches' : 'DIFFERS'}`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
