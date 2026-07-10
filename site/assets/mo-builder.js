(() => {
  'use strict';

  const RADII = {H:0.31, B:0.84, C:0.76, N:0.71, O:0.66, F:0.57, P:1.07, S:1.05, Cl:1.02, Br:1.20, I:1.39, Si:1.11, Li:1.28, Be:0.96, Na:1.66, Mg:1.41, Al:1.21, K:2.03, Ca:1.76, Fe:1.24, Co:1.18, Ni:1.17, Cu:1.17, Zn:1.25};
  const COLORS = {pos:'#2563eb', neg:'#ea580c', atom:'#f8fafc', bond:'#98a2b3', text:'#111827', muted:'#667085', level:'#174ea6', occ:'#111827', selected:'#d97706', bonding:'#059669', antibonding:'#dc2626', through:'#7c3aed'};
  const ALPHA_PI = {B:0.55, C:0.0, N:-0.45, O:-0.9, F:-1.2, P:0.15, S:-0.25, Si:0.25};
  const ALPHA_GRAPH = {H:0.15, B:0.35, C:0.0, N:-0.45, O:-0.85, F:-1.20, P:0.05, S:-0.25, Cl:-0.45, Br:-0.35, I:-0.25, Si:0.20, Fe:-0.15, Co:-0.15, Ni:-0.15, Cu:-0.15, Zn:-0.10};
  const DEG_TOL = 2e-3;

  const EXAMPLES = {
    benzene:{electrons:'', xyz:`12\nbenzene approximate D6h\nC  1.396  0.000  0.000\nC  0.698  1.209  0.000\nC -0.698  1.209  0.000\nC -1.396  0.000  0.000\nC -0.698 -1.209  0.000\nC  0.698 -1.209  0.000\nH  2.479  0.000  0.000\nH  1.240  2.148  0.000\nH -1.240  2.148  0.000\nH -2.479  0.000  0.000\nH -1.240 -2.148  0.000\nH  1.240 -2.148  0.000`},
    ethylene:{electrons:'', xyz:`6\nethylene planar\nC -0.6695  0.0000 0.0000\nC  0.6695  0.0000 0.0000\nH -1.2320  0.9289 0.0000\nH -1.2320 -0.9289 0.0000\nH  1.2320  0.9289 0.0000\nH  1.2320 -0.9289 0.0000`},
    butadiene:{electrons:'4', xyz:`10\ntrans-butadiene approximate planar\nC -2.010  0.000 0.000\nC -0.670  0.000 0.000\nC  0.670  0.000 0.000\nC  2.010  0.000 0.000\nH -2.540  0.930 0.000\nH -2.540 -0.930 0.000\nH -0.670  1.080 0.000\nH  0.670 -1.080 0.000\nH  2.540  0.930 0.000\nH  2.540 -0.930 0.000`},
    hexatriene:{electrons:'6', xyz:`14\nall-trans-hexatriene approximate planar\nC -3.350  0.000 0.000\nC -2.010  0.000 0.000\nC -0.670  0.000 0.000\nC  0.670  0.000 0.000\nC  2.010  0.000 0.000\nC  3.350  0.000 0.000\nH -3.880  0.930 0.000\nH -3.880 -0.930 0.000\nH -2.010  1.080 0.000\nH -0.670 -1.080 0.000\nH  0.670  1.080 0.000\nH  2.010 -1.080 0.000\nH  3.880  0.930 0.000\nH  3.880 -0.930 0.000`},
    polyeneDimer:{electrons:'8', xyz:`8\ncofacial butadiene dimer: two weakly stacked pi systems\nC -2.010 0.000 0.000\nC -0.670 0.000 0.000\nC  0.670 0.000 0.000\nC  2.010 0.000 0.000\nC -1.890 0.180 3.350\nC -0.550 0.180 3.350\nC  0.790 0.180 3.350\nC  2.130 0.180 3.350`},
    naphthalene:{electrons:'10', xyz:`18\nnaphthalene fused aromatic skeleton approximate\nC  0.000  1.396 0.000\nC  1.209  0.698 0.000\nC  1.209 -0.698 0.000\nC  0.000 -1.396 0.000\nC -1.209 -0.698 0.000\nC -1.209  0.698 0.000\nC  2.418  1.396 0.000\nC  3.627  0.698 0.000\nC  3.627 -0.698 0.000\nC  2.418 -1.396 0.000\nH  0.000  2.480 0.000\nH -2.148  1.240 0.000\nH -2.148 -1.240 0.000\nH  0.000 -2.480 0.000\nH  2.418  2.480 0.000\nH  4.566  1.240 0.000\nH  4.566 -1.240 0.000\nH  2.418 -2.480 0.000`},
    pyridine:{electrons:'6', xyz:`11\npyridine approximate planar; N contributes one pi electron\nN  1.396  0.000 0.000\nC  0.698  1.209 0.000\nC -0.698  1.209 0.000\nC -1.396  0.000 0.000\nC -0.698 -1.209 0.000\nC  0.698 -1.209 0.000\nH  1.240  2.148 0.000\nH -1.240  2.148 0.000\nH -2.479  0.000 0.000\nH -1.240 -2.148 0.000\nH  1.240 -2.148 0.000`},
    cyclobutadiene:{electrons:'4', xyz:`8\ncyclobutadiene square antiaromatic toy geometry\nC  0.720  0.720 0.000\nC -0.720  0.720 0.000\nC -0.720 -0.720 0.000\nC  0.720 -0.720 0.000\nH  1.520  1.520 0.000\nH -1.520  1.520 0.000\nH -1.520 -1.520 0.000\nH  1.520 -1.520 0.000`},
    water:{electrons:'', xyz:`3\nwater bent\nO 0.0000 0.0000 0.0000\nH 0.9584 0.0000 0.0000\nH -0.2396 0.9271 0.0000`},
    oxygen:{electrons:'', xyz:`2\noxygen\nO 0.0000 0.0000 0.0000\nO 1.2075 0.0000 0.0000`}
  };

  const $ = (id) => document.getElementById(id);
  const fmt = (x, n=3) => Number.isFinite(x) ? x.toFixed(n) : '—';
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let current = null;
  let selectedMO = 0;
  let degenerateAngle = 0;

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
          bonds.push({i, j, d, kind:'covalent'}); degree[i]++; degree[j]++;
        }
      }
    }
    return {bonds, degree};
  }

  function bondKey(i, j) { return i < j ? `${i}:${j}` : `${j}:${i}`; }
  function isPiElement(sym) { return ['B','C','N','O','P','S','Si'].includes(sym); }

  function hasHydrogenNeighbor(atomIndex, bonds, atoms) {
    return bonds.some(b => (b.i === atomIndex && atoms[b.j].symbol === 'H') || (b.j === atomIndex && atoms[b.i].symbol === 'H'));
  }

  function piElectronGuess(atom, degree, atoms, bonds) {
    const s = atom.symbol;
    const hasH = hasHydrogenNeighbor(atom.index, bonds, atoms);
    if (s === 'B') return 0;
    if (s === 'C' || s === 'Si') return 1;
    if (s === 'N' || s === 'P') return hasH ? 2 : 1;     // pyrrole-like N-H: 2; pyridine/imine-like N: 1
    if (s === 'O' || s === 'S') return degree <= 1 ? 2 : 1;
    return 1;
  }

  function piComponents(n, piBonds, indexOf) {
    const parent = Array.from({length:n}, (_, i) => i);
    const find = (x) => parent[x] === x ? x : (parent[x] = find(parent[x]));
    const unite = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };
    for (const b of piBonds) unite(indexOf.get(b.i), indexOf.get(b.j));
    return parent.map((_, i) => find(i));
  }

  function smallestRangeAxis(atoms) {
    const ranges = ['x','y','z'].map(k => ({k, min:Math.min(...atoms.map(a=>a[k])), max:Math.max(...atoms.map(a=>a[k]))}));
    ranges.forEach(r => r.range = r.max - r.min);
    ranges.sort((a,b) => a.range - b.range);
    return ranges[0].k;
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
    let basis, edges, electrons, throughSpaceCount = 0;
    if (mode === 'pi') {
      basis = piCandidates.map((a, k) => ({basisIndex:k, atomIndex:a.index, symbol:a.symbol, aoType:'pi', label:`pπ(${a.symbol}${a.index+1})`, alpha:ALPHA_PI[a.symbol] ?? 0, electrons:piElectronGuess(a, degree[a.index], atoms, bonds)}));
      const indexOf = new Map(basis.map((b, k) => [b.atomIndex, k]));
      const covalentKeys = new Set(piBonds.map(b => bondKey(b.i, b.j)));
      const comp = piComponents(basis.length, piBonds, indexOf);
      edges = piBonds.map(b => ({a:indexOf.get(b.i), b:indexOf.get(b.j), atomA:b.i, atomB:b.j, d:b.d, beta:-distanceBeta(b.d, atoms[b.i].symbol, atoms[b.j].symbol), kind:'covalent'}));
      for (let p=0; p<basis.length; p++) for (let q=p+1; q<basis.length; q++) {
        const ai = basis[p].atomIndex, aj = basis[q].atomIndex;
        if (covalentKeys.has(bondKey(ai, aj)) || comp[p] === comp[q]) continue;
        const a = atoms[ai], b = atoms[aj], d = dist(a, b);
        let bestNormalSep = 0, bestInPlaneSep = Infinity;
        for (const ax of ['x','y','z']) {
          const normalSep = Math.abs(a[ax] - b[ax]);
          const inPlaneSep = Math.sqrt(Math.max(0, d*d - normalSep*normalSep));
          if (normalSep >= 2.45 && normalSep <= 3.95 && inPlaneSep < bestInPlaneSep) {
            bestNormalSep = normalSep;
            bestInPlaneSep = inPlaneSep;
          }
        }
        if (bestNormalSep && bestInPlaneSep <= 0.80) {
          const beta = -0.18 * Math.exp(-1.35*Math.abs(bestNormalSep - 3.35)) * Math.exp(-1.8*bestInPlaneSep);
          edges.push({a:p, b:q, atomA:ai, atomB:aj, d, beta, kind:'through-space'});
          throughSpaceCount++;
        }
      }
      electrons = basis.reduce((s, b) => s + b.electrons, 0);
      if (throughSpaceCount) warnings.push(`Added ${throughSpaceCount} weak through-space π coupling(s) for stacked/cofacial centers; these are qualitative only.`);
      if (basis.length === 2 && atoms.length === 2) warnings.push('Diatomic π mode shows one p-orbital component only. Real linear molecules can have σ plus two degenerate π components; use this as a single-component sketch.');
    } else {
      basis = atoms.map((a, k) => ({basisIndex:k, atomIndex:a.index, symbol:a.symbol, aoType:'center', label:`center(${a.symbol}${a.index+1})`, alpha:ALPHA_GRAPH[a.symbol] ?? 0, electrons:a.symbol === 'H' ? 1 : 1}));
      edges = bonds.map(b => ({a:b.i, b:b.j, atomA:b.i, atomB:b.j, d:b.d, beta:-0.8*distanceBeta(b.d, atoms[b.i].symbol, atoms[b.j].symbol), kind:'covalent'}));
      electrons = Math.min(2*basis.length, Math.max(0, 2*bonds.length));
      warnings.push('Atom-graph mode uses one qualitative center per atom, not a full valence AO basis. It shows connectivity/frontier localization, not real σ/n/d orbital shapes.');
    }
    if (basis.length < 2) throw new Error('Need at least two basis centers for an MO diagram.');
    return {mode, basis, edges, electrons, warnings, throughSpaceCount};
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
    const maxIter = Math.max(1, 100 * n * n);
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
    const pairs = Array.from({length:n}, (_, i) => ({value:A[i][i], vector:normalizePhase(V.map(row => row[i]))}));
    pairs.sort((a, b) => a.value - b.value);
    return {values:pairs.map(p => p.value), vectors:pairs.map(p => p.vector)};
  }

  function normalizePhase(v) {
    let idx = 0, max = 0;
    for (let i=0; i<v.length; i++) if (Math.abs(v[i]) > max) { max = Math.abs(v[i]); idx = i; }
    if (v[idx] < 0) return v.map(x => -x);
    return v.slice();
  }

  function detectDegenerateGroups(values, tol=DEG_TOL) {
    const groups = [];
    let start = 0;
    for (let i=1; i<=values.length; i++) {
      if (i === values.length || Math.abs(values[i] - values[i-1]) > tol) {
        if (i - start > 1) groups.push({indices:Array.from({length:i-start}, (_, k) => start+k), energy:values[start], size:i-start});
        start = i;
      }
    }
    return groups;
  }

  function orientDegenerateSubspaces(eigen, groups, basis, atoms) {
    const vectors = eigen.vectors.map(v => v.slice());
    const coords = basis.map(b => {
      const a = atoms[b.atomIndex];
      return a.x + 0.381966*a.y + 0.141421*a.z;
    });
    for (const group of groups) {
      const m = group.indices.length;
      const M = Array.from({length:m}, () => Array(m).fill(0));
      for (let a=0; a<m; a++) for (let b=0; b<m; b++) {
        let s = 0;
        for (let k=0; k<coords.length; k++) s += vectors[group.indices[a]][k] * coords[k] * vectors[group.indices[b]][k];
        M[a][b] = s;
      }
      const sub = jacobiEigen(M);
      const old = group.indices.map(i => vectors[i].slice());
      for (let col=0; col<m; col++) {
        const combo = Array(old[0].length).fill(0);
        for (let a=0; a<m; a++) {
          const coeff = sub.vectors[col][a];
          for (let k=0; k<combo.length; k++) combo[k] += coeff * old[a][k];
        }
        vectors[group.indices[col]] = normalizePhase(combo);
      }
    }
    return {values:eigen.values.slice(), vectors};
  }

  function groupForMo(data, mo) {
    return data.degenerateGroups.find(g => g.indices.includes(mo)) || null;
  }

  function groupLabel(group) { return group.indices.map(i => `MO ${i+1}`).join('/'); }

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
    return {ax, ay, normal: smallestRangeAxis(atoms)};
  }

  function mapCoords(atoms, width=620, height=420, pad=52) {
    const proj = projection(atoms);
    const xs = atoms.map(a => a[proj.ax]), ys = atoms.map(a => a[proj.ay]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const sx = (width - 2*pad) / Math.max(0.1, maxX - minX);
    const sy = (height - 2*pad) / Math.max(0.1, maxY - minY);
    const s = Math.min(sx, sy, 92);
    return {pts: atoms.map(a => ({x: width/2 + (a[proj.ax] - (minX+maxX)/2)*s, y: height/2 - (a[proj.ay] - (minY+maxY)/2)*s})), proj};
  }

  function selectedVector(data) {
    const group = groupForMo(data, selectedMO);
    if (!group || group.indices.length < 2) return data.eigen.vectors[selectedMO] || [];
    const vecs = data.eigen.vectors.map(v => v.slice());
    const theta = degenerateAngle * Math.PI / 180;
    const c = Math.cos(theta), s = Math.sin(theta);
    if (group.indices.length === 2) {
      const i = group.indices[0], j = group.indices[1];
      const vi = vecs[i], vj = vecs[j];
      vecs[i] = vi.map((x, k) => c*x + s*vj[k]);
      vecs[j] = vi.map((x, k) => -s*x + c*vj[k]);
      return normalizePhase(vecs[selectedMO]);
    }
    const pos = group.indices.indexOf(selectedMO);
    const j = group.indices[(pos + 1) % group.indices.length];
    const vi = vecs[selectedMO], vj = vecs[j];
    return normalizePhase(vi.map((x, k) => c*x + s*vj[k]));
  }

  function renderEnergyDiagram(data) {
    const el = $('energyDiagram');
    const W = 600, H = 420, pad = 42;
    const vals = data.eigen.values;
    const minE = Math.min(...vals), maxE = Math.max(...vals);
    const span = Math.max(0.5, maxE - minE);
    const y = e => H - pad - ((e - minE) / span) * (H - 2*pad);
    const occ = data.occ;
    const homo = occ.map((o,i)=>o>0?i:-1).filter(i=>i>=0).pop();
    const lumo = occ.findIndex(o => o < 2);
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="qualitative MO energy diagram">`;
    svg += `<text x="18" y="28" class="axis-label">energy ↑</text>`;
    const drawnGroups = new Set();
    vals.forEach((e, i) => {
      const group = groupForMo(data, i);
      const slot = group ? group.indices.indexOf(i) : 0;
      const slots = group ? group.indices.length : 1;
      const split = group ? Math.min(20, 34 / Math.max(1, slots - 1)) : 0;
      const dy = group ? (slot - (slots-1)/2) * split : 0;
      const dx = group ? (slot - (slots-1)/2) * 6 : 0;
      const baseY = y(e);
      const yy = baseY + dy;
      const x1 = 138 + dx, x2 = 390 + dx;
      const cls = i === selectedMO ? COLORS.selected : COLORS.level;
      if (group && !drawnGroups.has(group.indices.join(','))) {
        drawnGroups.add(group.indices.join(','));
        const yMin = baseY - (slots-1)*split/2;
        const yMax = baseY + (slots-1)*split/2;
        svg += `<line x1="120" x2="120" y1="${yMin}" y2="${yMax}" stroke="#98a2b3" stroke-width="1.4" stroke-dasharray="3 4"></line>`;
        svg += `<text x="124" y="${baseY-6}" font-size="10" fill="#667085">same E</text>`;
      }
      svg += `<line x1="${x1}" x2="${x2}" y1="${yy}" y2="${yy}" stroke="${cls}" stroke-width="${i===selectedMO?5:3}" stroke-linecap="round" data-mo="${i}"></line>`;
      if (occ[i] >= 1) svg += `<text x="${244+dx}" y="${yy-6}" text-anchor="middle" font-size="18" fill="${COLORS.occ}">↑</text>`;
      if (occ[i] >= 2) svg += `<text x="${284+dx}" y="${yy-6}" text-anchor="middle" font-size="18" fill="${COLORS.occ}">↓</text>`;
      const tags = [];
      if (i === homo) tags.push('HOMO');
      if (i === lumo) tags.push('LUMO');
      if (group) tags.push(`deg ${group.indices.map(x => x+1).join('/')}`);
      const label = `MO ${i+1} E=${fmt(e,3)}${tags.length?' · '+tags.join(' · ') : ''}`;
      svg += `<text x="410" y="${yy+4}" font-size="12" fill="${i===selectedMO?COLORS.selected:COLORS.text}">${esc(label)}</text>`;
      svg += `<rect x="${x1-8}" y="${yy-13}" width="${x2-x1+16}" height="26" fill="transparent" data-click-mo="${i}"></rect>`;
    });
    svg += `</svg>`;
    el.innerHTML = svg;
    el.querySelectorAll('[data-click-mo]').forEach(node => node.addEventListener('click', () => selectMO(Number(node.dataset.clickMo))));
  }

  function coeffColor(c, positiveLobe=true) {
    const same = c >= 0 ? positiveLobe : !positiveLobe;
    return same ? COLORS.pos : COLORS.neg;
  }

  function renderPiLobes(svg, p, coeff, size) {
    const dx = Math.max(7, size*0.35), dy = -Math.max(10, size*0.48);
    const r = size;
    const top = coeffColor(coeff, true), bottom = coeffColor(coeff, false);
    svg.parts.push(`<ellipse cx="${p.x+dx}" cy="${p.y+dy}" rx="${r*0.70}" ry="${r}" transform="rotate(-32 ${p.x+dx} ${p.y+dy})" fill="${top}" fill-opacity="0.42" stroke="${top}" stroke-width="1.8"></ellipse>`);
    svg.parts.push(`<ellipse cx="${p.x-dx}" cy="${p.y-dy}" rx="${r*0.70}" ry="${r}" transform="rotate(-32 ${p.x-dx} ${p.y-dy})" fill="${bottom}" fill-opacity="0.34" stroke="${bottom}" stroke-width="1.8"></ellipse>`);
  }

  function renderMolecule(data) {
    const el = $('moleculeView');
    const W = 640, H = 430;
    const mapped = mapCoords(data.atoms, W, H);
    const pts = mapped.pts;
    const vec = selectedVector(data);
    const maxC = Math.max(1e-8, ...vec.map(v => Math.abs(v)));
    const svg = {parts:[`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="selected qualitative molecular orbital on molecule">`]};

    for (const e of data.edges || []) {
      if (Math.abs((vec[e.a] || 0) * (vec[e.b] || 0)) < 0.002) continue;
      const p = pts[data.basis[e.a].atomIndex], q = pts[data.basis[e.b].atomIndex];
      const samePhase = (vec[e.a] || 0) * (vec[e.b] || 0) >= 0;
      const color = e.kind === 'through-space' ? COLORS.through : (samePhase ? COLORS.bonding : COLORS.antibonding);
      const dash = e.kind === 'through-space' ? '4 5' : (samePhase ? '' : '7 5');
      svg.parts.push(`<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="${color}" stroke-width="${e.kind === 'through-space' ? 2.5 : 3.5}" stroke-opacity="0.58" stroke-dasharray="${dash}"></line>`);
    }
    for (const b of data.bonds) {
      const p = pts[b.i], q = pts[b.j];
      svg.parts.push(`<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="${COLORS.bond}" stroke-width="2.5" stroke-linecap="round" stroke-opacity="0.75"></line>`);
    }

    if (data.mode === 'pi') {
      for (const b of data.basis) {
        const coeff = vec[b.basisIndex] || 0;
        if (Math.abs(coeff) < 1e-5) continue;
        const p = pts[b.atomIndex];
        const size = 7 + 21 * Math.sqrt(Math.abs(coeff) / maxC);
        renderPiLobes(svg, p, coeff, size);
        const color = coeff >= 0 ? COLORS.pos : COLORS.neg;
        svg.parts.push(`<text x="${p.x}" y="${p.y-size-22}" text-anchor="middle" font-size="11" font-weight="800" fill="${color}">${coeff>=0?'+':'−'}${Math.abs(coeff).toFixed(2)}</text>`);
      }
    } else {
      for (const b of data.basis) {
        const coeff = vec[b.basisIndex] || 0;
        if (Math.abs(coeff) < 1e-5) continue;
        const p = pts[b.atomIndex];
        const r = 10 + 34 * Math.sqrt(Math.abs(coeff) / maxC);
        const color = coeff >= 0 ? COLORS.pos : COLORS.neg;
        svg.parts.push(`<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${color}" fill-opacity="0.38" stroke="${color}" stroke-width="2"></circle>`);
        svg.parts.push(`<text x="${p.x}" y="${p.y-r-7}" text-anchor="middle" font-size="12" font-weight="800" fill="${color}">${coeff>=0?'+':'−'}${Math.abs(coeff).toFixed(2)}</text>`);
      }
    }

    for (const a of data.atoms) {
      const p = pts[a.index];
      svg.parts.push(`<circle cx="${p.x}" cy="${p.y}" r="10.5" fill="${COLORS.atom}" stroke="#475467" stroke-width="1.3"></circle>`);
      svg.parts.push(`<text x="${p.x}" y="${p.y+4}" text-anchor="middle" font-size="11" font-weight="800" fill="${COLORS.text}">${esc(a.symbol)}</text>`);
    }
    const group = groupForMo(data, selectedMO);
    const extra = group ? ` · ${esc(groupLabel(group))} rotated ${degenerateAngle}°` : '';
    svg.parts.push(`<text x="18" y="24" font-size="12" fill="${COLORS.muted}">${esc(data.modelLabel)} · MO ${selectedMO+1}${extra}</text>`);
    if (data.mode === 'pi') {
      svg.parts.push(`<text x="18" y="43" font-size="12" fill="${COLORS.muted}">pπ AO normal ≈ ${mapped.proj.normal}-axis; paired lobes show opposite AO phases above/below the molecular plane</text>`);
      svg.parts.push(`<text x="18" y="${H-18}" font-size="12" fill="${COLORS.bonding}">green=same-phase bonding</text><text x="180" y="${H-18}" font-size="12" fill="${COLORS.antibonding}">red=different-phase/node</text><text x="365" y="${H-18}" font-size="12" fill="${COLORS.through}">purple=through-space π</text>`);
    }
    svg.parts.push(`</svg>`);
    el.innerHTML = svg.parts.join('');
  }

  function renderBasisTable(data) {
    const tbody = document.querySelector('#basisTable tbody');
    tbody.innerHTML = data.basis.map((b, i) => {
      const a = data.atoms[b.atomIndex];
      return `<tr><td>${i+1}</td><td>${a.symbol}${a.index+1}</td><td>${a.symbol} (${fmt(a.x,2)}, ${fmt(a.y,2)}, ${fmt(a.z,2)})</td><td>${esc(b.label)}</td><td>${fmt(b.alpha,2)}</td><td>${b.electrons ?? '—'}</td></tr>`;
    }).join('');
  }

  function renderDegenerateControls(data) {
    const panel = $('degenerateControls');
    if (!panel) return;
    const group = groupForMo(data, selectedMO);
    if (!group) {
      panel.innerHTML = '<p class="help-text">No exact/near degeneracy for the selected state in this qualitative model.</p>';
      return;
    }
    panel.innerHTML = `<div class="degenerate-box"><strong>Degenerate/near-degenerate subspace:</strong> ${esc(groupLabel(group))} at E≈${fmt(group.energy,5)}. Individual members are not unique; any real rotation inside this subspace is the same MO space. For active spaces, include the whole group.<label>Rotate displayed component inside this group <input id="degenerateAngle" type="range" min="0" max="180" step="1" value="${degenerateAngle}"><span id="degenerateAngleValue">${degenerateAngle}°</span></label></div>`;
    const slider = $('degenerateAngle');
    slider.addEventListener('input', () => {
      degenerateAngle = Number(slider.value) || 0;
      $('degenerateAngleValue').textContent = `${degenerateAngle}°`;
      renderMolecule(data);
      renderOrbitalInfo(data);
    });
  }

  function renderOrbitalInfo(data) {
    const occ = data.occ[selectedMO] || 0;
    const e = data.eigen.values[selectedMO];
    const vec = selectedVector(data);
    const contributions = data.basis.map(b => ({b, c:vec[b.basisIndex] || 0, w:(vec[b.basisIndex] || 0)**2}))
      .sort((a,b) => b.w - a.w)
      .slice(0, 7)
      .map(x => `${x.b.symbol}${x.b.atomIndex+1} ${x.c >= 0 ? '+' : '−'}${Math.abs(x.c).toFixed(2)}`)
      .join(', ');
    const group = groupForMo(data, selectedMO);
    const deg = group ? ` · degenerate group ${esc(groupLabel(group))}; displayed vector rotated ${degenerateAngle}°` : '';
    $('orbitalInfo').innerHTML = `<strong>Selected MO ${selectedMO+1}</strong> · relative energy ${fmt(e,4)} · occupancy ${occ} e⁻${deg} · largest coefficients: ${esc(contributions || 'none')}`;
  }

  function populateMoSelect(data) {
    const select = $('moSelect');
    const homo = data.occ.map((o,i)=>o>0?i:-1).filter(i=>i>=0).pop();
    const lumo = data.occ.findIndex(o => o < 2);
    select.innerHTML = data.eigen.values.map((e, i) => {
      const tags = [];
      if (i === homo) tags.push('HOMO');
      if (i === lumo) tags.push('LUMO');
      const group = groupForMo(data, i);
      if (group) tags.push(`deg ${group.indices.map(x => x+1).join('/')}`);
      return `<option value="${i}">MO ${i+1}: E=${fmt(e,3)} occ=${data.occ[i]}${tags.length?' · '+tags.join(' · ') : ''}</option>`;
    }).join('');
    select.value = String(selectedMO);
  }

  function renderAll() {
    if (!current) return;
    selectedMO = Math.max(0, Math.min(selectedMO, current.eigen.values.length-1));
    populateMoSelect(current);
    renderDegenerateControls(current);
    renderEnergyDiagram(current);
    renderMolecule(current);
    renderBasisTable(current);
    renderOrbitalInfo(current);
  }

  function selectMO(i) {
    selectedMO = i;
    degenerateAngle = 0;
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
      let eigen = jacobiEigen(H);
      const degenerateGroups = detectDegenerateGroups(eigen.values);
      eigen = orientDegenerateSubspaces(eigen, degenerateGroups, model.basis, atoms);
      let electrons = model.electrons;
      const overrideText = $('electronOverride').value.trim();
      const override = Number(overrideText);
      if (overrideText !== '' && Number.isFinite(override) && override >= 0) electrons = override;
      const warnings = model.warnings.slice();
      if (electrons > 2*model.basis.length) warnings.push(`Electron count ${electrons} exceeds two electrons per qualitative basis center; occupancy display is capped at ${2*model.basis.length}.`);
      if (degenerateGroups.length) warnings.push(`Degenerate/near-degenerate subspace(s) detected: ${degenerateGroups.map(groupLabel).join('; ')}. The displayed individual orbitals are one valid oriented basis; rotate them with the slider and include the full group when choosing an active space.`);
      const occ = occupations(model.basis.length, electrons);
      current = {atoms, bonds, degree, ...model, electronCount:electrons, occ, eigen, degenerateGroups, modelLabel:model.mode === 'pi' ? 'π-Hückel p-orbital network' : 'atom-graph LCAO sketch'};
      degenerateAngle = 0;
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
      const dc = $('degenerateControls'); if (dc) dc.innerHTML = '';
      document.querySelector('#basisTable tbody').innerHTML = '';
    }
  }

  function loadExample(name) {
    const ex = EXAMPLES[name];
    if (!ex) return;
    $('xyzInput').value = ex.xyz;
    $('electronOverride').value = ex.electrons || '';
    build();
  }

  function init() {
    loadExample('benzene');
    document.querySelectorAll('[data-example]').forEach(btn => btn.addEventListener('click', () => loadExample(btn.dataset.example)));
    $('buildMo').addEventListener('click', build);
    $('moSelect').addEventListener('change', () => selectMO(Number($('moSelect').value)));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
