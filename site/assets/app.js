const state = { curated: [], snapshot: [], aliases: [], summary: null, compare: [] };
const byKey = new Map();

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json();
}

function curatedToCard(entry) {
  const codes = (entry.libxc?.components || []).map(c => c.code).filter(Boolean);
  return {
    source: 'curated',
    key: entry.slug,
    title: entry.canonical_name,
    subtitle: codes.join(', '),
    summary: entry.summary,
    rung: entry.rung,
    kind: entry.kind,
    aliases: entry.aliases || [],
    ingredients: entry.ingredients || [],
    references: entry.references || [],
    notes: entry.notes || [],
    raw: entry
  };
}

function snapshotToCard(entry) {
  return {
    source: 'libxc',
    key: `libxc-${entry.libxc_code}`,
    title: entry.libxc_code,
    subtitle: `Libxc id ${entry.libxc_id}`,
    summary: entry.description || 'No description imported.',
    rung: entry.rung,
    kind: entry.kind,
    aliases: [entry.libxc_code],
    ingredients: [],
    references: entry.references || [],
    notes: [entry.section, entry.family].filter(Boolean),
    raw: entry
  };
}

function allCards() {
  const curated = state.curated.map(curatedToCard);
  const curatedCodes = new Set(curated.flatMap(c => c.raw.libxc?.components?.map(x => x.code) || []));
  const snapshot = state.snapshot
    .filter(e => !curatedCodes.has(e.libxc_code))
    .map(snapshotToCard);
  return [...curated, ...snapshot];
}

function textBlob(card) {
  return [card.title, card.subtitle, card.summary, card.rung, card.kind, ...(card.aliases || []), ...(card.ingredients || []), ...(card.notes || []), ...(card.references || []).map(r => `${r.doi || ''} ${r.citation || ''}`)].join(' ').toLowerCase();
}

function populateFilters(cards) {
  for (const [id, values] of [
    ['rungFilter', [...new Set(cards.map(c => c.rung).filter(Boolean))].sort()],
    ['kindFilter', [...new Set(cards.map(c => c.kind).filter(Boolean))].sort()]
  ]) {
    const el = document.getElementById(id);
    if (!el || el.dataset.ready) continue;
    for (const value of values) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      el.appendChild(option);
    }
    el.dataset.ready = 'true';
  }
}

function renderStats() {
  const dl = document.getElementById('stats');
  if (!dl) return;
  const items = [
    ['Curated records', state.curated.length],
    ['Libxc snapshot', state.snapshot.length],
    ['With references', state.snapshot.filter(e => e.references?.length).length],
    ['Alias records', state.aliases.aliases?.length || 0]
  ];
  dl.innerHTML = items.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
}

function cardHtml(card) {
  const refs = card.references?.length || 0;
  const href = `functional.html?id=${encodeURIComponent(card.key)}`;
  return `<article class="card">
    <div class="badges"><span class="badge ${card.source === 'curated' ? 'green' : 'gray'}">${card.source}</span><span class="badge">${card.rung || 'unknown'}</span><span class="badge gray">${card.kind || 'unknown'}</span></div>
    <h3>${escapeHtml(card.title)}</h3>
    <p><strong>${escapeHtml(card.subtitle || '')}</strong></p>
    <p>${escapeHtml(card.summary || '')}</p>
    <p>${refs} reference${refs === 1 ? '' : 's'}</p>
    <div class="card-actions"><a class="button secondary" href="${href}">Details</a><button type="button" data-compare="${escapeHtml(card.key)}" aria-label="Compare ${escapeHtml(card.title)}">Compare</button></div>
  </article>`;
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''), window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
  } catch {
    return '#';
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
}

function renderCatalog() {
  const cards = allCards();
  populateFilters(cards);
  cards.forEach(c => byKey.set(c.key, c));
  const q = (document.getElementById('search')?.value || '').trim().toLowerCase();
  const rung = document.getElementById('rungFilter')?.value || '';
  const kind = document.getElementById('kindFilter')?.value || '';
  const source = document.getElementById('sourceFilter')?.value || '';
  const filtered = cards.filter(card => {
    if (q && !textBlob(card).includes(q)) return false;
    if (rung && card.rung !== rung) return false;
    if (kind && card.kind !== kind) return false;
    if (source && card.source !== source) return false;
    return true;
  });
  const meta = document.getElementById('resultsMeta');
  const root = document.getElementById('cards');
  if (meta) meta.textContent = `${filtered.length} result(s) from ${cards.length} searchable records.`;
  if (root) root.innerHTML = filtered.slice(0, 300).map(cardHtml).join('') + (filtered.length > 300 ? '<p>Showing first 300 results. Narrow your search.</p>' : '');
  document.querySelectorAll('[data-compare]').forEach(btn => btn.addEventListener('click', () => addCompare(btn.dataset.compare)));
}

function addCompare(key) {
  if (!state.compare.includes(key)) state.compare.push(key);
  if (state.compare.length > 3) state.compare.shift();
  renderCompare();
}

function renderCompare() {
  const tray = document.getElementById('compareTray');
  const names = document.getElementById('compareNames');
  if (!tray || !names) return;
  tray.hidden = state.compare.length === 0;
  names.innerHTML = state.compare.map(key => {
    const card = byKey.get(key);
    return card ? `<a href="functional.html?id=${encodeURIComponent(key)}">${escapeHtml(card.title)}</a>` : escapeHtml(key);
  }).join(' vs ');
}

function renderDetail() {
  const root = document.getElementById('detailRoot');
  if (!root) return;
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const cards = allCards();
  cards.forEach(c => byKey.set(c.key, c));
  const card = byKey.get(id) || cards.find(c => c.title === id || c.subtitle?.includes(id));
  if (!card) {
    root.innerHTML = `<h1>Functional not found</h1><p><a href="index.html">Return to catalog</a></p>`;
    return;
  }
  const refs = (card.references || []).map(r => {
    const href = safeUrl(r.url || (r.doi ? 'https://doi.org/' + r.doi : '#'));
    return `<li><a href="${escapeHtml(href)}">${escapeHtml(r.citation || r.doi || 'reference')}</a>${r.doi ? ` <code>${escapeHtml(r.doi)}</code>` : ''}</li>`;
  }).join('') || '<li>No imported reference yet.</li>';
  const aliases = (card.aliases || []).map(escapeHtml).join(', ') || '—';
  const notes = (card.notes || []).map(n => `<li>${escapeHtml(n)}</li>`).join('') || '<li>No notes.</li>';
  root.innerHTML = `<p><a href="index.html">← Catalog</a></p><div class="detail-grid"><section><p class="eyebrow">${escapeHtml(card.source)} record</p><h1>${escapeHtml(card.title)}</h1><p class="lead">${escapeHtml(card.summary)}</p><h2>References</h2><ol class="ref-list">${refs}</ol><h2>Notes</h2><ul>${notes}</ul></section><aside><table class="meta-table"><tr><th>Rung</th><td>${escapeHtml(card.rung)}</td></tr><tr><th>Kind</th><td>${escapeHtml(card.kind)}</td></tr><tr><th>Aliases</th><td>${aliases}</td></tr><tr><th>Libxc</th><td>${escapeHtml(card.subtitle)}</td></tr></table></aside></div>`;
}

async function init() {
  try {
    const [curated, snapshot, aliases, summary] = await Promise.all([
      loadJson('data/functionals.seed.json'),
      loadJson('data/libxc_snapshot.json'),
      loadJson('data/program_aliases.json'),
      loadJson('generated/summary.json').catch(() => null)
    ]);
    state.curated = curated;
    state.snapshot = snapshot;
    state.aliases = aliases;
    state.summary = summary;
    renderStats();
    renderCatalog();
    renderDetail();
    ['search', 'rungFilter', 'kindFilter', 'sourceFilter'].forEach(id => document.getElementById(id)?.addEventListener('input', renderCatalog));
    document.getElementById('resetFilters')?.addEventListener('click', () => {
      ['search', 'rungFilter', 'kindFilter', 'sourceFilter'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      renderCatalog();
    });
    document.getElementById('clearCompare')?.addEventListener('click', () => { state.compare = []; renderCompare(); });
  } catch (err) {
    const root = document.getElementById('cards') || document.getElementById('detailRoot') || document.body;
    root.innerHTML = `<pre>${escapeHtml(err.stack || err.message || err)}</pre>`;
  }
}

init();
