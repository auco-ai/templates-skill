/**
 * Validates a template folder locally: what the API would reject, and what the
 * API accepts but would break the form or the signing flow.
 * Usage: node validate.js <folder>      (exit code 1 when there are errors)
 */
const fs = require('fs');
const path = require('path');
const { checkTemplate } = require('./lib/schema');
const { checkHtml } = require('./lib/html');

const validateFolder = (dir) => {
  const doc = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
  const results = [checkTemplate(doc)];
  for (const file of ['mask.html', 'complete.html']) {
    const f = path.join(dir, file);
    if (!fs.existsSync(f)) {
      results.push({ errors: [`${file} is missing`], warnings: [] });
      continue;
    }
    results.push(checkHtml(doc, fs.readFileSync(f, 'utf8'), { file, complete: file === 'complete.html' }));
  }
  return {
    doc,
    errors: results.flatMap((r) => r.errors),
    warnings: results.flatMap((r) => r.warnings)
  };
};

const report = ({ doc, errors, warnings }) => {
  console.log(`${doc.name}: ${errors.length} error(s), ${warnings.length} warning(s)`);
  errors.forEach((e) => console.log(`  ERROR    ${e}`));
  warnings.forEach((w) => console.log(`  warning  ${w}`));
};

if (require.main === module) {
  const [dir] = process.argv.slice(2);
  if (!dir) {
    console.error('Usage: node validate.js <folder>');
    process.exit(1);
  }
  const result = validateFolder(path.resolve(dir));
  report(result);
  process.exit(result.errors.length ? 1 : 0);
}

module.exports = { validateFolder, report };
