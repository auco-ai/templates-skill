/** Downloads a template (config + both HTML) through the API into a folder. */
const fs = require('fs');
const path = require('path');
const { request, download } = require('./api');

const pullInto = async ({ env, id, client, dir }) => {
  const res = await request(env, 'GET', { query: { id }, client });
  const doc = res.data ?? res;
  if (!doc || !doc.config) throw new Error(`template ${id} not found for this key in ${env}`);

  // The signed URLs expire in 120 s, so both HTML are fetched before anything else.
  const [mask, complete] = await Promise.all([download(doc.urls.mask), download(doc.urls.complete)]);
  const { urls: _urls, id: _id, ...config } = doc;

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config, null, 2));
  fs.writeFileSync(path.join(dir, 'mask.html'), mask);
  fs.writeFileSync(path.join(dir, 'complete.html'), complete);
  return { config, mask, complete };
};

module.exports = { pullInto };
