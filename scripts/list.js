/**
 * Lists the templates the key's company can see.
 * Usage: node list.js <dev|prod> [--client NAME]
 */
const { request, parseArgs } = require('./lib/api');

const args = parseArgs(process.argv.slice(2));
const [env] = args._;
if (!env) {
  console.error('Usage: node list.js <dev|prod> [--client NAME]');
  process.exit(1);
}

(async () => {
  const res = await request(env, 'GET', { client: args.client });
  const rows = Array.isArray(res) ? res : res.data ?? [];
  console.log(`${rows.length} template(s) in ${env}${args.client ? ` for ${args.client}` : ''}\n`);
  for (const t of rows) {
    const date = t.updatedAt ? String(t.updatedAt).slice(0, 10) : '          ';
    console.log(`${t.id}  ${date}  ${t.name}`);
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
