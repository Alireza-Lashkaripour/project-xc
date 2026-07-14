#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'site', 'assets', 'qc-atoms.js');
if (!fs.existsSync(sourcePath)) throw new Error('RED: site/assets/qc-atoms.js does not exist');
const source = fs.readFileSync(sourcePath, 'utf8');

global.window = {};
global.document = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() { return null; },
  querySelectorAll() { return []; }
};
vm.runInThisContext(source, { filename: 'qc-atoms.js' });

const models = global.window.QCAtomicModels;
if (!models) throw new Error('QCAtomicModels was not exported');

let checks = 0;
function assert(condition, message) {
  checks += 1;
  if (!condition) throw new Error(message);
}
function equal(actual, expected, message) {
  assert(Object.is(actual, expected), `${message}: got ${actual}, expected ${expected}`);
}
function near(actual, expected, tolerance, message) {
  assert(Math.abs(actual - expected) <= tolerance, `${message}: got ${actual}, expected ${expected} ± ${tolerance}`);
}
function choose(n, k) {
  let value = 1;
  for (let i = 1; i <= Math.min(k, n - k); i += 1) value = value * (n - i + 1) / i;
  return value;
}

const expectedApi = [
  'evaluateModelPassport', 'quantumState', 'hydrogenicEnergy', 'associatedLaguerre', 'radialNodes', 'radialModel',
  'angularAmplitude', 'angularSlice', 'transitionModel', 'groundConfiguration',
  'slaterEffectiveCharge', 'configurationAudit', 'atomDiagnostic', 'enumerateMicrostates',
  'decomposeLSTerms', 'fineStructureLevels', 'evaluateAtomicCase'
];
for (const name of expectedApi) assert(typeof models[name] === 'function', `${name} production API must be exported`);

// Model-passport game keeps every quantitative claim inside its declared model.
for (const [caseId, expected] of [['h-like-energy', 'coulomb-exact'], ['neutral-configuration', 'configuration-ledger'], ['carbon-screening', 'slater-approximation'], ['triplet-p-ladder', 'ls-coupling-model']]) {
  const correct = models.evaluateModelPassport(caseId, expected);
  assert(correct.correct, `${caseId} correct model passport`);
  equal(correct.expected, expected, `${caseId} expected model label`);
  assert(!models.evaluateModelPassport(caseId, 'wrong-model').correct, `${caseId} rejects wrong model passport`);
}

// Quantum-number contract, capacities, and nodes.
for (const [n, l, m, label] of [[1, 0, 0, '1s'], [2, 0, 0, '2s'], [2, 1, -1, '2p'], [4, 3, 3, '4f']]) {
  const state = models.quantumState(n, l, m);
  assert(state.valid, `${label} must be valid`);
  equal(state.label, label, `${label} spectroscopic label`);
  equal(state.radialNodes + state.angularNodes, state.totalNodes, `${label} node decomposition`);
  equal(state.totalNodes, n - 1, `${label} total node count`);
  equal(state.subshellOrbitals, 2 * l + 1, `${label} spatial subshell size`);
  equal(state.subshellCapacity, 2 * (2 * l + 1), `${label} subshell capacity`);
  equal(state.shellCapacity, 2 * n * n, `${label} shell capacity`);
}
for (const [n, l, m] of [[0, 0, 0], [1, 1, 0], [3, -1, 0], [3, 2, 3], [2.5, 1, 0], [2, 1, 0.5]]) {
  assert(!models.quantumState(n, l, m).valid, `(${n},${l},${m}) must be rejected`);
}

// Coulomb spectrum and degeneracy.
near(models.hydrogenicEnergy(1, 0, 1).hartree, -0.5, 1e-15, 'H 1s energy');
near(models.hydrogenicEnergy(2, 1, 1).hartree, -0.125, 1e-15, 'H n=2 energy');
near(models.hydrogenicEnergy(2, 1, 2).hartree, -0.5, 1e-15, 'He+ n=2 energy');
near(models.hydrogenicEnergy(3, 0, 1).hartree, models.hydrogenicEnergy(3, 2, 1).hartree, 1e-15, 'same-n Coulomb degeneracy');
equal(models.hydrogenicEnergy(4, 3, 1).spatialDegeneracy, 16, 'n=4 spatial degeneracy');
near(models.hydrogenicEnergy(1, 0, 1).eV, -0.5 * models.constants.HARTREE_EV, 1e-12, 'hartree-to-eV conversion');

// Generalized Laguerre recurrence and hydrogenic radial nodes.
near(models.associatedLaguerre(0, 3, 1.7), 1, 1e-15, 'L_0^alpha');
near(models.associatedLaguerre(1, 1, 2), 0, 1e-15, 'L_1^1(2)');
near(models.associatedLaguerre(2, 1, 3), -1.5, 1e-14, 'L_2^1(3)');
near(models.radialNodes(2, 0, 1)[0], 2, 2e-8, '2s radial node');
const threeSNodes = models.radialNodes(3, 0, 1);
near(threeSNodes[0], 1.5 * (3 - Math.sqrt(3)), 2e-8, '3s inner radial node');
near(threeSNodes[1], 1.5 * (3 + Math.sqrt(3)), 2e-8, '3s outer radial node');
near(models.radialNodes(3, 1, 1)[0], 6, 2e-8, '3p radial node');
for (let n = 1; n <= 6; n += 1) {
  for (let l = 0; l < n; l += 1) {
    const nodes = models.radialNodes(n, l, 1.7);
    equal(nodes.length, n - l - 1, `n=${n}, l=${l} radial node count`);
    assert(nodes.every((value, index) => value > 0 && (!index || value > nodes[index - 1])), `n=${n}, l=${l} nodes must be positive and ordered`);
    for (const node of nodes) {
      const rho = 2 * 1.7 * node / n;
      near(models.associatedLaguerre(n - l - 1, 2 * l + 1, rho), 0, 2e-8, `n=${n}, l=${l} node must zero radial Laguerre factor`);
    }
    const radial = models.radialModel(n, l, 1.7);
    near(radial.normalization, 1, 4e-4, `n=${n}, l=${l} radial normalization`);
    equal(radial.nodes.length, n - l - 1, `n=${n}, l=${l} plotted node count`);
    assert(radial.points.every(point => Number.isFinite(point.r) && Number.isFinite(point.radial) && point.probability >= 0), `n=${n}, l=${l} radial points finite`);
  }
}

// Real tesseral angular shapes: phase, parity, and nodal surfaces.
const angularKinds = ['s', 'px', 'py', 'pz', 'dxy', 'dxz', 'dyz', 'dx2y2', 'dz2'];
for (const kind of angularKinds) {
  const slice = models.angularSlice(kind, 'xz', 0, 17);
  equal(slice.points.length, 17 * 17, `${kind} slice resolution`);
  assert(slice.points.every(point => Number.isFinite(point.value)), `${kind} slice values finite`);
}
near(models.angularAmplitude('px', 1, 0, 0), -models.angularAmplitude('px', -1, 0, 0), 1e-15, 'px odd under x reflection');
near(models.angularAmplitude('pz', 1, 1, 0), 0, 1e-15, 'pz xy nodal plane');
near(models.angularAmplitude('dxy', 0, 1, 0), 0, 1e-15, 'dxy yz nodal plane');
near(models.angularAmplitude('dxy', 1, 0, 0), 0, 1e-15, 'dxy xz nodal plane');
near(models.angularAmplitude('dx2y2', 1, 1, 0), 0, 1e-15, 'dx2-y2 diagonal node');
near(models.angularAmplitude('dz2', Math.sqrt(2), 0, 1), 0, 1e-15, 'dz2 nodal cone');
near(models.angularAmplitude('s', 1, 2, 3), models.angularAmplitude('s', -1, -2, -3), 1e-15, 's even parity');
near(models.angularAmplitude('dxy', 1, 2, 3), models.angularAmplitude('dxy', -1, -2, -3), 1e-15, 'd even parity');

// Orbital E1 angular filter and Coulomb-model wavelengths.
const lyman = models.transitionModel({ n: 2, l: 1, m: 0 }, { n: 1, l: 0, m: 0 }, 1);
assert(lyman.angularAllowed, '2p to 1s must pass the E1 angular filter');
equal(lyman.direction, 'emission', '2p to 1s direction');
near(lyman.deltaEV, -0.375 * models.constants.HARTREE_EV, 1e-12, 'Lyman-alpha model energy');
near(lyman.wavelengthNm, models.constants.HC_EV_NM / (0.375 * models.constants.HARTREE_EV), 1e-10, 'Lyman-alpha model wavelength');
assert(!models.transitionModel({ n: 2, l: 0, m: 0 }, { n: 1, l: 0, m: 0 }, 1).angularAllowed, '2s to 1s E1 must fail delta-l');
assert(!models.transitionModel({ n: 3, l: 2, m: 2 }, { n: 2, l: 1, m: 0 }, 1).angularAllowed, 'delta-m=2 must fail E1 angular filter');
const degenerate = models.transitionModel({ n: 2, l: 1, m: 0 }, { n: 2, l: 0, m: 0 }, 1);
assert(degenerate.angularAllowed, 'same-n 2p/2s pair passes angular filter');
equal(degenerate.direction, 'degenerate', 'same-n Coulomb transition has zero model energy');
equal(degenerate.wavelengthNm, null, 'zero model energy has no finite wavelength');

// Neutral H-Kr ground-configuration ledger and diagnostics.
for (let z = 1; z <= 36; z += 1) {
  const config = models.groundConfiguration(z);
  equal(config.electronCount, z, `Z=${z} neutral electron count`);
  assert(config.subshells.every(shell => shell.electrons <= 2 * (2 * shell.l + 1)), `Z=${z} subshell capacities`);
  const diagnostic = models.atomDiagnostic(z);
  equal(diagnostic.electronCount, z, `Z=${z} diagnostic electron count`);
  assert(models.configurationAudit(z, config.boxesByKey).ok, `Z=${z} canonical box ledger accepted`);
  assert(diagnostic.period >= 1 && diagnostic.period <= 4, `Z=${z} period range`);
  assert(['s', 'p', 'd'].includes(diagnostic.block), `Z=${z} block`);
  assert(diagnostic.unpairedElectrons >= 0, `Z=${z} nonnegative unpaired count`);
}
const chromium = models.groundConfiguration(24).byKey;
equal(chromium['4s'], 1, 'Cr 4s exception');
equal(chromium['3d'], 5, 'Cr 3d exception');
const copper = models.groundConfiguration(29).byKey;
equal(copper['4s'], 1, 'Cu 4s exception');
equal(copper['3d'], 10, 'Cu 3d exception');
equal(models.atomDiagnostic(2).unpairedElectrons, 0, 'He diamagnetic configuration');
equal(models.atomDiagnostic(7).unpairedElectrons, 3, 'N has three unpaired 2p electrons');
equal(models.atomDiagnostic(8).unpairedElectrons, 2, 'O has two unpaired 2p electrons');

// Slater-rule named approximation.
near(models.slaterEffectiveCharge(6, '2p').zeff, 3.25, 1e-12, 'C 2p Slater Zeff');
near(models.slaterEffectiveCharge(11, '3s').zeff, 2.20, 1e-12, 'Na 3s Slater Zeff');
near(models.slaterEffectiveCharge(26, '3d').zeff, 6.25, 1e-12, 'Fe 3d Slater Zeff');
for (const [z, key] of [[6, '2p'], [11, '3s'], [26, '3d']]) {
  const model = models.slaterEffectiveCharge(z, key);
  near(model.contributions.reduce((sum, part) => sum + part.screening, 0), model.screening, 1e-12, `Z=${z} screening decomposition`);
  near(model.zeff, z - model.screening, 1e-12, `Z=${z} Zeff identity`);
}

// Orbital-box audit: canonical ground states accepted; wrong count and Hund pairing diagnosed.
for (const z of [1, 6, 8, 10, 24, 29, 36]) {
  const config = models.groundConfiguration(z);
  assert(models.configurationAudit(z, config.boxesByKey).ok, `Z=${z} canonical boxes accepted`);
}
const emptyCarbon = models.configurationAudit(6, {});
assert(!emptyCarbon.ok && emptyCarbon.issues.includes('electron-count'), 'empty carbon must fail electron count');
const pairedCarbon = JSON.parse(JSON.stringify(models.groundConfiguration(6).boxesByKey));
pairedCarbon['2p'] = ['pair', 'empty', 'empty'];
const pairedAudit = models.configurationAudit(6, pairedCarbon);
assert(!pairedAudit.ok && pairedAudit.issues.includes('hund'), 'prematurely paired carbon 2p must fail Hund audit');
const pauliHelium = JSON.parse(JSON.stringify(models.groundConfiguration(2).boxesByKey));
pauliHelium['1s'] = ['upup'];
const pauliAudit = models.configurationAudit(2, pauliHelium);
assert(!pauliAudit.ok && pauliAudit.issues.length === 1 && pauliAudit.issues[0] === 'pauli', 'same-spin helium pair must fail only Pauli while preserving electron count');
equal(pauliAudit.electronCount, 2, 'same-spin Pauli violation still carries two electrons');

// Equivalent-electron microstates and LS decomposition across every p/d occupancy exposed by the game.
const termCases = [
  ...Array.from({ length: 5 }, (_, index) => [1, index + 1]),
  ...Array.from({ length: 9 }, (_, index) => [2, index + 1])
];
for (const [l, q] of termCases) {
  const microstates = models.enumerateMicrostates(l, q);
  equal(microstates.total, choose(2 * (2 * l + 1), q), `l=${l}, q=${q} determinant count`);
  equal(Object.values(microstates.counts).reduce((sum, count) => sum + count, 0), microstates.total, `l=${l}, q=${q} cell-count sum`);
  const decomposition = models.decomposeLSTerms(l, q);
  equal(decomposition.totalDimension, microstates.total, `l=${l}, q=${q} term dimensions exhaust microstates`);
  equal(decomposition.residual, 0, `l=${l}, q=${q} no residual microstates`);
}
function termSignature(l, q) {
  return models.decomposeLSTerms(l, q).terms.map(term => `${term.occurrences > 1 ? `${term.occurrences}×` : ''}${term.label}`).sort().join(',');
}
equal(termSignature(1, 2), ['1D', '1S', '3P'].sort().join(','), 'p2 allowed terms');
equal(termSignature(1, 3), ['2D', '2P', '4S'].sort().join(','), 'p3 allowed terms');
equal(termSignature(2, 2), ['1D', '1G', '1S', '3F', '3P'].sort().join(','), 'd2 allowed terms');
equal(termSignature(1, 1), termSignature(1, 5), 'p electron-hole term symmetry');
equal(termSignature(1, 2), termSignature(1, 4), 'p2/p4 term symmetry');
equal(termSignature(2, 1), termSignature(2, 9), 'd/d9 electron-hole term symmetry');
equal(termSignature(2, 2), termSignature(2, 8), 'd2/d8 electron-hole term symmetry');
equal(termSignature(2, 3), termSignature(2, 7), 'd3/d7 electron-hole term symmetry');
equal(termSignature(2, 4), termSignature(2, 6), 'd4/d6 electron-hole term symmetry');

// Ideal A L·S fine-structure ladder.
const tripletP = models.fineStructureLevels(1, 2, 1);
equal(tripletP.levels.length, 3, '3P has J=0,1,2');
equal(tripletP.levels.map(level => level.J).join(','), '0,1,2', '3P J values');
equal(tripletP.levels.map(level => level.degeneracy).join(','), '1,3,5', '3P degeneracies');
equal(tripletP.levels.map(level => level.shift).join(','), '-2,-1,1', '3P shifts in A units');
near(tripletP.weightedBarycenter, 0, 1e-14, '3P degeneracy-weighted barycenter');
near(tripletP.levels[1].shift - tripletP.levels[0].shift, 1, 1e-14, '3P first Lande interval');
near(tripletP.levels[2].shift - tripletP.levels[1].shift, 2, 1e-14, '3P second Lande interval');
const doubletD = models.fineStructureLevels(2, 1, 2.5);
equal(doubletD.levels.map(level => level.J).join(','), '1.5,2.5', '2D J values');
near(doubletD.weightedBarycenter, 0, 1e-14, '2D barycenter');

// Final case-file feedback is deterministic and field-specific.
const perfectCase = models.evaluateAtomicCase('oxygen-file', {
  model: 'configuration-ledger', unpaired: 2, magnetic: 'paramagnetic', caveat: 'not-ab-initio'
});
assert(perfectCase.ok, 'correct oxygen case file must pass');
equal(perfectCase.correct, perfectCase.total, 'perfect case-file score');
const partialCase = models.evaluateAtomicCase('lyman-file', {
  model: 'coulomb-exact', allowed: false, direction: 'absorption', caveat: 'experimental-line'
});
assert(!partialCase.ok, 'incorrect Lyman case must not pass');
assert(partialCase.feedback.some(item => !item.correct), 'case file must return field-specific failure feedback');

console.log('Project XC Atomic Structure model tests OK');
console.log(`- deterministic assertions: ${checks}`);
console.log('- quantum numbers, Coulomb/radial/angular models, E1 filter, screening/configurations, LS terms, fine structure, and boss cases: OK');
