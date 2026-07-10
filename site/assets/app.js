const state = { curated: [], snapshot: [], aliases: {}, summary: null, compare: [] };
const byKey = new Map();

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json();
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''), window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch { return '#'; }
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}
function pct(amount) {
  if (!amount) return '—';
  if (amount.status === 'not-applicable') return 'n/a';
  if (amount.value === null || amount.value === undefined) return amount.status === 'unknown-not-curated' ? 'unknown' : amount.status;
  if (amount.unit === 'fraction') return `${(Number(amount.value) * 100).toFixed(Math.abs(Number(amount.value) * 100 - Math.round(Number(amount.value) * 100)) < 1e-8 ? 0 : 1)}%`;
  return `${amount.value} ${amount.unit || ''}`.trim();
}
function omega(formula) { return pct(formula?.amounts?.range_separation_omega); }
function exactSummary(formula) {
  const sr = formula?.amounts?.short_range_exact_exchange;
  const lr = formula?.amounts?.long_range_exact_exchange;
  const om = formula?.amounts?.range_separation_omega;
  if (sr && lr && (sr.value !== null || lr.value !== null || sr.status === 'unknown-not-curated' || lr.status === 'unknown-not-curated')) {
    return `SR ${pct(sr)} / LR ${pct(lr)}${om && om.status !== 'not-applicable' ? `, ω ${pct(om)}` : ''}`;
  }
  return pct(formula?.amounts?.exact_exchange);
}
function statusLabel(card) {
  const f = card.formula || {};
  if (card.source === 'curated') return f.status || 'seed curated';
  return 'imported scaffold';
}
function sourceBadge(card) { return card.source === 'curated' ? 'curated' : 'imported'; }

function curatedToCard(entry) {
  const codes = (entry.libxc?.components || []).map(c => c.code).filter(Boolean);
  return { source: 'curated', key: entry.slug, title: entry.canonical_name, subtitle: codes.join(', '), summary: entry.summary, rung: entry.formula?.rung || entry.rung, kind: entry.kind, aliases: entry.aliases || [], ingredients: entry.ingredients || [], references: entry.references || [], notes: entry.notes || [], formula: entry.formula, raw: entry };
}
function snapshotToCard(entry) {
  return { source: 'libxc', key: `libxc-${entry.libxc_code}`, title: entry.libxc_code, subtitle: `Libxc id ${entry.libxc_id}`, summary: entry.description || 'No description imported.', rung: entry.formula?.rung || entry.rung, kind: entry.kind, aliases: [entry.libxc_code], ingredients: (entry.formula?.variables || []).map(v => v.role), references: entry.references || [], notes: [entry.section, entry.family].filter(Boolean), formula: entry.formula, raw: entry };
}
function allCards() {
  const curated = state.curated.map(curatedToCard);
  const curatedCodes = new Set(curated.flatMap(c => c.raw.libxc?.components?.map(x => x.code) || []));
  const snapshot = state.snapshot.filter(e => !curatedCodes.has(e.libxc_code)).map(snapshotToCard);
  return [...curated, ...snapshot];
}
function textBlob(card) {
  const f = card.formula || {};
  return [card.title, card.subtitle, card.summary, card.rung, card.kind, statusLabel(card), f.latex, f.plain, ...(card.aliases || []), ...(card.ingredients || []), ...(card.notes || []), ...(f.variables || []).map(v => `${v.symbol} ${v.name} ${v.role}`), ...(f.terms || []).map(t => `${t.label} ${t.role}`), ...(f.amounts?.other_terms || []).map(t => `${t.name} ${t.role}`), ...(card.references || []).map(r => `${r.doi || ''} ${r.citation || ''}`)].join(' ').toLowerCase();
}
function populateFilters(cards) {
  for (const [id, values] of [['rungFilter', [...new Set(cards.map(c => c.rung).filter(Boolean))].sort()], ['kindFilter', [...new Set(cards.map(c => c.kind).filter(Boolean))].sort()]]) {
    const el = document.getElementById(id); if (!el || el.dataset.ready) continue;
    for (const value of values) { const option = document.createElement('option'); option.value = value; option.textContent = value; el.appendChild(option); }
    el.dataset.ready = 'true';
  }
}
function renderStats() {
  const dl = document.getElementById('stats'); if (!dl) return;
  const items = [['Curated', state.curated.length], ['Libxc', state.snapshot.length], ['With refs', state.snapshot.filter(e => e.references?.length).length], ['Formula panels', state.curated.length + state.snapshot.length]];
  dl.innerHTML = items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}
function exactFilterMatch(card, filter) {
  if (!filter) return true;
  const f = card.formula || {}; const ex = f.amounts?.exact_exchange; const sr = f.amounts?.short_range_exact_exchange; const lr = f.amounts?.long_range_exact_exchange; const omegaAmount = f.amounts?.range_separation_omega;
  if (filter === 'range') return (omegaAmount && omegaAmount.status !== 'not-applicable') || (sr && sr.status !== 'not-applicable') || (lr && lr.status !== 'not-applicable') || String(card.rung).includes('range-separated');
  if (filter === 'zero') return ex && Number(ex.value) === 0;
  if (filter === 'known') return ex && ex.value !== null && ex.value !== undefined && Number(ex.value) > 0;
  if (filter === 'unknown') return [ex, sr, lr, omegaAmount].some(x => x && x.status === 'unknown-not-curated');
  if (filter === 'na') return ex && ex.status === 'not-applicable';
  return true;
}
function sortedFilteredCards() {
  const cards = allCards(); populateFilters(cards); cards.forEach(c => byKey.set(c.key, c));
  const q = (document.getElementById('search')?.value || '').trim().toLowerCase();
  const rung = document.getElementById('rungFilter')?.value || ''; const kind = document.getElementById('kindFilter')?.value || ''; const source = document.getElementById('sourceFilter')?.value ?? ''; const exact = document.getElementById('exactFilter')?.value || '';
  let filtered = cards.filter(card => (!q || textBlob(card).includes(q)) && (!rung || card.rung === rung) && (!kind || card.kind === kind) && exactFilterMatch(card, exact));
  if (source === 'curated') filtered = filtered.filter(c => c.source === 'curated');
  if (source === 'libxc') filtered = filtered.filter(c => c.source === 'libxc');
  filtered.sort((a, b) => (a.source === b.source ? a.title.localeCompare(b.title) : a.source === 'curated' ? -1 : 1));
  return { filtered, total: cards.length };
}
function recordHtml(card) {
  const f = card.formula || {}; const refs = card.references?.length || 0;
  const href = `functional.html?id=${encodeURIComponent(card.key)}`;
  const other = (f.amounts?.other_terms || []).map(t => t.name).join(', ') || '—';
  return `<article class="record">
    <div class="record-head">
      <div class="record-title"><h3>${escapeHtml(card.title)}</h3><div class="aliases">${escapeHtml(card.aliases?.slice(0, 5).join(', ') || card.subtitle || '')}</div></div>
      <div class="badges"><span class="badge ${sourceBadge(card)}">${card.source === 'curated' ? 'curated' : 'Libxc import'}</span><span class="badge formula">${escapeHtml(statusLabel(card))}</span><span class="badge">${escapeHtml(card.rung || 'unknown')}</span><span class="badge">${escapeHtml(card.kind || 'unknown')}</span></div>
    </div>
    <div class="formula-line">${escapeHtml(f.latex || 'Formula not encoded yet')}</div>
    <div class="science-grid">
      <div class="science-cell"><span>Exact exchange</span><strong>${escapeHtml(exactSummary(f))}</strong></div>
      <div class="science-cell"><span>Exchange</span><strong>${escapeHtml(f.components?.exchange || (card.kind === 'exchange' ? card.title : 'not curated'))}</strong></div>
      <div class="science-cell"><span>Correlation</span><strong>${escapeHtml(f.components?.correlation || (card.kind === 'correlation' ? card.title : 'not curated'))}</strong></div>
      <div class="science-cell"><span>Other terms</span><strong>${escapeHtml(other)}</strong></div>
    </div>
    <p>${escapeHtml(f.plain || card.summary || '')}</p>
    <div class="record-actions"><a class="button secondary" href="${href}">Details</a><button type="button" data-compare="${escapeHtml(card.key)}" aria-label="Compare ${escapeHtml(card.title)}">Compare</button><span class="aliases">${refs} reference${refs === 1 ? '' : 's'} · ${escapeHtml(card.subtitle || '')}</span></div>
  </article>`;
}
function renderCatalog() {
  const root = document.getElementById('cards'); if (!root) return;
  const { filtered, total } = sortedFilteredCards();
  const meta = document.getElementById('resultsMeta'); if (meta) meta.textContent = `${filtered.length} shown from ${total} records.`;
  const limit = 350;
  root.innerHTML = filtered.slice(0, limit).map(recordHtml).join('') + (filtered.length > limit ? `<p class="notice">Showing first ${limit} records. Narrow your search for more.</p>` : '');
  document.querySelectorAll('[data-compare]').forEach(btn => btn.addEventListener('click', () => addCompare(btn.dataset.compare)));
}
function addCompare(key) { if (!state.compare.includes(key)) state.compare.push(key); if (state.compare.length > 4) state.compare.shift(); renderCompare(); }
function renderCompare() {
  const tray = document.getElementById('compareTray'); const names = document.getElementById('compareNames'); const table = document.getElementById('compareTable'); if (!tray || !names || !table) return;
  tray.hidden = state.compare.length === 0;
  const cards = state.compare.map(k => byKey.get(k)).filter(Boolean);
  names.innerHTML = cards.map(c => `<a href="functional.html?id=${encodeURIComponent(c.key)}">${escapeHtml(c.title)}</a>`).join(' vs ');
  if (!cards.length) { table.innerHTML = ''; return; }
  const rows = [['Formula', c => c.formula?.latex || '—'], ['Exact exchange', c => exactSummary(c.formula)], ['Exchange', c => c.formula?.components?.exchange || 'not curated'], ['Correlation', c => c.formula?.components?.correlation || 'not curated'], ['Other terms', c => (c.formula?.amounts?.other_terms || []).map(t => t.name).join(', ') || '—'], ['Libxc', c => c.subtitle || '—'], ['Status', c => statusLabel(c)]];
  table.innerHTML = `<table class="compare-table"><thead><tr><th scope="col">Field</th>${cards.map(c => `<th scope="col">${escapeHtml(c.title)}</th>`).join('')}</tr></thead><tbody>${rows.map(([label, fn]) => `<tr><th scope="row">${label}</th>${cards.map(c => `<td>${escapeHtml(fn(c))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function amountRows(f) {
  const a = f?.amounts || {};
  return [
    ['Exact exchange', pct(a.exact_exchange), a.exact_exchange?.status || ''],
    ['Short-range exact exchange', pct(a.short_range_exact_exchange), a.short_range_exact_exchange?.status || ''],
    ['Long-range exact exchange', pct(a.long_range_exact_exchange), a.long_range_exact_exchange?.status || ''],
    ['Range separation ω', pct(a.range_separation_omega), a.range_separation_omega?.status || ''],
    ['Other terms', (a.other_terms || []).map(t => `${t.name} (${t.status})`).join(', ') || '—', '']
  ];
}
function renderDetail() {
  const root = document.getElementById('detailRoot'); if (!root) return;
  const params = new URLSearchParams(location.search); const id = params.get('id'); const cards = allCards(); cards.forEach(c => byKey.set(c.key, c));
  const card = byKey.get(id) || cards.find(c => c.title === id || c.subtitle?.includes(id));
  if (!card) { root.innerHTML = `<h1>Functional not found</h1><p><a href="index.html">Return to catalog</a></p>`; return; }
  const f = card.formula || {};
  const refs = (card.references || []).map(r => { const href = safeUrl(r.url || (r.doi ? 'https://doi.org/' + r.doi : '#')); return `<li><a href="${escapeHtml(href)}">${escapeHtml(r.citation || r.doi || 'reference')}</a>${r.doi ? ` <span class="code">${escapeHtml(r.doi)}</span>` : ''}</li>`; }).join('') || '<li>No imported reference yet.</li>';
  const compRows = (f.terms || []).map(t => `<tr><th scope="row">${escapeHtml(t.label || t.term_id)}</th><td>${escapeHtml(t.role || '')}</td><td>${escapeHtml((t.component_codes || []).join(', ') || '—')}</td><td>${escapeHtml(pct(t.coefficient))}</td><td>${escapeHtml(t.coefficient?.status || '')}</td></tr>`).join('') || '<tr><td colspan="5">No component terms encoded.</td></tr>';
  const vars = (f.variables || []).map(v => `<span class="badge">${escapeHtml(v.symbol)} · ${escapeHtml(v.role)}</span>`).join(' ');
  root.innerHTML = `<p><a href="index.html#catalog">← Catalog</a></p>
    <section class="detail-title"><p class="kicker">${escapeHtml(card.source)} record</p><h1>${escapeHtml(card.title)}</h1><div class="aliases">${escapeHtml(card.aliases?.join(', ') || '')}</div><div class="badges"><span class="badge ${sourceBadge(card)}">${card.source === 'curated' ? 'curated' : 'Libxc import'}</span><span class="badge formula">${escapeHtml(statusLabel(card))}</span><span class="badge">${escapeHtml(card.rung)}</span><span class="badge">${escapeHtml(card.kind)}</span></div></section>
    <section class="definition"><h2>Scientific definition</h2><div class="formula-line">${escapeHtml(f.latex || 'Formula not encoded yet')}</div><p>${escapeHtml(f.plain || card.summary || '')}</p><div class="definition-grid">${amountRows(f).map(([k,v,s]) => `<div class="science-cell"><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong>${s ? `<small>${escapeHtml(s)}</small>` : ''}</div>`).join('')}</div><div>${vars}</div></section>
    <table class="meta-table"><caption>Formula components</caption><thead><tr><th scope="col">Term</th><th scope="col">Role</th><th scope="col">Libxc code</th><th scope="col">Amount</th><th scope="col">Status</th></tr></thead><tbody>${compRows}</tbody></table>
    <table class="meta-table"><caption>Record metadata</caption><tr><th scope="row">Exchange component</th><td>${escapeHtml(f.components?.exchange || 'not curated')}</td></tr><tr><th scope="row">Correlation component</th><td>${escapeHtml(f.components?.correlation || 'not curated')}</td></tr><tr><th scope="row">Libxc</th><td>${escapeHtml(card.subtitle || '—')}</td></tr><tr><th scope="row">Caveats</th><td>${escapeHtml((f.caveats || card.notes || []).join(' '))}</td></tr></table>
    <h2>References</h2><ol class="ref-list">${refs}</ol>`;
}
async function init() {
  try {
    const [curated, snapshot, aliases, summary] = await Promise.all([loadJson('data/functionals.seed.json'), loadJson('data/libxc_snapshot.json'), loadJson('data/program_aliases.json'), loadJson('generated/summary.json').catch(() => null)]);
    state.curated = curated; state.snapshot = snapshot; state.aliases = aliases; state.summary = summary;
    renderStats(); renderCatalog(); renderDetail(); renderCompare();
    ['search', 'rungFilter', 'kindFilter', 'sourceFilter', 'exactFilter'].forEach(id => document.getElementById(id)?.addEventListener('input', renderCatalog));
    document.getElementById('resetFilters')?.addEventListener('click', () => { ['search', 'rungFilter', 'kindFilter', 'exactFilter'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); const source = document.getElementById('sourceFilter'); if (source) source.value = 'curated'; renderCatalog(); });
    document.getElementById('clearCompare')?.addEventListener('click', () => { state.compare = []; renderCompare(); });
  } catch (err) {
    const root = document.getElementById('cards') || document.getElementById('detailRoot') || document.body;
    root.innerHTML = `<pre>${escapeHtml(err.stack || err.message || err)}</pre>`;
  }
}
init();
