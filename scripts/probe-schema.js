/**
 * Probes what the deployed PUT /template accepts, without changing anything.
 *
 * The API validates the body before it looks up the template. Every probe
 * targets an id that cannot exist, so a request that passes validation and
 * auth ends in DOCUMENT_NOT_FOUND and touches nothing.
 *
 *   400 "... is not allowed"  -> the deployed schema rejects that field
 *   400 DOCUMENT_NOT_FOUND    -> schema accepted it and the private key is valid
 *   401 UNAUTHORIZED          -> schema accepted it, the key was rejected
 *
 * Usage: node probe-schema.js <dev|prod> [--client NAME]
 */
const { request, parseArgs } = require('./lib/api');

const args = parseArgs(process.argv.slice(2));
const [env = 'dev'] = args._;
const { client } = args;
const NO_SUCH_ID = '000000000000000000000000';

const base = () => ({
  id: NO_SUCH_ID,
  name: 'probe',
  config: [
    { name: 'nombre', description: 'n', type: 'name' },
    { name: 'correo', description: 'c', type: 'email' },
    { name: 'fecha', description: 'f', type: 'date' },
    { name: 'celular', description: 'p', type: 'phone' },
    { name: 'cantidad', description: 'q', type: 'number' },
    { name: 'firma', description: 's', type: 'signature' }
  ],
  sign: ['nombre'],
  signatureProfile: [{ name: 'nombre', email: 'correo', type: 'firmante' }]
});

const q = (body, name) => body.config.find((x) => x.name === name);

const PROBES = [
  ['baseline (no extras)', (b) => b],
  ['date.min = "now"', (b) => ((q(b, 'fecha').min = 'now'), b)],
  ['date.subYears', (b) => ((q(b, 'fecha').subYears = 18), b)],
  ['number.max', (b) => ((q(b, 'cantidad').max = '10'), b)],
  ['phone.country', (b) => ((q(b, 'celular').country = 'co'), b)],
  ['signature.allow', (b) => ((q(b, 'firma').allow = ['draw', 'font']), b)],
  ['text.maxlength', (b) => ((q(b, 'nombre').maxlength = 40), b)],
  ['signatureProfile.name as array', (b) => ((b.signatureProfile[0].name = ['nombre']), b)],
  ['signatureProfile.signature', (b) => ((b.signatureProfile[0].signature = 'firma'), b)],
  ['template description', (b) => ((b.description = 'x'), b)]
];

(async () => {
  console.log(`PUT ${env} — probe on an id that cannot exist\n`);
  for (const [label, mutate] of PROBES) {
    let verdict;
    try {
      await request(env, 'PUT', { body: mutate(base()), client });
      verdict = 'accepted and CHANGED something (should never happen)';
    } catch (e) {
      const msg = typeof e.data === 'object' ? e.data.message ?? JSON.stringify(e.data) : String(e.data);
      if (e.status === 401) verdict = 'schema ok · key rejected (401)';
      else if (/DOCUMENT_NOT_FOUND/.test(msg)) verdict = 'schema ok · key ok';
      else if (/not allowed|must be/.test(msg)) verdict = `REJECTED by the schema: ${msg}`;
      else verdict = `HTTP ${e.status}: ${msg}`;
    }
    console.log(`  ${label.padEnd(36)} ${verdict}`);
  }
})();
