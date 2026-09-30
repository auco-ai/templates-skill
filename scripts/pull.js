/**
 * Downloads a template to work on it: <out>/<id>/{config.json, mask.html, complete.html}.
 * Always start from here — a local copy from an earlier session is probably stale.
 * Usage: node pull.js <dev|prod> <id> [--client NAME] [--out DIR]
 */
const fs = require('fs');
const path = require('path');
const { parseArgs } = require('./lib/api');
const { pullInto } = require('./lib/pull');

const args = parseArgs(process.argv.slice(2));
const [env, id] = args._;
if (!env || !id) {
  console.error('Usage: node pull.js <dev|prod> <id> [--client NAME] [--out DIR]');
  process.exit(1);
}

(async () => {
  const dir = path.resolve(args.out ?? '.', id);
  const { config } = await pullInto({ env, id, client: args.client, dir });
  fs.writeFileSync(
    path.join(dir, '.source.json'),
    JSON.stringify({ env, id, client: args.client ?? null, pulledAt: new Date().toISOString() }, null, 2)
  );
  console.log(`pulled ${config.name}`);
  console.log(`  into      ${dir}`);
  console.log(`  questions ${config.config.length}   signers ${(config.signatureProfile ?? []).length}`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
