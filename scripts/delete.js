/**
 * Deletes a template: pulls a full copy first (config + both HTML), then calls
 * DELETE. The API refuses with TEMPLATE_IN_USE while any contract created from
 * the template is still in signature.
 *
 * Deleting cannot be undone through the API. The copy lets you recreate the
 * template with create.js, but it comes back with a new id.
 *
 * Usage: node delete.js <dev|prod> <id> [--client NAME] [--yes]
 *   Without --yes it only shows what would be deleted.
 */
const path = require('path');
const { request, parseArgs } = require('./lib/api');
const { pullInto } = require('./lib/pull');

const args = parseArgs(process.argv.slice(2));
const [env, id] = args._;
if (!env || !id) {
  console.error('Usage: node delete.js <dev|prod> <id> [--client NAME] [--yes]');
  process.exit(1);
}
const client = args.client;

(async () => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.resolve('deleted', `${id}-${env}-${stamp}`);
  const { config } = await pullInto({ env, id, client, dir });
  console.log(`template  ${config.name}`);
  console.log(`env       ${env}${client ? ` (${client})` : ''}`);
  console.log(`copy      ${dir}`);

  if (!args.yes) {
    console.log('\ndry run: nothing deleted. Re-run with --yes to delete it.');
    return;
  }

  try {
    await request(env, 'DELETE', { query: { id }, client });
  } catch (e) {
    if (/TEMPLATE_IN_USE/.test(e.message))
      throw new Error('not deleted: a contract created from this template is still in signature (TEMPLATE_IN_USE)');
    if (/HTTP 404/.test(e.message))
      throw new Error(`not deleted: ${env} does not expose DELETE /template yet (${e.message})`);
    throw e;
  }
  console.log(`\ndeleted from ${env}`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
