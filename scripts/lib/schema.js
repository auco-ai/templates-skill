/**
 * What the deployed template API accepts, so problems surface locally instead
 * of as a 400 after the fact. The PUT rejects the WHOLE request on any unknown
 * key: a template carrying one of them cannot be saved at all.
 *
 * Ground truth is scripts/probe-schema.js, which asks the live API without
 * changing anything. Re-run it after a deploy and update this file.
 */

// Top-level fields accepted by POST/PUT.
const BODY_FIELDS = [
  'config', 'sign', 'signatureProfile', 'name', 'description', 'help', 'files', 'preFill',
  'preBuild', 'preBuildData', 'packageApproved', 'pagare', 'pagareData', 'custom', 'type'
];

// Per-question fields accepted today in dev and prod (confirmed by probe, 2026-09-30).
const QUESTION_FIELDS = [
  'name', 'description', 'type', 'value', 'help', 'select', 'values', 'endpoint',
  'options', 'removeText', 'prereq', 'prereqOptionals'
];

// Supported by the fill form but not yet accepted by the API. Flip the flag
// once probe-schema.js shows them accepted.
const SDK_FIELDS_ACCEPTED = true;
const SDK_FIELDS = [
  'min', 'max', 'subDays', 'subYears', 'afterSubYears', 'maxlength', 'regex', 'addText',
  'country', 'allow', 'groupQuestion'
];

const QUESTION_TYPES = [
  'name', 'department', 'number', 'currency', 'date', 'text', 'email', 'phone', 'clausula',
  'check', 'request', 'image', 'select', 'searchlist', 'nit', 'signature', 'identification'
];

/**
 * Returns { errors, warnings } for a template document.
 *   errors   — the API would reject the request; pushing is pointless.
 *   warnings — the API accepts it, but the form or the signing flow breaks.
 */
const checkTemplate = (doc) => {
  const errors = [];
  const warnings = [];
  const accepted = new Set([...QUESTION_FIELDS, ...(SDK_FIELDS_ACCEPTED ? SDK_FIELDS : [])]);
  const byName = Object.fromEntries((doc.config ?? []).map((q) => [q.name, q]));

  for (const f of ['config', 'sign', 'signatureProfile', 'name']) {
    if (doc[f] === undefined) errors.push(`missing required field "${f}"`);
  }

  (doc.config ?? []).forEach((q, i) => {
    const at = `config[${i}] "${q.name}"`;
    if (!q.name) errors.push(`config[${i}] has no name`);
    if (!QUESTION_TYPES.includes(q.type)) errors.push(`${at}: unknown type "${q.type}"`);
    if (typeof q.description === 'string' && q.description.trim() === '') {
      errors.push(`${at}: empty description (the API rejects it, and the signer sees a blank question)`);
    }
    for (const k of Object.keys(q)) {
      if (accepted.has(k)) continue;
      if (SDK_FIELDS.includes(k)) {
        errors.push(`${at}: "${k}" is not accepted by the API yet — the form supports it, the PUT would fail`);
      } else {
        errors.push(`${at}: "${k}" is not accepted by the API`);
      }
    }
    for (const p of q.prereq ?? []) {
      const ref = byName[p.k];
      if (!ref) warnings.push(`${at}: prereq points to missing question "${p.k}"`);
      else if (ref.type !== 'clausula') {
        warnings.push(`${at}: prereq on "${p.k}" (${ref.type}) never fires — prereq only works on a clausula`);
      } else if (!(ref.options ?? []).some((o) => o.value === p.v)) {
        warnings.push(`${at}: prereq value "${p.v}" is not an option of "${p.k}"`);
      }
    }
  });

  for (const s of doc.sign ?? []) {
    if (!byName[s]) warnings.push(`sign lists "${s}", which is not a question`);
  }

  (doc.signatureProfile ?? []).forEach((p, i) => {
    const at = `signatureProfile[${i}] "${p.type ?? '?'}"`;
    if (Array.isArray(p.name)) {
      errors.push(
        `${at}: name as an array is rejected by the API — use a single full-name question`
      );
    }
    // A signer with its own signature question signs in the form, so nothing is sent to it.
    if (!p.email && !p.phone && !p.signature) errors.push(`${at}: needs email or phone`);
    for (const [key, type] of [['email', 'email'], ['phone', 'phone']]) {
      if (!p[key]) continue;
      const q = byName[p[key]];
      const inPreFill = (doc.preFill ?? []).some((x) => x.name === p[key]);
      if (!q && !inPreFill) errors.push(`${at}: ${key} -> "${p[key]}" is not a question (API: PROFILE_FIELD_NOT_FOUND)`);
      else if (q && q.type !== type)
        errors.push(`${at}: ${key} -> "${p[key]}" is ${q.type}, must be ${type} (API: PROFILE_FIELD_TYPE_INVALID)`);
    }
    if (p.role !== 'APPROVER' && !p.identification) {
      warnings.push(`${at}: a signer without identification makes the signing flow fail`);
    }
    if (p.signature) {
      const q = byName[p.signature];
      if (!q) warnings.push(`${at}: signature -> "${p.signature}" is not a question`);
      else if (q.type !== 'signature') warnings.push(`${at}: signature -> "${p.signature}" is ${q.type}`);
      else if (p.signature !== p.type) {
        warnings.push(`${at}: signature "${p.signature}" differs from type — sign-now expects them equal`);
      }
    }
  });

  return { errors, warnings };
};

/** Body for POST/PUT: only the fields the API accepts, without empty values. */
const toBody = (doc, id) => {
  const body = {};
  for (const f of BODY_FIELDS) if (doc[f] !== undefined && doc[f] !== null) body[f] = doc[f];
  if (id) body.id = id;
  return body;
};

module.exports = { checkTemplate, toBody, BODY_FIELDS, QUESTION_FIELDS, SDK_FIELDS, SDK_FIELDS_ACCEPTED };
