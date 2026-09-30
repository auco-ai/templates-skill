/**
 * Checks a template's HTML (mask or complete) against its config.
 *
 * The fill form writes every answer into the elements with that name, by
 * `${name}_${value}` for a clausula and by `name` for everything else.
 * When the HTML and the config
 * drift apart nothing fails loudly: the field just stays blank.
 */

/**
 * Indexes every element that carries a name attribute, on any tag — the SDK
 * accepts <b>, <div>… not only <span>. Content is cut by counting nested open
 * and close tags, since spans come nested (<span style><span name>…</span></span>).
 * A name can repeat; it counts as empty or hidden only if every occurrence is.
 */
const indexNames = (html) => {
  const found = new Map();
  for (const m of html.matchAll(/<([a-z][a-z0-9]*)\s([^>]*?)>/gi)) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    const name = attrs.match(/\bname="([^"]+)"/)?.[1];
    if (!name) continue;

    const start = m.index + m[0].length;
    const bounds = new RegExp(`<(/?)${tag}\\b`, 'gi');
    bounds.lastIndex = start;
    let depth = 1;
    let end = html.length;
    let b;
    while ((b = bounds.exec(html)) !== null) {
      depth += b[1] ? -1 : 1;
      if (depth === 0) {
        end = b.index;
        break;
      }
    }
    const text = html.slice(start, end).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    const current = { hidden: /\bhidden\b/.test(attrs), empty: text === '' };
    const prev = found.get(name);
    found.set(
      name,
      prev ? { hidden: prev.hidden && current.hidden, empty: prev.empty && current.empty } : current
    );
  }
  return found;
};

const checkHtml = (doc, html, { file = 'html', complete = false } = {}) => {
  const errors = [];
  const warnings = [];
  const names = indexNames(html);
  const preBuild = new Set(doc.preBuildData ?? []);

  for (const q of doc.config ?? []) {
    if (q.type === 'clausula') {
      for (const opt of q.options ?? []) {
        const key = `${q.name}_${opt.value}`;
        const el = names.get(key);
        if (!el) {
          errors.push(`${file}: no element for clausula option ${key} ("${opt.name}") — it renders blank`);
          continue;
        }
        if (el.empty) errors.push(`${file}: ${key} ("${opt.name}") is empty — picking it shows nothing`);
        const isDefault = q.value !== undefined && opt.value === q.value;
        if (isDefault && el.hidden) errors.push(`${file}: default option ${key} is hidden`);
        if (!isDefault && !el.hidden) {
          errors.push(
            q.value === undefined
              ? `${file}: ${key} is visible but the clausula has no default — every option must start hidden`
              : `${file}: non-default option ${key} is visible`
          );
        }
      }
      continue;
    }

    if (q.type === 'signature') {
      // The form paints the signature into the elements named q.name; an id-only
      // anchor works in the PDF (the server falls back from id to name) but
      // stays blank in the live preview.
      if (!names.has(q.name)) {
        const byId = new RegExp(`\\bid="${q.name}"`).test(html);
        errors.push(
          byId
            ? `${file}: signature "${q.name}" is anchored by id only — use name="${q.name}" or the preview stays blank`
            : `${file}: no element named "${q.name}" for the signature`
        );
      }
      continue;
    }

    if (!names.has(q.name)) {
      if (preBuild.has(q.name)) {
        warnings.push(`${file}: no element for "${q.name}" — fine if it is internal (it is in preBuildData)`);
      } else {
        errors.push(`${file}: no element for "${q.name}" (${q.type}) — the answer never shows`);
      }
    }
  }

  if (complete) {
    for (const p of doc.signatureProfile ?? []) {
      if (p.role === 'APPROVER' || !p.type) continue;
      const byName = names.has(p.type);
      const byId = new RegExp(`\\bid="${p.type}"`).test(html);
      if (!byName && !byId) errors.push(`${file}: no signature placeholder for signer "${p.type}"`);
      const idAndName = new RegExp(`<[^>]*\\bid="${p.type}"[^>]*\\bname="${p.type}"|<[^>]*\\bname="${p.type}"[^>]*\\bid="${p.type}"`);
      if (byId && byName && !idAndName.test(html)) {
        warnings.push(`${file}: signer "${p.type}" uses both id and name on different elements — the name ones are ignored`);
      }
    }
  }

  if (/display:\s*(flex|grid)|grid-template|var\(--/.test(html)) {
    warnings.push(`${file}: flexbox/grid/CSS variables — Auco's PDF generator does not support them`);
  }

  return { errors, warnings };
};

module.exports = { checkHtml, indexNames };
