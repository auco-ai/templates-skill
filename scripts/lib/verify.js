/** Re-reads a template from the environment and compares it with the local folder. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pullInto } = require('./pull');

// Key order must not count as a difference.
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]))
      : value;

const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

const verifyAgainstRemote = async ({ env, id, client, dir, sent }) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'auco-verify-'));
  try {
    const remote = await pullInto({ env, id, client, dir: tmp });
    const local = {
      mask: fs.readFileSync(path.join(dir, 'mask.html'), 'utf8'),
      complete: fs.readFileSync(path.join(dir, 'complete.html'), 'utf8')
    };
    const fields = Object.keys(sent).filter((k) => k !== 'id');
    const drift = fields.filter((k) => !same(sent[k], remote.config[k]));
    return {
      config: drift.length === 0,
      drift,
      mask: remote.mask === local.mask,
      complete: remote.complete === local.complete
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
};

module.exports = { verifyAgainstRemote };
