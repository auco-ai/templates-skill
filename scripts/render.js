/**
 * Local preview of a template: writes <folder>/preview.html and optionally opens it.
 *
 * It replays what the fill form does — every answer is written into the
 * elements with that name, a clausula shows `${name}_${value}` and hides the
 * other options — so conditional blocks, blank fields and signature anchors can be
 * checked without publishing. A side panel lets you pick each clausula option
 * and lists what the validator found.
 *
 * It is an approximation of the PDF, not the PDF: the real one is built by
 * Auco's PDF generator. Page-end lines assume Letter size and the margins,
 * header and footer heights declared in `custom`.
 *
 * Usage: node render.js <folder> [--file complete|mask] [--open]
 *   Options can be preset from the URL: preview.html#tipo_de_equipo=electrico
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { parseArgs } = require('./lib/api');
const { checkTemplate } = require('./lib/schema');
const { checkHtml } = require('./lib/html');

const args = parseArgs(process.argv.slice(2));
const [folder] = args._;
if (!folder) {
  console.error('Usage: node render.js <folder> [--file complete|mask] [--open]');
  process.exit(1);
}

const dir = path.resolve(folder);
const which = args.file === 'mask' ? 'mask' : 'complete';
const doc = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
const html = fs.readFileSync(path.join(dir, `${which}.html`), 'utf8');

const schemaResult = checkTemplate(doc);
const htmlResult = checkHtml(doc, html, { file: `${which}.html`, complete: which === 'complete' });
const issues = [
  ...[...schemaResult.errors, ...htmlResult.errors].map((m) => ['error', m]),
  ...[...schemaResult.warnings, ...htmlResult.warnings].map((m) => ['warning', m])
];

// Embedded as JSON inside a <script>: a literal "</script>" in the template would
// close the tag early, so every "</" is escaped.
const embed = (value) => JSON.stringify(value).replace(/<\//g, '<\\/');

// Auco's PDF defaults when `custom` sets none.
const custom = doc.custom ?? {};
const border = { top: '1.5cm', right: '2cm', bottom: '0.7cm', left: '2cm', ...(custom.border ?? {}) };
const firstContents = (section) => {
  const c = section?.contents;
  if (!c) return '';
  return typeof c === 'string' ? c : c.first ?? c.default ?? '';
};
const header = { height: custom.header?.height ?? '0mm', html: firstContents(custom.header) };
const footer = {
  height: custom.footer?.height ?? (custom.footer ? '0mm' : '15mm'),
  html: custom.footer
    ? firstContents(custom.footer)
    : '<div style="font-size:8pt;color:#666">Pie de verificación de Auco (código de validación y "Página N de M")</div>'
};

const data = {
  name: doc.name,
  which,
  config: doc.config ?? [],
  signers: (doc.signatureProfile ?? []).filter((p) => p.role !== 'APPROVER').map((p) => p.type),
  noShowHeader: Boolean(custom.noShowHeader),
  page: { widthMm: 215.9, heightMm: 279.4, border, header, footer },
  issues
};

const preview = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Vista previa — ${data.name.replace(/</g, '&lt;')}</title>
<style>
  body { margin: 0; font: 13px/1.4 system-ui, sans-serif; background: #e8e8e8; display: flex; height: 100vh; }
  #doc { flex: 1; border: 0; background: #e8e8e8; }
  #panel { width: 340px; overflow: auto; background: #fff; border-left: 1px solid #ccc; padding: 14px 16px; box-sizing: border-box; }
  h1 { font-size: 15px; margin: 0 0 4px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #555; margin: 18px 0 6px; }
  .note { font-size: 11px; color: #7a5b00; background: #fff6d6; border: 1px solid #f0dc9a; padding: 6px 8px; border-radius: 4px; }
  label { display: block; margin: 8px 0 2px; font-size: 12px; }
  select { width: 100%; font-size: 12px; }
  .mode { display: flex; gap: 6px; }
  .mode button { flex: 1; font-size: 12px; padding: 4px; border: 1px solid #bbb; background: #f5f5f5; border-radius: 4px; cursor: pointer; }
  .mode button.on { background: #1b2a4a; color: #fff; border-color: #1b2a4a; }
  ul { margin: 4px 0; padding-left: 16px; font-size: 11.5px; }
  li.error { color: #b00020; }
  li.warning { color: #8a6100; }
  .muted { color: #888; font-size: 11.5px; }
</style>
</head>
<body>
<iframe id="doc"></iframe>
<div id="panel">
  <h1>${data.name.replace(/</g, '&lt;')}</h1>
  <div class="muted">${which}.html</div>
  <p class="note">Vista previa aproximada. En el PDF final pueden variar las fuentes y los cortes de página.</p>
  <h2>Campos</h2>
  <div class="mode"><button data-mode="sample" class="on">Valores de ejemplo</button><button data-mode="names">Nombres de campo</button></div>
  <h2>Cláusulas</h2>
  <div id="clausulas"></div>
  <h2>Ocultas por prereq</h2>
  <div id="hidden"></div>
  <h2>Validación</h2>
  <div id="issues"></div>
</div>
<script>
const DATA = ${embed(data)};
const TEMPLATE = ${embed(html)};
const mm = (v) => { const n = parseFloat(v); return String(v).endsWith('cm') ? n * 10 : String(v).endsWith('in') ? n * 25.4 : n; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const today = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
const SAMPLE = {
  name: 'NOMBRE APELLIDO', text: 'Texto de ejemplo', email: 'correo@ejemplo.com', phone: '+57 300 123 4567',
  number: '1.234', currency: '$1.500.000 (UN MILLÓN QUINIENTOS MIL PESOS)', date: today, nit: '900123456-7',
  identification: 'CC 1234567890', department: 'Antioquia', request: 'Texto de ejemplo'
};
const state = { mode: 'sample', choice: {} };
DATA.config.filter((q) => ['clausula', 'select', 'searchlist'].includes(q.type))
  .forEach((q) => { state.choice[q.name] = q.value ?? ''; });

for (const [k, v] of new URLSearchParams(location.hash.slice(1))) if (k in state.choice) state.choice[k] = v;
const frame = document.getElementById('doc');
const p = DATA.page;
const contentMm = p.heightMm - mm(p.border.top) - mm(p.border.bottom) - mm(p.header.height) - mm(p.footer.height);
frame.srcdoc = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
  'body{margin:24px auto;background:#e8e8e8;}' +
  '.page{background:#fff;width:' + p.widthMm + 'mm;box-sizing:border-box;padding:' +
    p.border.top + ' ' + p.border.right + ' ' + p.border.bottom + ' ' + p.border.left + ';box-shadow:0 1px 4px rgba(0,0,0,.25);}' +
  '.band{outline:1px dashed #9bb;overflow:hidden;}' +
  '.contract{font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:18px;position:relative;}' +
  '.sign-margin{margin-top:70px;}.text-center{text-align:center;}.left{float:left}.right{float:right}' +
  '.pagebreak{position:absolute;left:-8mm;right:-8mm;border-top:1px dashed #d33;font:9px system-ui;color:#d33;pointer-events:none;}' +
  '.sigph{display:inline-block;border:1px dashed #1b2a4a;color:#1b2a4a;font:italic 11px system-ui;padding:6px 10px;margin:4px 0;}' +
  '.imgph{display:inline-block;width:120px;height:70px;background:#eee;border:1px dashed #aaa;color:#888;font:11px system-ui;text-align:center;line-height:70px;}' +
  '.orphan{outline:2px solid #b00020;}' +
  '</style></head><body><div class="page">' +
  '<div class="band" id="hdr" style="height:' + p.header.height + '"></div>' +
  (DATA.noShowHeader ? '' : '<div style="height:45px;color:#999;font:11px system-ui">[encabezado de Auco: QR y logo]</div>') +
  '<div class="contract" id="content">' + TEMPLATE + '</div>' +
  '<div class="band" id="ftr" style="height:' + p.footer.height + '"></div>' +
  '</div></body></html>';

const valueFor = (q) => {
  if (state.mode === 'names') return '«' + esc(q.name) + '»';
  if (q.type === 'check') return esc((q.values ?? []).slice(0, 2).join(', '));
  if (q.type === 'image') return '<span class="imgph">imagen</span>';
  if (q.type === 'signature') return '<span class="sigph">firma: ' + esc(q.name) + '</span>';
  if (q.type === 'select' || q.type === 'searchlist') {
    const o = (q.options ?? []).find((x) => x.value === state.choice[q.name]);
    return o ? esc(o.label ?? o.name) : '________';
  }
  return esc(SAMPLE[q.type] ?? 'Texto de ejemplo');
};

const prereqMet = (q) => (q.prereq ?? []).every((r) => {
  const v = state.choice[r.k];
  return v === r.v || (q.prereqOptionals ?? []).includes(r.k + '_' + v);
});

function paint() {
  const d = frame.contentDocument;
  if (!d || !d.getElementById('content')) return;
  const byName = (n) => d.getElementsByName(n);
  for (const q of DATA.config) {
    if (q.type === 'clausula') {
      for (const o of q.options ?? []) byName(q.name + '_' + o.value).forEach((el) => { el.hidden = o.value !== state.choice[q.name]; });
    } else {
      byName(q.name).forEach((el) => { el.innerHTML = valueFor(q); });
    }
  }
  for (const t of DATA.signers) byName(t).forEach((el) => { if (!el.innerHTML.trim()) el.innerHTML = '<span class="sigph">firma: ' + esc(t) + '</span>'; });
  byName('signDate').forEach((el) => { el.textContent = today; });
  const known = new Set(DATA.config.flatMap((q) => q.type === 'clausula' ? (q.options ?? []).map((o) => q.name + '_' + o.value) : [q.name]));
  DATA.signers.forEach((t) => known.add(t));
  ['signDate', 'signComplete'].forEach((n) => known.add(n));
  d.querySelectorAll('[name]').forEach((el) => el.classList.toggle('orphan', !known.has(el.getAttribute('name'))));
  // Page-end guides every content-height of Letter.
  const content = d.getElementById('content');
  content.querySelectorAll('.pagebreak').forEach((el) => el.remove());
  const pxPerMm = content.getBoundingClientRect().width / (p.widthMm - mm(p.border.left) - mm(p.border.right));
  const pageH = contentMm * pxPerMm;
  const pages = Math.max(1, Math.ceil(content.scrollHeight / pageH));
  for (let i = 1; i < pages; i++) {
    const line = d.createElement('div');
    line.className = 'pagebreak';
    line.style.top = (i * pageH) + 'px';
    line.textContent = 'fin de página ' + i;
    content.appendChild(line);
  }
  const fill = (s) => s.replace(/{{page}}/g, '1').replace(/{{pages}}/g, String(pages));
  d.getElementById('hdr').innerHTML = fill(p.header.html);
  d.getElementById('ftr').innerHTML = fill(p.footer.html);
  document.querySelector('.muted').textContent = DATA.which + '.html · ~' + pages + ' página(s) sin el certificado';
  const hidden = DATA.config.filter((q) => q.prereq && q.prereq.length && !prereqMet(q));
  document.getElementById('hidden').innerHTML = hidden.length
    ? '<ul>' + hidden.map((q) => '<li>' + esc(q.name) + '</li>').join('') + '</ul>'
    : '<div class="muted">ninguna con estas opciones</div>';
}

const panel = document.getElementById('clausulas');
const lists = DATA.config.filter((q) => ['clausula', 'select', 'searchlist'].includes(q.type));
panel.innerHTML = lists.length ? '' : '<div class="muted">no hay</div>';
for (const q of lists) {
  const label = document.createElement('label');
  label.textContent = q.name;
  const sel = document.createElement('select');
  sel.innerHTML = '<option value="">(sin elegir)</option>' +
    (q.options ?? []).map((o) => '<option value="' + esc(o.value) + '">' + esc(o.name ?? o.label ?? o.value) + '</option>').join('');
  sel.value = state.choice[q.name];
  sel.onchange = () => { state.choice[q.name] = sel.value; paint(); };
  panel.append(label, sel);
}
document.querySelectorAll('.mode button').forEach((b) => b.onclick = () => {
  state.mode = b.dataset.mode;
  document.querySelectorAll('.mode button').forEach((x) => x.classList.toggle('on', x === b));
  paint();
});
document.getElementById('issues').innerHTML = DATA.issues.length
  ? '<ul>' + DATA.issues.map(([k, m]) => '<li class="' + k + '">' + esc(m) + '</li>').join('') + '</ul>'
  : '<div class="muted">sin hallazgos</div>';
frame.onload = paint;
</script>
</body>
</html>
`;

const out = path.join(dir, 'preview.html');
fs.writeFileSync(out, preview);
console.log(`preview: ${out}`);
console.log(`  ${issues.filter((i) => i[0] === 'error').length} error(s), ${issues.filter((i) => i[0] === 'warning').length} warning(s) listed in the panel`);

if (args.open) {
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  execFile(opener, [out], () => {});
}
