#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'site', 'assets', 'qc-many-electron.js');
if (!fs.existsSync(sourcePath)) throw new Error('RED: site/assets/qc-many-electron.js does not exist');
const source = fs.readFileSync(sourcePath, 'utf8');

const context = {
  console,
  module: { exports: {} },
  window: {},
  document: {
    readyState: 'loading',
    addEventListener() {},
    getElementById() { return null; },
    querySelectorAll() { return []; }
  }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'qc-many-electron.js' });

const models = context.module.exports;
if (!models) throw new Error('QCManyElectronModels was not exported');
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
function zeros4(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => Array.from({ length: size }, () => Array(size).fill(0))));
}

const expectedApi = [
  'choose', 'permutationParity', 'occupationState', 'applyCreation', 'applyAnnihilation',
  'excitationProfile', 'determinantOverlap', 'gramDiagnostics', 'operatorConnectivity',
  'oneBodyElement', 'singleDeterminantEnergy', 'spinCoupling', 'oneRDM', 'twoRDM',
  'auditOneRDM', 'rdmDiagnostics', 'evaluateExchangeCase', 'evaluateOccupancyMission',
  'evaluateParityMission', 'evaluateOverlapMission', 'evaluateSelectionMission',
  'evaluateOneBodyMission', 'evaluateTwoBodyMission', 'evaluateSpinMission', 'evaluateRdmMission',
  'evaluateTwoRdmMission', 'evaluateManyElectronCase'
];
for (const name of expectedApi) assert(typeof models[name] === 'function', `${name} production API must be exported`);

// Exact finite combinatorics and exposed determinant-space counts.
for (const [m, n, expected] of [[2, 0, 1], [2, 1, 2], [4, 2, 6], [6, 3, 20], [8, 4, 70], [10, 5, 252]]) {
  equal(models.choose(m, n), expected, `C(${m},${n})`);
  let enumerated = 0;
  for (let bits = 0; bits < 2 ** m; bits += 1) {
    let count = 0;
    for (let p = 0; p < m; p += 1) count += (bits >> p) & 1;
    if (count === n) enumerated += 1;
  }
  equal(models.choose(m, n), enumerated, `C(${m},${n}) independent bitstring enumeration`);
}
for (const bad of [[-1, 0], [3, -1], [3, 4], [3.5, 2]]) {
  let rejected = false;
  try { models.choose(...bad); } catch (_error) { rejected = true; }
  assert(rejected, `choose rejects ${bad}`);
}

// Permutation parity, duplicate-orbital zero, and canonical determinant ordering.
for (const [order, sign, inversions] of [
  [[0, 1, 2, 3], 1, 0], [[1, 0, 2, 3], -1, 1], [[3, 2, 1, 0], 1, 6],
  [[2, 0, 3, 1], -1, 3], [[4, 1, 3, 0, 2], -1, 7]
]) {
  const result = models.permutationParity(order);
  assert(result.valid && !result.zero, `${order} valid orbital ordering`);
  equal(result.sign, sign, `${order} parity sign`);
  equal(result.inversions, inversions, `${order} inversion count`);
  equal(result.canonical.join(','), order.slice().sort((a, b) => a - b).join(','), `${order} canonical order`);
}
const duplicate = models.permutationParity([0, 2, 2, 3]);
assert(duplicate.valid && duplicate.zero && duplicate.sign === 0, 'duplicate spin orbital makes determinant zero');
assert(!models.permutationParity([0, -1, 2]).valid, 'negative orbital index rejected');

// Occupation construction and fermionic operator signs.
const occ = models.occupationState(6, [0, 2, 5]);
assert(occ.valid && !occ.zero, 'valid occupation state');
equal(occ.bits.join(''), '101001', 'occupation bitstring in canonical p=0..M-1 order');
equal(occ.electrons, 3, 'occupation electron count');
assert(models.occupationState(4, [1, 1]).zero, 'duplicate creation gives zero state');
assert(!models.occupationState(3, [0, 3]).valid, 'out-of-range orbital rejected');

let op = models.applyAnnihilation([1, 1, 0, 1], 1);
assert(!op.zero, 'annihilate occupied orbital');
equal(op.phase, -1, 'annihilation phase counts occupied lower indices');
equal(op.bits.join(''), '1001', 'annihilation result');
op = models.applyCreation([1, 0, 1, 0], 3);
assert(!op.zero, 'create in empty orbital');
equal(op.phase, 1, 'creation phase after two lower occupied orbitals');
equal(op.bits.join(''), '1011', 'creation result');
assert(models.applyCreation([1, 0, 1, 0], 2).zero, 'creation in occupied orbital vanishes');
assert(models.applyAnnihilation([1, 0, 1, 0], 1).zero, 'annihilation in empty orbital vanishes');

// Excitation rank and structural Slater–Condon connectivity. Allowed does not mean nonzero.
const determinantPairs = [
  [[1, 1, 0, 0, 0, 0], [1, 1, 0, 0, 0, 0], 0],
  [[1, 1, 0, 0, 0, 0], [1, 0, 1, 0, 0, 0], 1],
  [[1, 1, 0, 0, 0, 0], [0, 0, 1, 1, 0, 0], 2],
  [[1, 1, 1, 0, 0, 0], [0, 0, 0, 1, 1, 1], 3]
];
for (const [left, right, rank] of determinantPairs) {
  const profile = models.excitationProfile(left, right);
  equal(profile.rank, rank, `excitation rank ${rank}`);
  const connectivity = models.operatorConnectivity(left, right);
  equal(connectivity.oneBodyAllowed, rank <= 1, `one-body structural allowance at rank ${rank}`);
  equal(connectivity.twoBodyAllowed, rank <= 2, `two-body structural allowance at rank ${rank}`);
}
const wrongSectorConnectivity = models.operatorConnectivity([1, 1, 0], [1, 0, 0]);
assert(wrongSectorConnectivity.rank === null && !wrongSectorConnectivity.oneBodyAllowed && !wrongSectorConnectivity.twoBodyAllowed, 'different-particle-number sectors must not be marked structurally allowed');
assert(!models.excitationProfile([1, 0], [0, 0]).valid, 'different electron numbers rejected');

// Determinant overlap is det(S), including exchange sign and linear dependence.
for (const [matrix, expected] of [
  [[[1, 0], [0, 1]], 1], [[[0, 1], [1, 0]], -1], [[[1, 0.6], [0.6, 1]], 0.64],
  [[[1, 1], [1, 1]], 0], [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], 1]
]) near(models.determinantOverlap(matrix), expected, 1e-12, `determinant overlap ${JSON.stringify(matrix)}`);
const healthyGram = models.gramDiagnostics([[1, 0.3], [0.3, 1]], 1e-4);
near(healthyGram.determinant, 0.91, 1e-12, 'Gram determinant');
assert(healthyGram.positiveDefinite && !healthyGram.nearSingular, 'healthy Gram matrix');
const dependentGram = models.gramDiagnostics([[1, 1], [1, 1]], 1e-4);
assert(!dependentGram.positiveDefinite && dependentGram.nearSingular, 'linearly dependent Gram matrix');
const warningGram = models.gramDiagnostics([[1, 0.99999], [0.99999, 1]], 1e-4);
assert(warningGram.positiveDefinite && warningGram.nearSingular, 'positive but near-singular Gram diagnostic');

// One-body matrix elements from independent second-quantized action.
const h = [
  [-1.0, 0.2, 0.1, 0.0],
  [0.2, -0.8, 0.0, 0.3],
  [0.1, 0.0, -0.4, 0.25],
  [0.0, 0.3, 0.25, 0.1]
];
near(models.oneBodyElement([1, 0, 1, 0], [1, 0, 1, 0], h), -1.4, 1e-12, 'diagonal one-body determinant element');
near(models.oneBodyElement([0, 1, 1, 0], [1, 0, 1, 0], h), 0.2, 1e-12, 'single-substitution one-body element and phase');
near(models.oneBodyElement([1, 0, 0, 1], [0, 1, 1, 0], h), 0, 1e-12, 'double substitution vanishes for one-body operator');

// Exact expectation of a supplied Hamiltonian in one determinant; this is not an HF optimization.
const hDiag = [-1.0, -0.8, 0.2];
const j = [[0.4, 0.6, 0.1], [0.6, 0.5, 0.2], [0.1, 0.2, 0.3]];
const k = [[0.4, 0.2, 0.0], [0.2, 0.5, 0.05], [0.0, 0.05, 0.3]];
const detEnergy = models.singleDeterminantEnergy([0, 1], hDiag, j, k);
near(detEnergy.oneBody, -1.8, 1e-12, 'single determinant one-body contribution');
near(detEnergy.coulomb, 0.6, 1e-12, 'single determinant pair Coulomb contribution');
near(detEnergy.exchange, -0.2, 1e-12, 'single determinant pair exchange contribution');
near(detEnergy.total, -1.4, 1e-12, 'single determinant total expectation');

// Explicit spin-orbital convention: D1=|aα bβ|, D2=|aβ bα|.
const invSqrt2 = 1 / Math.sqrt(2);
const singlet = models.spinCoupling(invSqrt2, -invSqrt2);
near(singlet.norm, 1, 1e-14, 'singlet norm');
near(singlet.s2, 0, 1e-14, 'singlet S^2');
near(singlet.singletWeight, 1, 1e-14, 'singlet weight');
const triplet = models.spinCoupling(invSqrt2, invSqrt2);
near(triplet.s2, 2, 1e-14, 'triplet S^2');
near(triplet.tripletWeight, 1, 1e-14, 'triplet weight');
const contaminated = models.spinCoupling(1, 0);
near(contaminated.s2, 1, 1e-14, 'single Ms=0 determinant is equal singlet/triplet mixture');
near(contaminated.singletWeight, 0.5, 1e-14, 'contaminated singlet weight');
near(contaminated.tripletWeight, 0.5, 1e-14, 'contaminated triplet weight');

// Generic 1-RDM in a finite spin-orbital determinant basis.
const d1 = [1, 0, 0, 1];
const d2 = [0, 1, 1, 0];
const singleState = { determinants: [d1], coefficients: [1] };
const singleGamma = models.oneRDM(singleState);
near(singleGamma[0][0], 1, 1e-14, 'single determinant occupation p0');
near(singleGamma[3][3], 1, 1e-14, 'single determinant occupation p3');
near(singleGamma.flat().reduce((sum, value, index) => sum + (index % 5 === 0 ? value : 0), 0), 2, 1e-14, 'single determinant gamma trace');
const singleAudit = models.auditOneRDM(singleGamma, 2);
assert(singleAudit.hermitian && singleAudit.traceCorrect && singleAudit.pauliAllowed && singleAudit.idempotent, 'single-determinant 1-RDM audit');

const correlatedState = { determinants: [d1, d2], coefficients: [invSqrt2, -invSqrt2] };
const gamma = models.oneRDM(correlatedState);
for (let p = 0; p < 4; p += 1) near(gamma[p][p], 0.5, 1e-14, `correlated gamma occupation p${p}`);
const gammaAudit = models.auditOneRDM(gamma, 2);
assert(gammaAudit.hermitian && gammaAudit.traceCorrect && gammaAudit.pauliAllowed && !gammaAudit.idempotent, 'fractional natural occupations for correlated two-determinant state');
for (const occupation of gammaAudit.occupations) near(occupation, 0.5, 1e-12, 'correlated natural occupation');

const badTrace = [[1, 0, 0], [0, 0.7, 0], [0, 0, 0.6]];
assert(!models.auditOneRDM(badTrace, 2).traceCorrect, '1-RDM wrong trace rejected');
const badPauli = [[1.2, 0], [0, 0.8]];
assert(!models.auditOneRDM(badPauli, 2).pauliAllowed, 'spin-orbital natural occupation above one rejected');
const nonHermitian = [[1, 0.2], [0.1, 1]];
assert(!models.auditOneRDM(nonHermitian, 2).hermitian, 'non-Hermitian candidate rejected');

// Generic 2-RDM convention Γ_pq,rs=<a†p a†q a_s a_r> and exact contraction.
const gamma2 = models.twoRDM(correlatedState);
const diagnostics = models.rdmDiagnostics(correlatedState);
near(diagnostics.trace1, 2, 1e-12, '1-RDM trace N');
near(diagnostics.trace2, 2, 1e-12, '2-RDM trace N(N-1)');
near(diagnostics.contractionResidual, 0, 1e-12, '2-RDM contraction to (N-1) gamma');
near(gamma2[0][3][0][3], 0.5, 1e-14, 'pair occupation for determinant D1 component');
near(gamma2[3][0][0][3], -0.5, 1e-14, '2-RDM antisymmetry under creation-index swap');

// Corrupt one pair element: necessary contraction/trace evidence must notice.
const corrupted = zeros4(4);
for (let p = 0; p < 4; p += 1) for (let q = 0; q < 4; q += 1) for (let r = 0; r < 4; r += 1) for (let s = 0; s < 4; s += 1) corrupted[p][q][r][s] = gamma2[p][q][r][s];
corrupted[0][3][0][3] += 0.2;
const corruptDiagnostics = models.rdmDiagnostics({ gamma, gamma2: corrupted, electrons: 2 });
assert(corruptDiagnostics.contractionResidual > 0.1 && Math.abs(corruptDiagnostics.trace2 - 2) > 0.1, 'corrupted 2-RDM fails necessary trace/contraction evidence');

// Deterministic mixed-CI property sweep across different finite sectors.
for (const [orbitals, electrons] of [[4, 2], [5, 2], [5, 3]]) {
  const determinants = [];
  for (let mask = 0; mask < 2 ** orbitals && determinants.length < 6; mask += 1) {
    const bits = Array.from({ length: orbitals }, (_, p) => (mask >> p) & 1);
    if (bits.reduce((sum, value) => sum + value, 0) === electrons) determinants.push(bits);
  }
  const coefficients = determinants.map((_, index) => Math.sin((index + 1) * 1.371));
  const state = { determinants, coefficients };
  const swept = models.rdmDiagnostics(state);
  near(swept.trace1, electrons, 2e-12, `mixed-CI trace gamma for M=${orbitals},N=${electrons}`);
  near(swept.trace2, electrons * (electrons - 1), 3e-12, `mixed-CI trace Gamma for M=${orbitals},N=${electrons}`);
  near(swept.contractionResidual, 0, 3e-12, `mixed-CI contraction for M=${orbitals},N=${electrons}`);
  assert(swept.oneRdmAudit.hermitian && swept.oneRdmAudit.traceCorrect && swept.oneRdmAudit.pauliAllowed, `mixed-CI 1-RDM necessary conditions for M=${orbitals},N=${electrons}`);
  const signFlipped = models.oneRDM({ determinants, coefficients: coefficients.map(value => -value) });
  for (let p = 0; p < orbitals; p += 1) for (let q = 0; q < orbitals; q += 1) near(signFlipped[p][q], swept.gamma[p][q], 2e-14, `global CI sign invariance gamma ${p},${q}`);
}

// Earned mission evaluators reject wrong answers and accept every declared dossier.
for (const [caseId, answer] of [['exchange-a', 'antisymmetric'], ['exchange-b', 'symmetric'], ['exchange-c', 'neither']]) {
  assert(models.evaluateExchangeCase(caseId, answer).correct, `${caseId} exchange answer`);
  assert(!models.evaluateExchangeCase(caseId, 'wrong').correct, `${caseId} rejects wrong exchange answer`);
}
for (const [caseId, occupied, count] of [['occupancy-a', [0, 3], 6], ['occupancy-b', [0, 2, 5], 20], ['occupancy-c', [0, 2, 5, 7], 70]]) {
  assert(models.evaluateOccupancyMission(caseId, occupied, count).correct, `${caseId} occupancy dossier`);
  assert(!models.evaluateOccupancyMission(caseId, occupied, count + 1).correct, `${caseId} wrong determinant count`);
}
for (const [order, sign] of [[[1, 0, 2], -1], [[2, 0, 3, 1], -1], [[3, 2, 1, 0], 1]]) {
  assert(models.evaluateParityMission(order, sign).correct, `${order} parity mission`);
  assert(!models.evaluateParityMission(order, -sign).correct, `${order} wrong parity`);
}
for (const [caseId, decision] of [['overlap-a', 'accept-normalized'], ['overlap-b', 'renormalize'], ['overlap-c', 'scan-threshold'], ['overlap-d', 'reject-dependent']]) {
  assert(models.evaluateOverlapMission(caseId, decision).correct, `${caseId} overlap mission`);
}
for (const [caseId, decision] of [['connection-a', 'one-and-two'], ['connection-b', 'one-and-two'], ['connection-c', 'two-only'], ['connection-d', 'neither']]) {
  assert(models.evaluateSelectionMission(caseId, decision).correct, `${caseId} selection mission`);
}
for (const [caseId, decision] of [['connection-a', 'allowed'], ['connection-b', 'allowed'], ['connection-c', 'forbidden'], ['connection-d', 'forbidden']]) {
  assert(models.evaluateOneBodyMission(caseId, decision).correct, `${caseId} one-body mission`);
}
for (const [caseId, decision] of [['connection-a', 'allowed'], ['connection-b', 'allowed'], ['connection-c', 'allowed'], ['connection-d', 'forbidden']]) {
  assert(models.evaluateTwoBodyMission(caseId, decision, 'coulomb-minus-exchange').correct, `${caseId} two-body mission`);
  assert(!models.evaluateTwoBodyMission(caseId, decision, 'hf-solution').correct, `${caseId} rejects HF interpretation`);
}
for (const [caseId, decision] of [['spin-a', 'singlet'], ['spin-b', 'triplet'], ['spin-c', 'mixture']]) {
  assert(models.evaluateSpinMission(caseId, decision).correct, `${caseId} spin mission`);
}
for (const [caseId, decision] of [['one-rdm-a', 'idempotent'], ['one-rdm-b', 'fractional'], ['one-rdm-c', 'reject-trace']]) {
  assert(models.evaluateRdmMission(caseId, decision).correct, `${caseId} RDM mission`);
}
for (const [caseId, decision] of [['two-rdm-a', 'certify-necessary'], ['two-rdm-b', 'reject-contraction'], ['two-rdm-c', 'missing-pair-evidence']]) {
  assert(models.evaluateTwoRdmMission(caseId, decision).correct, `${caseId} 2-RDM mission`);
  assert(!models.evaluateTwoRdmMission(caseId, 'wrong').correct, `${caseId} rejects wrong 2-RDM claim`);
}
for (const [caseId, choices] of [
  ['boss-a', ['wedge-state', 'zero-determinant', 'canonical-occupancy']],
  ['boss-b', ['determinant-pair', 'excitation-rank', 'one-body-integral']],
  ['boss-c', ['multi-determinant-state', 'natural-occupations', 'two-rdm-contraction']]
]) {
  choices.forEach((choice, stage) => assert(models.evaluateManyElectronCase(caseId, stage, choice).correct, `${caseId} boss stage ${stage + 1}`));
  assert(!models.evaluateManyElectronCase(caseId, 0, 'wrong').correct, `${caseId} boss rejects wrong start`);
}

console.log('Project XC Many-Electron Wavefunctions model tests OK');
console.log(`- deterministic assertions: ${checks}`);
console.log('- Fermionic signs, determinant overlaps, Slater–Condon structure, spin adaptation, 1/2-RDM invariants, mission dossiers, and boss contracts: OK');
