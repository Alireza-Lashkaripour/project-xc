(() => {
  'use strict';

  const RADII = {H:0.31, B:0.84, C:0.76, N:0.71, O:0.66, F:0.57, P:1.07, S:1.05, Cl:1.02, Br:1.20, I:1.39, Si:1.11, Li:1.28, Be:0.96, Na:1.66, Mg:1.41, Al:1.21, K:2.03, Ca:1.76, Fe:1.24, Co:1.18, Ni:1.17, Cu:1.17, Zn:1.25};
  const COLORS = {pos:'#2563eb', neg:'#ea580c', atom:'#f8fafc', bond:'#98a2b3', text:'#111827', muted:'#667085', level:'#174ea6', occ:'#111827', selected:'#d97706'};
  const ALPHA_PI = {B:0.55, C:0.0, N:-0.45, O:-0.9, F:-1.2, P:0.15, S:-0.25, Si:0.25};
  const ALPHA_GRAPH = {H:0.15, B:0.35, C:0.0, N:-0.45, O:-0.85, F:-1.20, P:0.05, S:-0.25, Cl:-0.45, Br:-0.35, I:-0.25, Si:0.20, Fe:-0.15, Co:-0.15, Ni:-0.15, Cu:-0.15, Zn:-0.10};
  const EXAMPLES = {
    benzene:`12\nbenzene approximate D6h\nC  1.396  0.000  0.000\nC  0.698  1.209  0.000\nC -0.698  1.209  0.000\nC -1.396  0.000  0.000\nC -0.698 -1.209  0.000\nC  0.698 -1.209  0.000\nH  2.479  0.000  0.000\nH  1.240  2.148  0.000\nH -1.240  2.148  0.000\nH -2.479  0.000  0.000\nH -1.240 -2.148  0.000\nH  1.240 -2.148  0.000`,
    ethylene:`6\nethylene planar\nC -0.6695  0.0000 0.0000\nC  0.6695  0.0000 0.0000\nH -1.2320  0.9289 0.0000\nH -1.2320 -0.9289 0.0000\nH  1.2320  0.9289 0.0000\nH  1.2320 -0.9289 0.0000`,
    water:`3\nwater bent\nO 0.0000 0.0000 0.0000\nH 0.9584 0.0000 0.0000\nH -0.2396 0.9271 0.0000`,
    oxygen:`2\noxygen\nO 0.0000 0.0000 0.0000\nO 1.2075 0.0000 0.0000`
  };

  const $ = (id) => document.getElementById(id);
  const fmt = (x, n=3) => Number.isFinite(x) ? x.toFixed(n) : '—';
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let current = null;
  let selectedMO = 0;

  function parseXYZ(text) {
    const raw = text.split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#'));
    if (!raw.length) throw new Error('No XYZ lines found.');
    let start = 0;
    const n = Number.parseInt(raw[0], 10);
    if (Number.isFinite(n) && String(n) === raw[0].split(/\s+/)[0]) start = 2;
    const atoms = [];
    for (let i = start; i < raw.length; i++) {
      const parts = raw[i].split(/\s+/);
      if (parts.length < 4) continue;
      const symbol = normalizeSymbol(parts[0]);
      const x = Number(parts[1]), y = Number(parts[2]), z = Number(parts[3]);
      if (!symbol || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
      atoms.push({symbol, x, y, z, index: atoms.length});
    }
    if (!atoms.length) throw new Error('Could not parse any atoms. Expected lines like: C 0.0 0.0 0.0');
    return atoms;
  }

  function normalizeSymbol(s) {
    const t = String(s || '').trim();
    if (!t) return '';
    return t[0].toUpperCase() + t.slice(1).toLowerCase();
  }

  function dist(a, b) {
    const dx = a.x-b.x, dy = a.y-b.y, dz = a.z-b.z;
    return Math.hypot(dx, dy, dz);
  }

  function inferBonds(atoms, scale=1.25) {
    const bonds = [];
    const degree = Array(atoms.length).fill(0);
    for (let i=0; i<atoms.length; i++) {
      for (let j=i+1; j<atoms.length; j++) {
        const ri = RADII[atoms[i].symbol] || 0.77;
        const rj = RADII[atoms[j].symbol] || 0.77;
        const d = dist(atoms[i], atoms[j]);
        const cutoff = scale * (ri + rj) + 0.08;
        if (d > 0.25 && d <= cutoff) {
          bonds.push({i, j, d}); degree[i]++; degree[j]++;
        }
      }
    }
    return {bonds, degree};
  }

  function isPiElement(sym) { return ['B','C','N','O','P','S','Si'].includes(sym); }

  function piElectronGuess(atom, degree) {
    const s = atom.symbol;
    if (s === 'B') return 0;
    if (s === 'C' || s === 'Si') return 1;
    if (s === 'N' || s === 'P') return degree <= 2 ? 2 : 1;
    if (s === 'O' || s === 'S') return degree <= 1 ? 2 : 1;
    return 1;
  }

  function buildBasis(atoms, bonds, degree, requestedMode) {
    const piCandidates = atoms.filter(a => isPiElement(a.symbol) && degree[a.index] <= 3);
    const piSet = new Set(piCandidates.map(a => a.index));
    const piBonds = bonds.filter(b => piSet.has(b.i) && piSet.has(b.j));
    let mode = requestedMode;
    const warnings = [];
    if (mode === 'auto') mode = (piCandidates.length >= 2 && piBonds.length >= 1) ? 'pi' : 'graph';
    if (mode === 'pi' && !(piCandidates.length >= 2 && piBonds.length >= 1)) {
      warnings.push('π-Hückel mode did not find at least two bonded p-orbital centers; falling back to atom-graph LCAO sketch.');
      mode = 'graph';
    }
    let basis, edges, electrons;
    if (mode === 'pi') {
      basis = piCandidates.map((a, k) => ({basisIndex:k, atomIndex:a.index, symbol:a.symbol, label:`pπ(${a.symbol}${a.index+1})`, alpha:ALPHA_PI[a.symbol] ?? 0, electrons:piElectronGuess(a, degree[a.index])}));
      const indexOf = new Map(basis.map((b, k) => [b.atomIndex, k]));
      edges = piBonds.map(b => ({a:indexOf.get(b.i), b:indexOf.get(b.j), d:b.d, beta:-distanceBeta(b.d, atoms[b.i].symbol, atoms[b.j].symbol)}));
      electrons = basis.reduce((s, b) => s + b.electrons, 0);
      if (basis.length === 2 && atoms.length === 2) {
        warnings.push('Diatomic π mode shows one p-orbital component only. Real linear molecules can have σ plus two degenerate π components; use this as a single-component sketch.');
      }
    } else {
      basis = atoms.map((a, k) => ({basisIndex:k, atomIndex:a.index, symbol:a.symbol, label:`center(${a.symbol}${a.index+1})`, alpha:ALPHA_GRAPH[a.symbol] ?? 0, electrons:a.symbol === 'H' ? 1 : 1}));
      edges = bonds.map(b => ({a:b.i, b:b.j, d:b.d, beta:-0.8*distanceBeta(b.d, atoms[b.i].symbol, atoms[b.j].symbol)}));
      electrons = Math.min(2*basis.length, Math.max(0, 2*bonds.length));
      warnings.push('Atom-graph mode uses one qualitative center per atom, not a full valence AO basis. It shows connectivity/frontier localization, not real σ/n/d orbital shapes.');
    }
    if (basis.length < 2) throw new Error('Need at least two basis centers for an MO diagram.');
    return {mode, basis, edges, electrons, warnings};
  }

  function distanceBeta(d, s1, s2) {
    const ideal = (RADII[s1] || 0.77) + (RADII[s2] || 0.77);
    const ratio = d / Math.max(ideal, 0.2);
    return Math.max(0.15, Math.min(1.25, Math.exp(-1.7 * Math.abs(ratio - 0.95))));
  }

  function buildHamiltonian(n, basis, edges) {
    const H = Array.from({length:n}, () => Array(n).fill(0));
    for (let i=0; i<n; i++) H[i][i] = basis[i].alpha;
    for (const e of edges) {
      if (e.a == null || e.b == null) continue;
      H[e.a][e.b] = H[e.b][e.a] = e.beta;
    }
    return H;
  }

  function jacobiEigen(input) {
    const n = input.length;
    let A = input.map(r => r.slice());
    let V = Array.from({length:n}, (_, i) => Array.from({length:n}, (_, j) => i === j ? 1 : 0));
    const maxIter = 100 * n * n;
    for (let iter=0; iter<maxIter; iter++) {
      let p = 0, q = 1, max = 0;
      for (let i=0; i<n; i++) for (let j=i+1; j<n; j++) {
        const v = Math.abs(A[i][j]);
        if (v > max) { max = v; p = i; q = j; }
      }
      if (max < 1e-10) break;
      const app = A[p][p], aqq = A[q][q], apq = A[p][q];
      const tau = (aqq - app) / (2 * apq);
      const t = Math.sign(tau || 1) / (Math.abs(tau) + Math.sqrt(1 + tau*tau));
      const c = 1 / Math.sqrt(1 + t*t);
      const s = t * c;
      for (let k=0; k<n; k++) if (k !== p && k !== q) {
        const akp = A[k][p], akq = A[k][q];
        A[k][p] = A[p][k] = c*akp - s*akq;
        A[k][q] = A[q][k] = s*akp + c*akq;
      }
      A[p][p] = c*c*app - 2*s*c*apq + s*s*aqq;
      A[q][q] = s*s*app + 2*s*c*apq + c*c*aqq;
      A[p][q] = A[q][p] = 0;
      for (let k=0; k<n; k++) {
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c*vkp - s*vkq;
        V[k][q] = s*vkp + c*vkq;
      }
    }
    const pairs = Array.from({length:n}, (_, i) => ({value:A[i][i], vector:V.map(row => row[i])}));
    pairs.sort((a, b) => a.value - b.value);
    return {values:pairs.map(p => p.value), vectors:pairs.map(p => p.vector)};
  }

  function occupations(n, electrons) {
    const occ = Array(n).fill(0);
    let left = Math.max(0, Math.min(2*n, Math.round(electrons)));
    for (let i=0; i<n && left>0; i++) {
      occ[i] = Math.min(2, left);
      left -= occ[i];
    }
    return occ;
  }

  function projection(atoms) {
    const ranges = ['x','y','z'].map(k => ({k, min:Math.min(...atoms.map(a=>a[k])), max:Math.max(...atoms.map(a=>a[k]))}));
    ranges.forEach(r => r.range = r.max - r.min);
    ranges.sort((a,b) => b.range - a.range);
    const ax = ranges[0].k, ay = ranges[1].range > 0.15 ? ranges[1].k : (ranges[0].k === 'x' ? 'y' : 'x');
    return {ax, ay};
  }

  function mapCoords(atoms, width=620, height=420, pad=48) {
    const {ax, ay} = projection(atoms);
    const xs = atoms.map(a => a[ax]), ys = atoms.map(a => a[ay]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const sx = (width - 2*pad) / Math.max(0.1, maxX - minX);
    const sy = (height - 2*pad) / Math.max(0.1, maxY - minY);
    const s = Math.min(sx, sy, 90);
    return atoms.map(a => ({x: width/2 + (a[ax] - (minX+maxX)/2)*s, y: height/2 - (a[ay] - (minY+maxY)/2)*s}));
  }

  function renderEnergyDiagram(data) {
    const el = $('energyDiagram');
    const W = 560, H = 420, pad = 42;
    const vals = data.eigen.values;
    const minE = Math.min(...vals), maxE = Math.max(...vals);
    const span = Math.max(0.5, maxE - minE);
    const y = e => H - pad - ((e - minE) / span) * (H - 2*pad);
    const occ = data.occ;
    const homo = occ.map((o,i)=>o>0?i:-1).filter(i=>i>=0).pop();
    const lumo = occ.findIndex(o => o < 2);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="qualitative MO energy diagram">`;
    svg += `<text x="18" y="28" class="axis-label">energy ↑</text>`;
    vals.forEach((e, i) => {
      const yy = y(e);
      const x1 = 150, x2 = 410;
      const cls = i === selectedMO ? COLORS.selected : COLORS.level;
      svg += `<line x1="${x1}" x2="${x2}" y1="${yy}" y2="${yy}" stroke="${cls}" stroke-width="${i===selectedMO?5:3}" stroke-linecap="round" data-mo="${i}"></line>`;
      if (occ[i] >= 1) svg += `<text x="248" y="${yy-6}" text-anchor="middle" font-size="18" fill="${COLORS.occ}">↑</text>`;
      if (occ[i] >= 2) svg += `<text x="288" y="${yy-6}" text-anchor="middle" font-size="18" fill="${COLORS.occ}">↓</text>`;
      const tags = [];
      if (i === homo) tags.push('HOMO');
      if (i === lumo) tags.push('LUMO');
      const label = `MO ${i+1}  E=${fmt(e,3)}${tags.length?' · '+tags.join('/') : ''}`;
      svg += `<text x="420" y="${yy+4}" font-size="13" fill="${i===selectedMO?COLORS.selected:COLORS.text}">${esc(label)}</text>`;
      svg += `<rect x="${x1-8}" y="${yy-10}" width="${x2-x1+16}" height="20" fill="transparent" data-click-mo="${i}"></rect>`;
    });
    svg += `</svg>`;
    el.innerHTML = svg;
    el.querySelectorAll('[data-click-mo]').forEach(node => node.addEventListener('click', () => selectMO(Number(node.dataset.clickMo))));
  }

  function renderMolecule(data) {
    const el = $('moleculeView');
    const W = 620, H = 420;
    const pts = mapCoords(data.atoms, W, H);
    const vec = data.eigen.vectors[selectedMO] || [];
    const maxC = Math.max(1e-8, ...vec.map(v => Math.abs(v)));
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="selected qualitative molecular orbital on molecule">`;
    for (const b of data.bonds) {
      const p = pts[b.i], q = pts[b.j];
      svg += `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="${COLORS.bond}" stroke-width="3" stroke-linecap="round"></line>`;
    }
    for (const a of data.atoms) {
      const p = pts[a.index];
      svg += `<circle cx="${p.x}" cy="${p.y}" r="12" fill="${COLORS.atom}" stroke="#475467" stroke-width="1.4"></circle>`;
      svg += `<text x="${p.x}" y="${p.y+4}" text-anchor="middle" font-size="12" font-weight="700" fill="${COLORS.text}">${esc(a.symbol)}</text>`;
    }
    for (const b of data.basis) {
      const coeff = vec[b.basisIndex] || 0;
      if (Math.abs(coeff) < 1e-5) continue;
      const p = pts[b.atomIndex];
      const r = 10 + 34 * Math.sqrt(Math.abs(coeff) / maxC);
      const color = coeff >= 0 ? COLORS.pos : COLORS.neg;
      svg += `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${color}" fill-opacity="0.38" stroke="${color}" stroke-width="2"></circle>`;
      svg += `<text x="${p.x}" y="${p.y-r-7}" text-anchor="middle" font-size="12" font-weight="800" fill="${color}">${coeff>=0?'+':'−'}${Math.abs(coeff).toFixed(2)}</text>`;
    }
    svg += `<text x="18" y="26" font-size="13" fill="${COLORS.muted}">${esc(data.modelLabel)} · MO ${selectedMO+1}</text>`;
    svg += `</svg>`;
    el.innerHTML = svg;
  }

  function renderBasisTable(data) {
    const tbody = document.querySelector('#basisTable tbody');
    tbody.innerHTML = data.basis.map((b, i) => {
      const a = data.atoms[b.atomIndex];
      return `<tr><td>${i+1}</td><td>${a.symbol}${a.index+1}</td><td>${a.symbol} (${fmt(a.x,2)}, ${fmt(a.y,2)}, ${fmt(a.z,2)})</td><td>${esc(b.label)}</td><td>${fmt(b.alpha,2)}</td><td>${b.electrons ?? '—'}</td></tr>`;
    }).join('');
  }

  function renderOrbitalInfo(data) {
    const occ = data.occ[selectedMO] || 0;
    const e = data.eigen.values[selectedMO];
    const vec = data.eigen.vectors[selectedMO] || [];
    const contributions = data.basis.map(b => ({b, c:vec[b.basisIndex] || 0, w:(vec[b.basisIndex] || 0)**2}))
      .sort((a,b) => b.w - a.w)
      .slice(0, 5)
      .map(x => `${x.b.symbol}${x.b.atomIndex+1} ${x.c >= 0 ? '+' : '−'}${Math.abs(x.c).toFixed(2)}`)
      .join(', ');
    $('orbitalInfo').innerHTML = `<strong>Selected MO ${selectedMO+1}</strong> · relative energy ${fmt(e,4)} · occupancy ${occ} e⁻ · largest coefficients: ${esc(contributions || 'none')}`;
  }

  function populateMoSelect(data) {
    const select = $('moSelect');
    const homo = data.occ.map((o,i)=>o>0?i:-1).filter(i=>i>=0).pop();
    const lumo = data.occ.findIndex(o => o < 2);
    select.innerHTML = data.eigen.values.map((e, i) => {
      const tags = [];
      if (i === homo) tags.push('HOMO');
      if (i === lumo) tags.push('LUMO');
      return `<option value="${i}">MO ${i+1}: E=${fmt(e,3)} occ=${data.occ[i]}${tags.length?' · '+tags.join('/') : ''}</option>`;
    }).join('');
    select.value = String(selectedMO);
  }

  function renderAll() {
    if (!current) return;
    selectedMO = Math.max(0, Math.min(selectedMO, current.eigen.values.length-1));
    populateMoSelect(current);
    renderEnergyDiagram(current);
    renderMolecule(current);
    renderBasisTable(current);
    renderOrbitalInfo(current);
  }

  function selectMO(i) {
    selectedMO = i;
    renderAll();
  }

  function build() {
    try {
      const atoms = parseXYZ($('xyzInput').value);
      const scale = Number($('bondScale').value) || 1.25;
      const {bonds, degree} = inferBonds(atoms, scale);
      if (!bonds.length) throw new Error('No bonds inferred. Check units/geometry or increase bond scale.');
      const model = buildBasis(atoms, bonds, degree, $('modelSelect').value);
      const H = buildHamiltonian(model.basis.length, model.basis, model.edges);
      const eigen = jacobiEigen(H);
      let electrons = model.electrons;
      const overrideText = $('electronOverride').value.trim();
      const override = Number(overrideText);
      if (overrideText !== '' && Number.isFinite(override) && override >= 0) electrons = override;
      const warnings = model.warnings.slice();
      if (electrons > 2*model.basis.length) {
        warnings.push(`Electron count ${electrons} exceeds two electrons per qualitative basis center; occupancy display is capped at ${2*model.basis.length}.`);
      }
      const occ = occupations(model.basis.length, electrons);
      current = {atoms, bonds, degree, ...model, electronCount:electrons, occ, eigen, modelLabel:model.mode === 'pi' ? 'π-Hückel p-orbital network' : 'atom-graph LCAO sketch'};
      selectedMO = Math.max(0, Math.min(model.basis.length-1, occ.findIndex(o => o < 2) >= 0 ? occ.findIndex(o => o < 2) : model.basis.length-1));
      $('builderStatus').textContent = `${atoms.length} atoms · ${bonds.length} inferred bonds · ${model.basis.length} basis centers · ${current.modelLabel}`;
      $('builderWarnings').innerHTML = warnings.map(w => `<div class="notice compact-warning">${esc(w)}</div>`).join('');
      renderAll();
    } catch (err) {
      current = null;
      $('builderStatus').textContent = 'Build failed.';
      $('builderWarnings').innerHTML = `<div class="notice compact-warning"><strong>Error:</strong> ${esc(err.message || err)}</div>`;
      $('energyDiagram').innerHTML = '';
      $('moleculeView').innerHTML = '';
      $('orbitalInfo').textContent = '';
      document.querySelector('#basisTable tbody').innerHTML = '';
    }
  }

  function init() {
    $('xyzInput').value = EXAMPLES.benzene;
    document.querySelectorAll('[data-example]').forEach(btn => btn.addEventListener('click', () => { $('xyzInput').value = EXAMPLES[btn.dataset.example] || ''; build(); }));
    $('buildMo').addEventListener('click', build);
    $('moSelect').addEventListener('change', () => selectMO(Number($('moSelect').value)));
    build();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
