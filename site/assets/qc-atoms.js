(() => {
  'use strict';

  const HARTREE_EV = 27.211386245981;
  const HC_EV_NM = 1239.8419843320025;
  const ORBITAL_LETTERS = ['s', 'p', 'd', 'f', 'g', 'h'];
  const TERM_LETTERS = ['S', 'P', 'D', 'F', 'G', 'H', 'I', 'K', 'L', 'M', 'N', 'O', 'Q'];
  const BOX_STATES = Object.freeze({ empty: 0, up: 1, down: 1, pair: 2, upup: 2, downdown: 2 });
  const BOX_CYCLE = Object.freeze(['empty', 'up', 'down', 'pair', 'upup', 'downdown']);
  const PAULI_INVALID_STATES = new Set(['upup', 'downdown']);
  const ELEMENTS = [
    null,
    ['H', 'Hydrogen'], ['He', 'Helium'], ['Li', 'Lithium'], ['Be', 'Beryllium'], ['B', 'Boron'], ['C', 'Carbon'], ['N', 'Nitrogen'], ['O', 'Oxygen'], ['F', 'Fluorine'], ['Ne', 'Neon'],
    ['Na', 'Sodium'], ['Mg', 'Magnesium'], ['Al', 'Aluminium'], ['Si', 'Silicon'], ['P', 'Phosphorus'], ['S', 'Sulfur'], ['Cl', 'Chlorine'], ['Ar', 'Argon'], ['K', 'Potassium'], ['Ca', 'Calcium'],
    ['Sc', 'Scandium'], ['Ti', 'Titanium'], ['V', 'Vanadium'], ['Cr', 'Chromium'], ['Mn', 'Manganese'], ['Fe', 'Iron'], ['Co', 'Cobalt'], ['Ni', 'Nickel'], ['Cu', 'Copper'], ['Zn', 'Zinc'],
    ['Ga', 'Gallium'], ['Ge', 'Germanium'], ['As', 'Arsenic'], ['Se', 'Selenium'], ['Br', 'Bromine'], ['Kr', 'Krypton']
  ];
  const AUFBAU = Object.freeze([
    { n: 1, l: 0, key: '1s' }, { n: 2, l: 0, key: '2s' }, { n: 2, l: 1, key: '2p' },
    { n: 3, l: 0, key: '3s' }, { n: 3, l: 1, key: '3p' }, { n: 4, l: 0, key: '4s' },
    { n: 3, l: 2, key: '3d' }, { n: 4, l: 1, key: '4p' }
  ]);
  const MODEL_PASSPORT_CASES = Object.freeze({
    'h-like-energy': { title: 'Nonrelativistic H-like ion energy', expected: 'coulomb-exact', note: 'Exact only for the stated infinite-mass one-electron Coulomb Hamiltonian.' },
    'neutral-configuration': { title: 'Neutral Cr ground configuration', expected: 'configuration-ledger', note: 'An empirical ledger entry, not a deduction from the Madelung order alone.' },
    'carbon-screening': { title: 'Carbon 2p effective charge', expected: 'slater-approximation', note: 'Slater rules provide a named screening estimate.' },
    'triplet-p-ladder': { title: 'A supplied-A triplet-P ladder', expected: 'ls-coupling-model', note: 'An ideal A L·S model, not a complete relativistic spectrum.' }
  });
  const ATOMIC_CASES = Object.freeze({
    'oxygen-file': {
      title: 'Oxygen ground-configuration file',
      expected: { model: 'configuration-ledger', unpaired: 2, magnetic: 'paramagnetic', caveat: 'not-ab-initio' }
    },
    'lyman-file': {
      title: 'Hydrogenic 2p → 1s file',
      expected: { model: 'coulomb-exact', allowed: true, direction: 'emission', caveat: 'not-experimental' }
    }
  });

  const $ = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const hasBoxState = state => Object.prototype.hasOwnProperty.call(BOX_STATES, state);
  const nextBoxState = state => {
    if (!hasBoxState(state)) throw new RangeError(`unknown orbital-box state: ${state}`);
    return BOX_CYCLE[(BOX_CYCLE.indexOf(state) + 1) % BOX_CYCLE.length];
  };
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const factorial = value => {
    let result = 1;
    for (let item = 2; item <= value; item += 1) result *= item;
    return result;
  };
  const trapz = (points, xKey, yKey) => {
    let total = 0;
    for (let index = 1; index < points.length; index += 1) {
      total += 0.5 * (points[index - 1][yKey] + points[index][yKey]) * (points[index][xKey] - points[index - 1][xKey]);
    }
    return total;
  };

  function evaluateModelPassport(caseId, selection) {
    const caseFile = MODEL_PASSPORT_CASES[caseId];
    if (!caseFile) throw new RangeError(`unknown model-passport case: ${caseId}`);
    return { caseId, title: caseFile.title, expected: caseFile.expected, selection, correct: selection === caseFile.expected, note: caseFile.note };
  }

  function quantumState(n, l, m) {
    if (![n, l, m].every(Number.isInteger)) return { valid: false, reason: 'n, l, and m must be integers.' };
    if (n < 1) return { valid: false, reason: 'n must be at least 1.' };
    if (l < 0 || l >= n) return { valid: false, reason: 'l must satisfy 0 ≤ l ≤ n−1.' };
    if (Math.abs(m) > l) return { valid: false, reason: 'm must satisfy −l ≤ m ≤ +l.' };
    const letter = ORBITAL_LETTERS[l] || `l=${l}`;
    return {
      valid: true,
      n, l, m,
      label: `${n}${letter}`,
      radialNodes: n - l - 1,
      angularNodes: l,
      totalNodes: n - 1,
      subshellOrbitals: 2 * l + 1,
      subshellCapacity: 2 * (2 * l + 1),
      spatialDegeneracy: n * n,
      shellCapacity: 2 * n * n
    };
  }

  function hydrogenicEnergy(n, l = 0, z = 1) {
    const state = quantumState(n, l, 0);
    if (!state.valid || !Number.isFinite(z) || z <= 0) throw new RangeError('hydrogenicEnergy requires valid n, l and Z>0');
    const hartree = -z * z / (2 * n * n);
    return {
      ...state,
      z,
      hartree,
      eV: hartree * HARTREE_EV,
      meanRadius: (3 * n * n - l * (l + 1)) / (2 * z)
    };
  }

  function associatedLaguerre(order, alpha, x) {
    if (!Number.isInteger(order) || order < 0 || !Number.isFinite(alpha) || !Number.isFinite(x)) throw new RangeError('invalid generalized Laguerre arguments');
    if (order === 0) return 1;
    if (order === 1) return 1 + alpha - x;
    let previous = 1;
    let current = 1 + alpha - x;
    for (let n = 1; n < order; n += 1) {
      const next = ((2 * n + 1 + alpha - x) * current - (n + alpha) * previous) / (n + 1);
      previous = current;
      current = next;
    }
    return current;
  }

  function radialNodes(n, l, z = 1) {
    const state = quantumState(n, l, 0);
    if (!state.valid || !Number.isFinite(z) || z <= 0) throw new RangeError('radialNodes requires valid n, l and Z>0');
    const order = n - l - 1;
    if (!order) return [];
    const alpha = 2 * l + 1;
    const rhoMax = 4 * order + 2 * alpha + 10;
    const samples = 8000;
    const roots = [];
    let left = 0;
    let fLeft = associatedLaguerre(order, alpha, left);
    for (let index = 1; index <= samples && roots.length < order; index += 1) {
      const right = rhoMax * index / samples;
      const fRight = associatedLaguerre(order, alpha, right);
      if (Math.abs(fRight) < 1e-12) {
        roots.push(n * right / (2 * z));
      } else if (fLeft * fRight < 0) {
        let a = left, b = right, fa = fLeft;
        for (let step = 0; step < 70; step += 1) {
          const middle = 0.5 * (a + b);
          const fm = associatedLaguerre(order, alpha, middle);
          if (fa * fm <= 0) b = middle;
          else { a = middle; fa = fm; }
        }
        roots.push(n * 0.5 * (a + b) / (2 * z));
      }
      left = right;
      fLeft = fRight;
    }
    if (roots.length !== order) throw new Error(`failed to bracket all ${order} radial nodes`);
    return roots;
  }

  function hydrogenicRadial(n, l, z, r) {
    const rho = 2 * z * r / n;
    const normalization = Math.sqrt((2 * z / n) ** 3 * factorial(n - l - 1) / (2 * n * factorial(n + l)));
    return normalization * Math.exp(-rho / 2) * rho ** l * associatedLaguerre(n - l - 1, 2 * l + 1, rho);
  }

  function radialModel(n, l, z = 1) {
    const state = quantumState(n, l, 0);
    if (!state.valid || !Number.isFinite(z) || z <= 0) throw new RangeError('radialModel requires valid n, l and Z>0');
    const rMax = n * (8 * n + 20) / (2 * z);
    const pointCount = 1601;
    const points = Array.from({ length: pointCount }, (_unused, index) => {
      const r = rMax * index / (pointCount - 1);
      const radial = hydrogenicRadial(n, l, z, r);
      return { r, radial, probability: r * r * radial * radial };
    });
    return { ...state, z, rMax, points, nodes: radialNodes(n, l, z), normalization: trapz(points, 'r', 'probability') };
  }

  function angularAmplitude(kind, x, y, z, angle = 0) {
    if (![x, y, z, angle].every(Number.isFinite)) throw new RangeError('angular coordinates must be finite');
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const xr = cosine * x + sine * y;
    const yr = -sine * x + cosine * y;
    const radius2 = xr * xr + yr * yr + z * z;
    if (kind === 's') return 1;
    if (!radius2) return 0;
    const radius = Math.sqrt(radius2);
    const functions = {
      px: () => xr / radius,
      py: () => yr / radius,
      pz: () => z / radius,
      dxy: () => xr * yr / radius2,
      dxz: () => xr * z / radius2,
      dyz: () => yr * z / radius2,
      dx2y2: () => (xr * xr - yr * yr) / radius2,
      dz2: () => (2 * z * z - xr * xr - yr * yr) / radius2
    };
    if (!functions[kind]) throw new RangeError(`unknown real orbital shape: ${kind}`);
    return functions[kind]();
  }

  function angularSlice(kind, plane = 'xz', angle = 0, resolution = 21) {
    if (!Number.isInteger(resolution) || resolution < 5) throw new RangeError('angular slice resolution must be an integer ≥5');
    const points = [];
    let maxAbs = 0;
    for (let row = 0; row < resolution; row += 1) {
      const v = 1 - 2 * row / (resolution - 1);
      for (let column = 0; column < resolution; column += 1) {
        const u = -1 + 2 * column / (resolution - 1);
        const coordinates = plane === 'xy' ? [u, v, 0] : plane === 'yz' ? [0, u, v] : [u, 0, v];
        const value = angularAmplitude(kind, ...coordinates, angle);
        maxAbs = Math.max(maxAbs, Math.abs(value));
        points.push({ u, v, value, inside: u * u + v * v <= 1.02 });
      }
    }
    return { kind, plane, angle, resolution, points, maxAbs };
  }

  function transitionModel(initial, final, z = 1) {
    const from = quantumState(initial.n, initial.l, initial.m);
    const to = quantumState(final.n, final.l, final.m);
    if (!from.valid || !to.valid) throw new RangeError('transition states must have valid n, l, m');
    const initialEnergy = hydrogenicEnergy(initial.n, initial.l, z);
    const finalEnergy = hydrogenicEnergy(final.n, final.l, z);
    const deltaHartree = finalEnergy.hartree - initialEnergy.hartree;
    const deltaEV = deltaHartree * HARTREE_EV;
    const deltaL = final.l - initial.l;
    const deltaM = final.m - initial.m;
    const angularAllowed = Math.abs(deltaL) === 1 && Math.abs(deltaM) <= 1;
    const threshold = 1e-14;
    const direction = deltaHartree > threshold ? 'absorption' : deltaHartree < -threshold ? 'emission' : 'degenerate';
    return {
      from, to, z, initialEnergy, finalEnergy, deltaL, deltaM, angularAllowed, direction,
      deltaHartree, deltaEV,
      wavelengthNm: direction === 'degenerate' ? null : HC_EV_NM / Math.abs(deltaEV)
    };
  }

  function canonicalBoxes(l, electrons) {
    const orbitals = 2 * l + 1;
    const boxes = Array(orbitals).fill('empty');
    for (let index = 0; index < Math.min(electrons, orbitals); index += 1) boxes[index] = 'up';
    for (let index = 0; index < Math.max(0, electrons - orbitals); index += 1) boxes[index] = 'pair';
    return boxes;
  }

  function groundConfiguration(z) {
    if (!Number.isInteger(z) || z < 1 || z > 36) throw new RangeError('groundConfiguration supports neutral H–Kr (Z=1…36)');
    let remaining = z;
    const byKey = {};
    for (const shell of AUFBAU) {
      const electrons = Math.min(remaining, 2 * (2 * shell.l + 1));
      byKey[shell.key] = electrons;
      remaining -= electrons;
      if (!remaining) break;
    }
    if (z === 24) { byKey['4s'] = 1; byKey['3d'] = 5; }
    if (z === 29) { byKey['4s'] = 1; byKey['3d'] = 10; }
    const subshells = AUFBAU.filter(shell => (byKey[shell.key] || 0) > 0).map(shell => ({
      ...shell,
      electrons: byKey[shell.key],
      capacity: 2 * (2 * shell.l + 1),
      boxes: canonicalBoxes(shell.l, byKey[shell.key])
    }));
    const boxesByKey = Object.fromEntries(subshells.map(shell => [shell.key, [...shell.boxes]]));
    const lastIndex = Math.max(...subshells.map(shell => AUFBAU.findIndex(item => item.key === shell.key)));
    const availableSubshells = AUFBAU.slice(0, Math.min(AUFBAU.length, lastIndex + 2)).map(shell => ({ ...shell, capacity: 2 * (2 * shell.l + 1) }));
    return {
      z,
      symbol: ELEMENTS[z][0],
      name: ELEMENTS[z][1],
      electronCount: Object.values(byKey).reduce((sum, count) => sum + count, 0),
      byKey,
      subshells,
      boxesByKey,
      availableSubshells,
      notation: subshells.map(shell => `${shell.key}${shell.electrons}`).join(' ')
    };
  }

  function configurationAudit(z, proposal = {}) {
    const expected = groundConfiguration(z);
    const issues = new Set();
    let electronCount = 0;
    const knownKeys = new Set(expected.availableSubshells.map(shell => shell.key));
    for (const key of Object.keys(proposal || {})) if (!knownKeys.has(key)) issues.add('unknown-subshell');
    for (const shell of expected.availableSubshells) {
      const states = Array.isArray(proposal?.[shell.key]) ? proposal[shell.key] : Array(2 * shell.l + 1).fill('empty');
      if (states.length !== 2 * shell.l + 1) issues.add('capacity');
      const validStates = states.slice(0, 2 * shell.l + 1);
      if (validStates.some(state => !hasBoxState(state) || PAULI_INVALID_STATES.has(state))) issues.add('pauli');
      const safeStates = validStates.map(state => hasBoxState(state) ? state : 'empty');
      const electrons = safeStates.reduce((sum, state) => sum + BOX_STATES[state], 0);
      electronCount += electrons;
      const pairs = safeStates.filter(state => state === 'pair' || PAULI_INVALID_STATES.has(state)).length;
      const singles = safeStates.filter(state => state === 'up' || state === 'down');
      const orbitals = 2 * shell.l + 1;
      const expectedPairs = Math.max(0, electrons - orbitals);
      const expectedSingles = electrons - 2 * expectedPairs;
      if (pairs !== expectedPairs || singles.length !== expectedSingles || new Set(singles).size > 1) issues.add('hund');
      if (electrons !== (expected.byKey[shell.key] || 0)) issues.add('aufbau');
    }
    if (electronCount !== z) issues.add('electron-count');
    return { ok: issues.size === 0, z, electronCount, expectedElectrons: z, issues: [...issues], expected };
  }

  function slaterEffectiveCharge(z, targetKey) {
    const configuration = groundConfiguration(z);
    const target = AUFBAU.find(shell => shell.key === targetKey);
    if (!target || !(targetKey in configuration.byKey) || !configuration.byKey[targetKey]) throw new RangeError('target orbital must be occupied in the neutral H–Kr ledger');
    const contributions = [];
    const add = (label, electrons, weight) => {
      if (electrons > 0) contributions.push({ label, electrons, weight, screening: electrons * weight });
    };
    if (target.l <= 1) {
      const sameGroup = configuration.subshells.filter(shell => shell.n === target.n && shell.l <= 1).reduce((sum, shell) => sum + shell.electrons, 0) - 1;
      const previousShell = configuration.subshells.filter(shell => shell.n === target.n - 1).reduce((sum, shell) => sum + shell.electrons, 0);
      const lowerShells = configuration.subshells.filter(shell => shell.n <= target.n - 2).reduce((sum, shell) => sum + shell.electrons, 0);
      add(`same ${target.n}s/${target.n}p group`, sameGroup, target.n === 1 ? 0.30 : 0.35);
      add(`n−1 shell`, previousShell, 0.85);
      add('n−2 and lower shells', lowerShells, 1.00);
    } else {
      add(`same ${targetKey} group`, configuration.byKey[targetKey] - 1, 0.35);
      const left = configuration.subshells.filter(shell => shell.n < target.n || (shell.n === target.n && shell.l < target.l)).reduce((sum, shell) => sum + shell.electrons, 0);
      add('groups to the left', left, 1.00);
    }
    const screening = contributions.reduce((sum, item) => sum + item.screening, 0);
    const zeff = z - screening;
    return {
      z,
      symbol: configuration.symbol,
      targetKey,
      n: target.n,
      l: target.l,
      contributions,
      screening,
      zeff,
      estimateHartree: -zeff * zeff / (2 * target.n * target.n)
    };
  }

  function atomDiagnostic(z) {
    const configuration = groundConfiguration(z);
    const period = Math.max(...configuration.subshells.map(shell => shell.n));
    const lastShell = configuration.subshells.reduce((latest, shell) => AUFBAU.findIndex(item => item.key === shell.key) > AUFBAU.findIndex(item => item.key === latest.key) ? shell : latest);
    const unpairedElectrons = Object.values(configuration.boxesByKey).flat().filter(state => state === 'up' || state === 'down').length;
    return {
      z,
      symbol: configuration.symbol,
      name: configuration.name,
      electronCount: configuration.electronCount,
      notation: configuration.notation,
      period,
      block: ORBITAL_LETTERS[lastShell.l],
      unpairedElectrons,
      magnetic: unpairedElectrons ? 'paramagnetic' : 'diamagnetic',
      configuration
    };
  }

  function enumerateMicrostates(l, q) {
    if (!Number.isInteger(l) || l < 0 || l > 3) throw new RangeError('microstate l must be 0…3');
    const spinOrbitals = [];
    for (let ml = -l; ml <= l; ml += 1) for (const ms2 of [-1, 1]) spinOrbitals.push({ ml, ms2 });
    if (!Number.isInteger(q) || q < 0 || q > spinOrbitals.length) throw new RangeError('invalid equivalent-electron count');
    const counts = {};
    function choose(start, left, mlTotal, ms2Total) {
      if (!left) {
        const key = `${mlTotal},${ms2Total}`;
        counts[key] = (counts[key] || 0) + 1;
        return;
      }
      for (let index = start; index <= spinOrbitals.length - left; index += 1) {
        const orbital = spinOrbitals[index];
        choose(index + 1, left - 1, mlTotal + orbital.ml, ms2Total + orbital.ms2);
      }
    }
    choose(0, q, 0, 0);
    return { l, q, spinOrbitals, counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) };
  }

  function decomposeLSTerms(l, q) {
    const microstates = enumerateMicrostates(l, q);
    const counts = new Map(Object.entries(microstates.counts));
    let residual = microstates.total;
    const rawTerms = [];
    while (residual > 0) {
      const candidates = [...counts.entries()].filter(([key, count]) => {
        const [ml, ms2] = key.split(',').map(Number);
        return count > 0 && ml >= 0 && ms2 >= 0;
      }).map(([key]) => key.split(',').map(Number));
      if (!candidates.length) throw new Error('LS decomposition left an invalid residual table');
      const maxMS2 = Math.max(...candidates.map(item => item[1]));
      const L = Math.max(...candidates.filter(item => item[1] === maxMS2).map(item => item[0]));
      const S2 = maxMS2;
      const dimension = (2 * L + 1) * (S2 + 1);
      for (let ms2 = -S2; ms2 <= S2; ms2 += 2) {
        for (let ml = -L; ml <= L; ml += 1) {
          const key = `${ml},${ms2}`;
          const count = counts.get(key) || 0;
          if (count < 1) throw new Error(`cannot subtract ${S2 + 1}${TERM_LETTERS[L]} from microstate table`);
          counts.set(key, count - 1);
        }
      }
      rawTerms.push({ L, S2, S: S2 / 2, multiplicity: S2 + 1, label: `${S2 + 1}${TERM_LETTERS[L]}`, dimension });
      residual -= dimension;
    }
    const aggregate = new Map();
    for (const term of rawTerms) {
      const entry = aggregate.get(term.label) || { ...term, occurrences: 0, totalDimension: 0 };
      entry.occurrences += 1;
      entry.totalDimension += term.dimension;
      aggregate.set(term.label, entry);
    }
    const terms = [...aggregate.values()];
    return {
      l, q,
      terms,
      totalMicrostates: microstates.total,
      totalDimension: terms.reduce((sum, term) => sum + term.totalDimension, 0),
      residual
    };
  }

  function fineStructureLevels(L, S2, A = 1) {
    if (!Number.isInteger(L) || L < 0 || !Number.isInteger(S2) || S2 < 0 || !Number.isFinite(A)) throw new RangeError('invalid LS fine-structure arguments');
    const S = S2 / 2;
    const minJ2 = Math.abs(2 * L - S2);
    const maxJ2 = 2 * L + S2;
    const levels = [];
    for (let J2 = minJ2; J2 <= maxJ2; J2 += 2) {
      const J = J2 / 2;
      const shift = 0.5 * A * (J * (J + 1) - L * (L + 1) - S * (S + 1));
      levels.push({ J, J2, degeneracy: J2 + 1, shift });
    }
    const weight = levels.reduce((sum, level) => sum + level.degeneracy, 0);
    const weightedBarycenter = levels.reduce((sum, level) => sum + level.degeneracy * level.shift, 0) / weight;
    return { L, S, S2, A, label: `${S2 + 1}${TERM_LETTERS[L]}`, levels, weightedBarycenter };
  }

  function groupFineStructureLevels(levels, tolerance = 1e-9) {
    if (!Array.isArray(levels) || !levels.length || !Number.isFinite(tolerance) || tolerance < 0) {
      throw new RangeError('fine-structure grouping requires levels and a nonnegative tolerance');
    }
    const ordered = [...levels].sort((left, right) => left.shift - right.shift || left.J - right.J);
    const groups = [];
    for (const level of ordered) {
      if (!Number.isFinite(level.shift) || !Number.isFinite(level.J) || !Number.isFinite(level.degeneracy)) {
        throw new RangeError('invalid fine-structure level');
      }
      const prior = groups.at(-1);
      if (prior && Math.abs(level.shift - prior.shift) <= tolerance) {
        prior.levels.push(level);
        prior.degeneracy += level.degeneracy;
      } else {
        groups.push({ shift: level.shift, levels: [level], degeneracy: level.degeneracy });
      }
    }
    return groups;
  }

  function evaluateAtomicCase(caseId, answers = {}) {
    const caseFile = ATOMIC_CASES[caseId];
    if (!caseFile) throw new RangeError(`unknown atomic case: ${caseId}`);
    const feedback = Object.entries(caseFile.expected).map(([field, expected]) => ({
      field,
      expected,
      actual: answers[field],
      correct: Object.is(answers[field], expected)
    }));
    const correct = feedback.filter(item => item.correct).length;
    return { caseId, title: caseFile.title, correct, total: feedback.length, ok: correct === feedback.length, feedback };
  }

  const models = Object.freeze({
    constants: Object.freeze({ HARTREE_EV, HC_EV_NM }),
    evaluateModelPassport,
    quantumState,
    hydrogenicEnergy,
    associatedLaguerre,
    radialNodes,
    radialModel,
    angularAmplitude,
    angularSlice,
    transitionModel,
    groundConfiguration,
    slaterEffectiveCharge,
    configurationAudit,
    nextBoxState,
    atomDiagnostic,
    enumerateMicrostates,
    decomposeLSTerms,
    fineStructureLevels,
    groupFineStructureLevels,
    evaluateAtomicCase
  });
  window.QCAtomicModels = models;

  function svg(width, height, body, label) {
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}"><rect width="${width}" height="${height}" rx="18" fill="#fbfcff"></rect>${body}</svg>`;
  }

  function pathFrom(points, xMap, yMap, xKey, yKey) {
    return points.map((point, index) => `${index ? 'L' : 'M'} ${xMap(point[xKey]).toFixed(2)} ${yMap(point[yKey]).toFixed(2)}`).join(' ');
  }

  function bindInputs(ids, update) {
    ids.forEach(id => $(id)?.addEventListener('input', update));
    ids.forEach(id => $(id)?.addEventListener('change', update));
  }

  function syncQuantumRanges(prefix) {
    const n = Number($(`${prefix}N`)?.value || 1);
    const lInput = $(`${prefix}L`);
    if (lInput) { lInput.max = String(n - 1); lInput.value = String(clamp(Number(lInput.value), 0, n - 1)); }
    const l = Number(lInput?.value || 0);
    const mInput = $(`${prefix}M`);
    if (mInput) { mInput.min = String(-l); mInput.max = String(l); mInput.value = String(clamp(Number(mInput.value), -l, l)); }
    return { n, l, m: Number(mInput?.value || 0) };
  }

  function auditModelPassport() {
    const result = evaluateModelPassport($('passportCase')?.value || 'h-like-energy', $('passportModel')?.value);
    if ($('passportReadout')) $('passportReadout').innerHTML = `<strong>${result.correct ? 'Passport stamped' : 'Model mismatch'}.</strong> ${esc(result.title)} belongs to <code>${esc(result.expected)}</code>. ${esc(result.note)}`;
  }

  function updateQuantumGate() {
    const { n, l, m } = syncQuantumRanges('quantum');
    const state = quantumState(n, l, m);
    if ($('quantumReadout')) $('quantumReadout').innerHTML = state.valid
      ? `<strong>${state.label}, m=${m} is allowed.</strong> ${state.radialNodes} radial + ${state.angularNodes} angular = ${state.totalNodes} total nodes; ${state.subshellOrbitals} spatial orbital${state.subshellOrbitals === 1 ? '' : 's'}, capacity ${state.subshellCapacity}; complete shell capacity ${state.shellCapacity}.`
      : `<strong>Gate closed.</strong> ${esc(state.reason)}`;
    if ($('quantumOrbitals')) {
      $('quantumOrbitals').innerHTML = Array.from({ length: 2 * l + 1 }, (_unused, index) => {
        const value = index - l;
        return `<span class="atomic-quantum-chip${value === m ? ' active' : ''}">m=${value >= 0 ? '+' : ''}${value}</span>`;
      }).join('');
    }
  }

  function updateEnergyLadder() {
    const z = Number($('energyZ')?.value || 1);
    const nMax = Number($('energyNMax')?.value || 5);
    const highlight = clamp(Number($('energyHighlight')?.value || 2), 1, nMax);
    if ($('energyHighlight')) $('energyHighlight').max = String(nMax);
    const width = 700, height = 360, left = 105, right = 610, top = 42, bottom = 315;
    const ground = hydrogenicEnergy(1, 0, z).hartree;
    const yMap = energy => top + (energy / ground) * (bottom - top);
    let body = `<line x1="${left}" x2="${right}" y1="${top}" y2="${top}" stroke="#94a3b8" stroke-dasharray="3 6"></line><text x="${left}" y="25" class="axis-label">ionization limit E=0</text>`;
    for (let n = 1; n <= nMax; n += 1) {
      const energy = hydrogenicEnergy(n, 0, z);
      const y = yMap(energy.hartree);
      const selected = n === highlight;
      body += `<line x1="${left}" x2="${right}" y1="${y}" y2="${y}" stroke="${selected ? '#9a3412' : '#1e3a8a'}" stroke-width="${selected ? 7 : 3}" stroke-dasharray="${selected ? 'none' : '14 7'}"></line>
        <circle cx="${left - 24}" cy="${y}" r="${selected ? 8 : 5}" fill="${selected ? '#9a3412' : '#fff'}" stroke="#1e3a8a" stroke-width="3"></circle>
        <text x="${left + 8}" y="${y - 8}" class="axis-label">n=${n} · E=${energy.hartree.toFixed(5)} Eh · ${n * n} spatial states</text>`;
    }
    if ($('energyPlot')) $('energyPlot').innerHTML = svg(width, height, body, `Hydrogenic energy ladder for nuclear charge ${z}`);
    const selected = hydrogenicEnergy(highlight, 0, z);
    if ($('energyReadout')) $('energyReadout').innerHTML = `<strong>Z=${z}, n=${highlight}:</strong> E=${selected.hartree.toFixed(8)} E<sub>h</sub> = ${selected.eV.toFixed(5)} eV. Every l=0…${highlight - 1} shares this energy only inside the ideal one-electron Coulomb model.`;
  }

  function updateRadialExplorer() {
    const n = Number($('radialN')?.value || 2);
    const lInput = $('radialL');
    if (lInput) { lInput.max = String(n - 1); lInput.value = String(clamp(Number(lInput.value), 0, n - 1)); }
    const l = Number(lInput?.value || 0);
    const z = Number($('radialZ')?.value || 1);
    const display = $('radialDisplay')?.value || 'both';
    const model = radialModel(n, l, z);
    const width = 720, height = 390, pad = 55, middle = 190, lowerBase = 335;
    const maxR = Math.max(...model.points.map(point => Math.abs(point.radial)), 1e-10);
    const maxP = Math.max(...model.points.map(point => point.probability), 1e-10);
    const xMap = r => pad + r / model.rMax * (width - 2 * pad);
    const yR = value => middle - value / maxR * 105;
    const yP = value => lowerBase - value / maxP * 105;
    const radialPath = display !== 'probability' ? `<path d="${pathFrom(model.points, xMap, yR, 'r', 'radial')}" fill="none" stroke="#4338ca" stroke-width="4"></path>` : '';
    const probabilityPath = display !== 'radial' ? `<path d="${pathFrom(model.points, xMap, yP, 'r', 'probability')}" fill="none" stroke="#b45309" stroke-width="4" stroke-dasharray="12 7"></path>` : '';
    const nodes = model.nodes.map((node, index) => `<line x1="${xMap(node)}" x2="${xMap(node)}" y1="55" y2="${lowerBase}" stroke="#6b21a8" stroke-width="2" stroke-dasharray="3 6"></line><text x="${xMap(node) + 4}" y="70" class="axis-label">r${index + 1}</text>`).join('');
    const body = `<line x1="${pad}" x2="${width - pad}" y1="${middle}" y2="${middle}" stroke="#94a3b8"></line><line x1="${pad}" x2="${width - pad}" y1="${lowerBase}" y2="${lowerBase}" stroke="#94a3b8"></line>${nodes}${radialPath}${probabilityPath}<text x="${pad}" y="30" class="axis-label">Rnl signed amplitude</text><text x="${pad}" y="220" class="axis-label">r²|Rnl|² radial probability</text><text x="${width - 90}" y="375" class="axis-label">r / a₀ →</text>`;
    if ($('radialPlot')) $('radialPlot').innerHTML = svg(width, height, body, `${model.label} radial function and radial probability`);
    if ($('radialReadout')) $('radialReadout').innerHTML = `<strong>${model.label}, Z=${z}:</strong> ${model.nodes.length} radial node${model.nodes.length === 1 ? '' : 's'}${model.nodes.length ? ` at r/a₀ ≈ ${model.nodes.map(value => value.toFixed(3)).join(', ')}` : ''}. Finite-domain numerical normalization = ${model.normalization.toFixed(7)}.`;
  }

  function updateAngularStudio() {
    const kind = $('angularKind')?.value || 'pz';
    const plane = $('angularPlane')?.value || 'xz';
    const angle = Number($('angularAngle')?.value || 0) * Math.PI / 180;
    const model = angularSlice(kind, plane, angle, 21);
    const width = 620, height = 520, size = 420, originX = 100, originY = 45;
    const cell = size / model.resolution;
    const glyphs = model.points.filter(point => point.inside).map(point => {
      const column = Math.round((point.u + 1) * (model.resolution - 1) / 2);
      const row = Math.round((1 - point.v) * (model.resolution - 1) / 2);
      const cx = originX + (column + 0.5) * cell;
      const cy = originY + (row + 0.5) * cell;
      const magnitude = model.maxAbs ? Math.abs(point.value) / model.maxAbs : 0;
      if (magnitude < 0.08) return `<path d="M ${cx - 3} ${cy - 3} L ${cx + 3} ${cy + 3} M ${cx + 3} ${cy - 3} L ${cx - 3} ${cy + 3}" stroke="#475569" stroke-width="1.3"></path>`;
      const radius = 2 + 7 * Math.sqrt(magnitude);
      if (point.value > 0) return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="#f59e0b" fill-opacity="${0.25 + 0.7 * magnitude}" stroke="#78350f" stroke-width="1"></circle>`;
      return `<rect x="${cx - radius}" y="${cy - radius}" width="${2 * radius}" height="${2 * radius}" transform="rotate(45 ${cx} ${cy})" fill="#7c3aed" fill-opacity="${0.2 + 0.7 * magnitude}" stroke="#3b0764" stroke-width="1"></rect>`;
    }).join('');
    const body = `<circle cx="${originX + size / 2}" cy="${originY + size / 2}" r="${size / 2}" fill="#fff" stroke="#94a3b8" stroke-width="2"></circle>${glyphs}<line x1="${originX}" x2="${originX + size}" y1="${originY + size / 2}" y2="${originY + size / 2}" stroke="#64748b" stroke-dasharray="6 6"></line><line x1="${originX + size / 2}" x2="${originX + size / 2}" y1="${originY}" y2="${originY + size}" stroke="#64748b" stroke-dasharray="6 6"></line><text x="${originX}" y="28" class="axis-label">${esc(kind)} real tesseral sign map · ${esc(plane)} slice</text><text x="${originX}" y="495" class="axis-label">circles + · diamonds − · crosses near a node</text>`;
    if ($('angularPlot')) $('angularPlot').innerHTML = svg(width, height, body, `${kind} angular sign and node map in the ${plane} plane`);
    const l = kind === 's' ? 0 : kind.startsWith('p') ? 1 : 2;
    if ($('angularReadout')) $('angularReadout').innerHTML = `<strong>${kind}, ${plane} slice, rotation ${(angle * 180 / Math.PI).toFixed(0)}°:</strong> this real shape has ${l} angular node${l === 1 ? '' : 's'}. Real p/d pictures with |m|>0 are ±m combinations, not unique L<sub>z</sub> eigenfunctions.`;
  }

  function updateTransitionLab() {
    const from = syncQuantumRanges('transitionFrom');
    const to = syncQuantumRanges('transitionTo');
    const z = Number($('transitionZ')?.value || 1);
    const model = transitionModel(from, to, z);
    const maxN = Math.max(from.n, to.n, 3);
    const width = 700, height = 390, left = 95, right = 610, top = 42, bottom = 330;
    const ground = hydrogenicEnergy(1, 0, z).hartree;
    const yMap = energy => top + energy / ground * (bottom - top);
    let body = `<defs><marker id="atomic-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#9a3412"></path></marker></defs>`;
    for (let n = 1; n <= maxN; n += 1) {
      const energy = hydrogenicEnergy(n, 0, z).hartree;
      body += `<line x1="${left}" x2="${right}" y1="${yMap(energy)}" y2="${yMap(energy)}" stroke="#1e3a8a" stroke-width="3" stroke-dasharray="12 7"></line><text x="${left + 8}" y="${yMap(energy) - 7}" class="axis-label">n=${n}</text>`;
    }
    const yFrom = yMap(model.initialEnergy.hartree), yTo = yMap(model.finalEnergy.hartree);
    if (model.direction === 'degenerate') {
      body += `<line x1="300" x2="470" y1="${yFrom}" y2="${yFrom}" stroke="#9a3412" stroke-width="8"></line><text x="300" y="${yFrom + 28}" class="axis-label">ΔE=0 in Coulomb model</text>`;
    } else {
      body += `<line x1="385" x2="385" y1="${yFrom}" y2="${yTo}" stroke="${model.angularAllowed ? '#9a3412' : '#64748b'}" stroke-width="6" stroke-dasharray="${model.angularAllowed ? 'none' : '6 7'}" marker-end="url(#atomic-arrow)"></line>`;
      if (!model.angularAllowed) body += `<path d="M 365 ${(yFrom + yTo) / 2 - 12} L 405 ${(yFrom + yTo) / 2 + 12} M 405 ${(yFrom + yTo) / 2 - 12} L 365 ${(yFrom + yTo) / 2 + 12}" stroke="#111827" stroke-width="5"></path>`;
    }
    body += `<text x="${left}" y="25" class="axis-label">${model.from.label},m=${model.from.m} → ${model.to.label},m=${model.to.m}</text>`;
    if ($('transitionPlot')) $('transitionPlot').innerHTML = svg(width, height, body, 'Hydrogenic transition energy and E1 angular filter');
    const rule = model.angularAllowed ? 'passes Δl=±1 and Δm=0,±1' : `fails the angular filter (Δl=${model.deltaL}, Δm=${model.deltaM})`;
    const photon = model.wavelengthNm ? `|ΔE|=${Math.abs(model.deltaEV).toFixed(5)} eV, λ=${model.wavelengthNm.toFixed(3)} nm` : 'ΔE=0, so this model has no finite-frequency photon';
    if ($('transitionReadout')) $('transitionReadout').innerHTML = `<strong>${model.direction}:</strong> ${rule}; ${photon}. This is an E1 angular/model-energy diagnosis, not an intensity or experimental-line prediction.`;
  }

  function populateElements(select, selected = 8) {
    if (!select || select.options.length) return;
    select.innerHTML = ELEMENTS.slice(1).map((item, index) => `<option value="${index + 1}"${index + 1 === selected ? ' selected' : ''}>${index + 1} · ${item[0]} — ${item[1]}</option>`).join('');
  }

  function updateScreeningLab() {
    const z = Number($('screeningElement')?.value || 6);
    const configuration = groundConfiguration(z);
    const target = $('screeningTarget');
    const occupied = configuration.subshells.map(shell => shell.key);
    if (target) {
      const prior = target.value;
      target.innerHTML = occupied.map(key => `<option value="${key}">${key}</option>`).join('');
      target.value = occupied.includes(prior) ? prior : occupied.at(-1);
    }
    const model = slaterEffectiveCharge(z, target?.value || occupied.at(-1));
    if ($('screeningBreakdown')) $('screeningBreakdown').innerHTML = `<div class="atomic-breakdown">${model.contributions.map(part => `<div><span>${esc(part.label)}</span><strong>${part.electrons} × ${part.weight.toFixed(2)} = ${part.screening.toFixed(2)}</strong></div>`).join('')}<div class="total"><span>Total S</span><strong>${model.screening.toFixed(2)}</strong></div><div class="total"><span>Z<sub>eff</sub>=Z−S</span><strong>${model.zeff.toFixed(2)}</strong></div></div>`;
    if ($('screeningReadout')) $('screeningReadout').innerHTML = `<strong>${configuration.symbol} ${model.targetKey}:</strong> Slater Z<sub>eff</sub>=${model.zeff.toFixed(2)}. A screened-hydrogenic energy would be ${model.estimateHartree.toFixed(4)} E<sub>h</sub>, but this named approximation is not an experimental binding energy or an ab-initio orbital energy.`;
  }

  let forgeState = {};
  const boxSymbol = state => ({ empty: '·', up: '↑', down: '↓', pair: '↑↓', upup: '↑↑', downdown: '↓↓' })[state];
  const boxLabel = state => ({ empty: 'empty', up: 'one spin-up electron', down: 'one spin-down electron', pair: 'opposite-spin pair', upup: 'invalid same-spin up pair', downdown: 'invalid same-spin down pair' })[state];

  function resetForge(reveal = false) {
    const z = Number($('configurationElement')?.value || 6);
    const configuration = groundConfiguration(z);
    forgeState = Object.fromEntries(configuration.availableSubshells.map(shell => [shell.key, reveal && configuration.boxesByKey[shell.key] ? [...configuration.boxesByKey[shell.key]] : Array(2 * shell.l + 1).fill('empty')]));
    renderForge();
  }

  function paintForgeButton(button, shellKey, boxIndex, state) {
    button.className = `electron-box state-${state}`;
    button.setAttribute('aria-label', `${shellKey} orbital ${boxIndex + 1}: ${boxLabel(state)}`);
    button.textContent = boxSymbol(state);
  }

  function updateForgeReadout(z, configuration) {
    const electronCount = Object.values(forgeState).flat().reduce((sum, state) => sum + BOX_STATES[state], 0);
    if ($('configurationReadout')) $('configurationReadout').innerHTML = `<strong>${configuration.symbol} challenge:</strong> place ${z} electrons. Current count ${electronCount}. Cycle through empty, one-electron, valid ↑↓, and deliberately invalid ↑↑/↓↓ states; then audit Pauli, Hund, and ledger order.`;
  }

  function renderForge() {
    const z = Number($('configurationElement')?.value || 6);
    const configuration = groundConfiguration(z);
    const forge = $('configurationForge');
    if (forge) {
      forge.innerHTML = configuration.availableSubshells.map(shell => `<div class="atomic-subshell"><strong>${shell.key}</strong><div class="atomic-box-row">${forgeState[shell.key].map((state, index) => `<button type="button" class="electron-box state-${state}" data-shell="${shell.key}" data-box="${index}" aria-label="${shell.key} orbital ${index + 1}: ${boxLabel(state)}">${boxSymbol(state)}</button>`).join('')}</div></div>`).join('');
      const advanceButton = button => {
        const shellKey = button.dataset.shell;
        const boxIndex = Number(button.dataset.box);
        const next = nextBoxState(forgeState[shellKey][boxIndex]);
        forgeState[shellKey][boxIndex] = next;
        paintForgeButton(button, shellKey, boxIndex, next);
        updateForgeReadout(z, configuration);
      };
      forge.querySelectorAll('.electron-box').forEach(button => {
        button.addEventListener('click', () => advanceButton(button));
        button.addEventListener('keydown', event => {
          if (event.key === ' ' || event.key === 'Enter') {
            event.preventDefault();
            if (!event.repeat) advanceButton(button);
          }
        });
      });
    }
    updateForgeReadout(z, configuration);
  }

  function auditForge() {
    const z = Number($('configurationElement')?.value || 6);
    const result = configurationAudit(z, forgeState);
    const messages = {
      'electron-count': 'electron count does not match Z', pauli: 'an orbital state violates the two-spin box contract', capacity: 'a subshell has the wrong number of spatial boxes',
      hund: 'a degenerate subshell pairs too early or has nonparallel singles', aufbau: 'subshell populations differ from the neutral ground ledger', 'unknown-subshell': 'an unknown subshell was supplied'
    };
    if ($('configurationReadout')) $('configurationReadout').innerHTML = result.ok
      ? `<strong>Forge accepted.</strong> ${result.expected.symbol}: ${result.expected.notation}. The boxes satisfy this chapter’s Pauli, Hund, and neutral H–Kr ledger checks.`
      : `<strong>Audit found ${result.issues.length} rule gap${result.issues.length === 1 ? '' : 's'}:</strong> ${result.issues.map(issue => messages[issue]).join('; ')}. Current electrons ${result.electronCount}/${result.expectedElectrons}.`;
  }

  function checkPeriodic() {
    const z = Number($('periodicElement')?.value || 8);
    const model = atomDiagnostic(z);
    const guesses = {
      period: Number($('periodicPeriod')?.value),
      block: $('periodicBlock')?.value,
      unpaired: Number($('periodicUnpaired')?.value),
      magnetic: $('periodicMagnetic')?.value
    };
    const results = [
      ['period', guesses.period, model.period], ['block', guesses.block, model.block],
      ['unpaired electrons', guesses.unpaired, model.unpairedElectrons], ['magnetic class', guesses.magnetic, model.magnetic]
    ];
    const score = results.filter(item => Object.is(item[1], item[2])).length;
    if ($('periodicReadout')) $('periodicReadout').innerHTML = `<strong>${model.symbol} pattern score ${score}/4.</strong> ${results.map(([label, actual, expected]) => `${label}: ${Object.is(actual, expected) ? '✓' : `expected ${expected}`}`).join(' · ')}. Ledger: ${model.notation}. “Magnetic” here means the independent-configuration unpaired-electron diagnosis.`;
  }

  function updateMicrostateLab() {
    const l = Number($('microL')?.value || 1);
    const capacity = 2 * (2 * l + 1);
    const qInput = $('microQ');
    if (qInput) { qInput.max = String(capacity - 1); qInput.value = String(clamp(Number(qInput.value), 1, capacity - 1)); }
    const q = Number(qInput?.value || 2);
    const micro = enumerateMicrostates(l, q);
    const decomposition = decomposeLSTerms(l, q);
    const cells = Object.keys(micro.counts).map(key => key.split(',').map(Number));
    const maxML = Math.max(...cells.map(cell => Math.abs(cell[0])), 1);
    const maxMS2 = Math.max(...cells.map(cell => Math.abs(cell[1])), 1);
    const width = 720, height = 440, pad = 58;
    const columns = 2 * maxML + 1, rows = maxMS2 + 1;
    const cellWidth = (width - 2 * pad) / columns, cellHeight = (height - 2 * pad) / rows;
    let body = '';
    for (let ms2 = maxMS2; ms2 >= -maxMS2; ms2 -= 2) {
      for (let ml = -maxML; ml <= maxML; ml += 1) {
        const count = micro.counts[`${ml},${ms2}`] || 0;
        const x = pad + (ml + maxML) * cellWidth;
        const y = pad + (maxMS2 - ms2) / 2 * cellHeight;
        body += `<rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" fill="${count ? '#ede9fe' : '#fff'}" stroke="#64748b" stroke-dasharray="${count ? 'none' : '3 4'}"></rect><text x="${x + cellWidth / 2}" y="${y + cellHeight / 2 + 6}" text-anchor="middle" class="metric-label">${count || '·'}</text>`;
      }
    }
    body += `<text x="${width / 2}" y="${height - 14}" text-anchor="middle" class="axis-label">M_L →</text><text x="18" y="${height / 2}" class="axis-label">M_S</text><text x="${pad}" y="30" class="axis-label">cell text = determinant count · empty cells dotted</text>`;
    if ($('microstatePlot')) $('microstatePlot').innerHTML = svg(width, height, body, `Equivalent-electron microstate table for l=${l}, q=${q}`);
    if ($('termReadout')) $('termReadout').innerHTML = `<strong>${ORBITAL_LETTERS[l]}<sup>${q}</sup>:</strong> ${micro.total} determinants decompose into ${decomposition.terms.map(term => `<span class="atomic-term-chip">${term.occurrences > 1 ? `${term.occurrences}×` : ''}<sup>${term.multiplicity}</sup>${TERM_LETTERS[term.L]}</span>`).join(' ')}. Term dimensions sum to ${decomposition.totalDimension}; residual ${decomposition.residual}.`;
  }

  function updateFineStructure() {
    const term = $('fineTerm')?.value || '1,2';
    const [L, S2] = term.split(',').map(Number);
    const A = Number($('fineA')?.value || 100);
    const model = fineStructureLevels(L, S2, A);
    const groups = groupFineStructureLevels(model.levels);
    const width = 700, height = 380, left = 105, right = 590, top = 70, bottom = 320;
    const values = groups.map(group => group.shift);
    const min = Math.min(...values), max = Math.max(...values);
    const span = max - min;
    const yMap = value => span <= 1e-9 ? (top + bottom) / 2 : bottom - (value - min) / span * (bottom - top);
    const barycenterY = yMap(0);
    const zeroGroup = groups.find(group => Math.abs(group.shift) <= 1e-9);
    let body = zeroGroup
      ? `<path data-barycenter-guide="coincident" d="M ${right - 75} ${barycenterY - 74} V ${barycenterY - 4} h 8" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="3 4"></path><text x="${right - 81}" y="${barycenterY - 80}" text-anchor="end" class="axis-label">term barycenter = same E</text>`
      : `<line data-barycenter-guide="distinct" x1="${left}" x2="${right}" y1="${barycenterY}" y2="${barycenterY}" stroke="#64748b" stroke-dasharray="3 6"></line><text x="${left}" y="${barycenterY - 8}" class="axis-label">term barycenter</text>`;
    groups.forEach((group, groupIndex) => {
      const y = yMap(group.shift);
      const labelStep = 36;
      const firstLabelY = y - (group.levels.length - 1) * labelStep / 2;
      const lineStart = left + 245;
      body += `<line data-energy-group="${groupIndex}" x1="${lineStart}" x2="${right}" y1="${y}" y2="${y}" stroke="#4338ca" stroke-width="4" stroke-dasharray="${groupIndex % 2 ? '12 6' : 'none'}"></line>`;
      group.levels.forEach((level, levelIndex) => {
        const labelY = firstLabelY + levelIndex * labelStep;
        const markerX = right + 18 - (group.levels.length - 1 - levelIndex) * 34;
        body += `<text data-j-label="${level.J}" x="${left + 8}" y="${labelY + 5}" class="axis-label">J=${level.J} · g=${level.degeneracy} · Δ=${level.shift.toFixed(2)}</text><circle cx="${markerX}" cy="${y}" r="${4 + level.J}" fill="#fff" stroke="#9a3412" stroke-width="3"><title>J=${level.J}, g=${level.degeneracy}${group.levels.length > 1 ? ', same energy' : ''}</title></circle>`;
      });
      if (group.levels.length > 1) {
        const bracketTop = firstLabelY - 9;
        const bracketBottom = firstLabelY + (group.levels.length - 1) * labelStep + 9;
        body += `<path d="M ${left + 198} ${bracketTop} h 10 V ${bracketBottom} h -10 M ${left + 208} ${y} H ${lineStart}" fill="none" stroke="#9a3412" stroke-width="2" stroke-dasharray="4 3"></path><text x="${left + 216}" y="${bracketTop - 5}" class="metric-label">same E ×${group.levels.length}</text>`;
      }
    });
    body += `<text x="${left}" y="30" class="axis-label">${model.label} · ideal A L·S · A=${A.toFixed(1)} cm⁻¹</text>`;
    if ($('finePlot')) $('finePlot').innerHTML = svg(width, height, body, `${model.label} ideal LS fine-structure ladder; coincident J values share one energy line`);
    const intervals = model.levels.slice(1).map((level, index) => level.shift - model.levels[index].shift);
    if ($('fineReadout')) $('fineReadout').innerHTML = `<strong><sup>${S2 + 1}</sup>${TERM_LETTERS[L]} ladder:</strong> J=${model.levels.map(level => level.J).join(', ')}; intervals ${intervals.length ? intervals.map(value => value.toFixed(2)).join(', ') : 'none'} cm⁻¹; degeneracy-weighted barycenter ${model.weightedBarycenter.toExponential(2)}. ${groups.length < model.levels.length ? `${model.levels.length} J labels share ${groups.length} true-energy line${groups.length === 1 ? '' : 's'}. ` : ''}A is supplied, not predicted.`;
  }

  function syncBossFields() {
    const caseId = $('bossCase')?.value || 'oxygen-file';
    const oxygen = caseId === 'oxygen-file';
    if ($('bossModel')) $('bossModel').value = '';
    if ($('bossAnswerOneLabel')) $('bossAnswerOneLabel').textContent = oxygen ? 'How many unpaired electrons?' : 'Does the E1 angular filter pass?';
    if ($('bossAnswerOne')) $('bossAnswerOne').innerHTML = oxygen
      ? '<option value="">Choose…</option><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option>'
      : '<option value="">Choose…</option><option value="true">Yes</option><option value="false">No</option>';
    if ($('bossAnswerTwoLabel')) $('bossAnswerTwoLabel').textContent = oxygen ? 'Configuration magnetic class' : 'Photon direction';
    if ($('bossAnswerTwo')) $('bossAnswerTwo').innerHTML = oxygen
      ? '<option value="">Choose…</option><option value="diamagnetic">Diamagnetic</option><option value="paramagnetic">Paramagnetic</option>'
      : '<option value="">Choose…</option><option value="absorption">Absorption</option><option value="emission">Emission</option><option value="degenerate">Degenerate</option>';
    if ($('bossCaveat')) $('bossCaveat').innerHTML = oxygen
      ? '<option value="">Choose…</option><option value="not-ab-initio">Ledger is not ab initio</option><option value="exact-spectrum">This is an exact spectrum</option>'
      : '<option value="">Choose…</option><option value="not-experimental">Model wavelength is not the experimental line</option><option value="fully-relativistic">Result is fully relativistic</option>';
    if ($('bossFeedback')) $('bossFeedback').textContent = 'Choose all four claims, then audit the case file.';
  }

  function auditBoss() {
    const caseId = $('bossCase')?.value || 'oxygen-file';
    const oxygen = caseId === 'oxygen-file';
    const firstRaw = $('bossAnswerOne')?.value;
    const answers = oxygen
      ? { model: $('bossModel')?.value, unpaired: Number(firstRaw), magnetic: $('bossAnswerTwo')?.value, caveat: $('bossCaveat')?.value }
      : { model: $('bossModel')?.value, allowed: firstRaw === 'true', direction: $('bossAnswerTwo')?.value, caveat: $('bossCaveat')?.value };
    const result = evaluateAtomicCase(caseId, answers);
    if ($('bossFeedback')) $('bossFeedback').innerHTML = `<strong>${result.ok ? 'Case closed' : `Case remains open · ${result.correct}/${result.total}`}.</strong> ${result.feedback.map(item => `${item.correct ? '✓' : '✗'} ${esc(item.field)}${item.correct ? '' : ` → ${esc(item.expected)}`}`).join(' · ')}`;
  }

  function init() {
    populateElements($('screeningElement'), 6);
    populateElements($('configurationElement'), 6);
    populateElements($('periodicElement'), 8);
    $('passportAudit')?.addEventListener('click', auditModelPassport);
    bindInputs(['quantumN', 'quantumL', 'quantumM'], updateQuantumGate);
    bindInputs(['energyZ', 'energyNMax', 'energyHighlight'], updateEnergyLadder);
    bindInputs(['radialN', 'radialL', 'radialZ', 'radialDisplay'], updateRadialExplorer);
    bindInputs(['angularKind', 'angularPlane', 'angularAngle'], updateAngularStudio);
    bindInputs(['transitionFromN', 'transitionFromL', 'transitionFromM', 'transitionToN', 'transitionToL', 'transitionToM', 'transitionZ'], updateTransitionLab);
    $('screeningElement')?.addEventListener('change', updateScreeningLab);
    $('screeningTarget')?.addEventListener('change', updateScreeningLab);
    $('configurationElement')?.addEventListener('change', () => resetForge(false));
    $('configurationReset')?.addEventListener('click', () => resetForge(false));
    $('configurationReveal')?.addEventListener('click', () => resetForge(true));
    $('configurationAudit')?.addEventListener('click', auditForge);
    $('periodicCheck')?.addEventListener('click', checkPeriodic);
    bindInputs(['microL', 'microQ'], updateMicrostateLab);
    bindInputs(['fineTerm', 'fineA'], updateFineStructure);
    $('bossCase')?.addEventListener('change', syncBossFields);
    $('bossAudit')?.addEventListener('click', auditBoss);

    updateQuantumGate();
    updateEnergyLadder();
    updateRadialExplorer();
    updateAngularStudio();
    updateTransitionLab();
    updateScreeningLab();
    resetForge(false);
    updateMicrostateLab();
    updateFineStructure();
    syncBossFields();
    window.ProjectXCAcademy?.bindChapter({ chapterId: 'qc-atoms', totalMissions: 12 });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
