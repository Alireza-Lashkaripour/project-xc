#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'site', 'assets', 'qc-hartree-fock.js');
if (!fs.existsSync(sourcePath)) throw new Error('RED: site/assets/qc-hartree-fock.js does not exist');
const source = fs.readFileSync(sourcePath, 'utf8');
const context = {
  console,
  module: { exports: {} },
  window: {},
  document: {
    readyState: 'loading', addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; }
  }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'qc-hartree-fock.js' });
const models = context.module.exports;
if (!models) throw new Error('QCHartreeFockModels test API was not exported');

let checks = 0;
function assert(condition, message) {
  checks += 1;
  if (!condition) throw new Error(message);
}
function near(actual, expected, tolerance, message) {
  assert(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message}: got ${actual}, expected ${expected} ± ${tolerance}`);
}
function equal(actual, expected, message) {
  assert(Object.is(actual, expected), `${message}: got ${actual}, expected ${expected}`);
}
function matMul(a, b) {
  return a.map(row => b[0].map((_, j) => row.reduce((sum, value, k) => sum + value * b[k][j], 0)));
}
function transpose(a) { return a[0].map((_, j) => a.map(row => row[j])); }
function matSub(a, b) { return a.map((row, i) => row.map((value, j) => value - b[i][j])); }
function frobenius(a) { return Math.sqrt(a.flat().reduce((sum, value) => sum + value * value, 0)); }
function column(matrix, j) { return matrix.map(row => row[j]); }
function dot(a, b) { return a.reduce((sum, value, i) => sum + value * b[i], 0); }
function matVec(a, x) { return a.map(row => dot(row, x)); }
function zeros4(size) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => Array.from({ length: size }, () => Array(size).fill(0))));
}
function generalizedRoots2(f, s) {
  const [a, b, d] = [f[0][0], f[0][1], f[1][1]];
  const [u, v, w] = [s[0][0], s[0][1], s[1][1]];
  const qa = u * w - v * v;
  const qb = -(a * w + d * u - 2 * b * v);
  const qc = a * d - b * b;
  const disc = qb * qb - 4 * qa * qc;
  return [(-qb - Math.sqrt(disc)) / (2 * qa), (-qb + Math.sqrt(disc)) / (2 * qa)];
}

const expectedApi = [
  'symmetricEigen2', 'generalizedEigen2', 'densityProjector', 'auditDensity', 'coulombExchange',
  'antisymmetrizedIntegralResidual', 'buildFock', 'hfEnergy', 'commutatorResidual', 'rotationSlice', 'classifyStationarity',
  'twoLevelScfOutput', 'iterateTwoLevelScf', 'classifyScfLog', 'dampValue', 'levelShiftFock',
  'diisCoefficients', 'diisMix', 'uhfSpinS2', 'evaluateVariationMission', 'evaluateCoulombMission',
  'evaluateFockMission', 'evaluateRoothaanMission', 'evaluateDensityMission', 'evaluateStationarityMission',
  'evaluateFixedPointMission', 'evaluatePathologyMission', 'evaluateStabilizationMission',
  'evaluateDiisMission', 'evaluateReferenceMission', 'evaluateHfCase'
];
for (const name of expectedApi) assert(typeof models[name] === 'function', `${name} production/test API must be exported`);
const expectedPublicApi = expectedApi.slice(0, 19).sort();
const actualPublicApi = Object.keys(context.window.QCHartreeFockModels || {}).sort();
assert(JSON.stringify(actualPublicApi) === JSON.stringify(expectedPublicApi), `browser public API must expose only answer-free scientific transforms: ${JSON.stringify(actualPublicApi)}`);
const publicSurface = Object.entries(context.window.QCHartreeFockModels || {}).map(([key, value]) => `${key}\n${String(value)}`).join('\n');
for (const forbidden of ['DOSSIER', 'HF_CASE_FILES', 'evaluateVariationMission', 'evaluateHfCase', 'correctChoice', 'answerKey', 'bossRoutes', 'expectedAnswer']) {
  assert(!publicSurface.includes(forbidden), `browser public model surface must not expose ${forbidden}`);
}

// Symmetric 2x2 eigensystem: independent trace/determinant and residual checks.
for (const matrix of [
  [[2, 1], [1, 2]], [[-1.2, 0.3], [0.3, 0.7]], [[4, 0], [0, -2]], [[1, 0], [0, 1]]
]) {
  const result = models.symmetricEigen2(matrix);
  assert(result.valid && result.values.length === 2, `valid symmetric eigensystem ${JSON.stringify(matrix)}`);
  assert(result.values[0] <= result.values[1], 'eigenvalues sorted ascending');
  near(result.values[0] + result.values[1], matrix[0][0] + matrix[1][1], 1e-12, 'eigenvalue trace invariant');
  near(result.values[0] * result.values[1], matrix[0][0] * matrix[1][1] - matrix[0][1] ** 2, 1e-12, 'eigenvalue determinant invariant');
  const c0 = column(result.vectors, 0);
  const c1 = column(result.vectors, 1);
  near(dot(c0, c0), 1, 1e-12, 'first eigenvector normalized');
  near(dot(c1, c1), 1, 1e-12, 'second eigenvector normalized');
  near(dot(c0, c1), 0, 1e-12, 'eigenvectors orthogonal');
  for (let j = 0; j < 2; j += 1) {
    const c = column(result.vectors, j);
    const residual = matVec(matrix, c).map((value, i) => value - result.values[j] * c[i]);
    near(Math.hypot(...residual), 0, 1e-11, `symmetric eigen residual ${j}`);
  }
}
assert(!models.symmetricEigen2([[1, 0.2], [0.1, 2]]).valid, 'nonsymmetric eigensystem rejected');

// Generalized Roothaan-Hall problem in a positive-definite AO metric.
for (const [f, s] of [
  [[[-1, 0.2], [0.2, 0.5]], [[1, 0.2], [0.2, 1]]],
  [[[0.4, -0.3], [-0.3, 1.1]], [[1, -0.15], [-0.15, 0.8]]],
  [[[2, 0], [0, 3]], [[1, 0], [0, 2]]]
]) {
  const result = models.generalizedEigen2(f, s);
  assert(result.valid, `valid generalized eigensystem ${JSON.stringify({ f, s })}`);
  const independent = generalizedRoots2(f, s);
  near(result.values[0], independent[0], 1e-11, 'lower generalized eigenvalue');
  near(result.values[1], independent[1], 1e-11, 'upper generalized eigenvalue');
  const metric = matMul(transpose(result.coefficients), matMul(s, result.coefficients));
  near(metric[0][0], 1, 1e-11, 'C^T S C 00');
  near(metric[1][1], 1, 1e-11, 'C^T S C 11');
  near(metric[0][1], 0, 1e-11, 'C^T S C 01');
  near(result.metricResidual, frobenius(matSub(metric, [[1, 0], [0, 1]])), 1e-14, 'reported metric residual');
  for (let j = 0; j < 2; j += 1) {
    const c = column(result.coefficients, j);
    const residual = matVec(f, c).map((value, i) => value - result.values[j] * matVec(s, c)[i]);
    near(Math.hypot(...residual), 0, 1e-10, `Roothaan-Hall residual ${j}`);
  }
}
// Deterministic parameter sweep uses independent det(F-epsilon S) roots.
for (const overlapCoupling of [-0.4, -0.2, 0, 0.2, 0.4]) {
  const f = [[-1 + 0.1 * overlapCoupling, 0.18 - 0.05 * overlapCoupling], [0.18 - 0.05 * overlapCoupling, 0.6 + 0.2 * overlapCoupling]];
  const s = [[1, overlapCoupling], [overlapCoupling, 1.2]];
  const result = models.generalizedEigen2(f, s);
  const independent = generalizedRoots2(f, s);
  assert(result.valid, `generalized sweep valid at overlap ${overlapCoupling}`);
  near(result.values[0], independent[0], 1e-11, `generalized sweep lower root ${overlapCoupling}`);
  near(result.values[1], independent[1], 1e-11, `generalized sweep upper root ${overlapCoupling}`);
  near(result.metricResidual, 0, 1e-11, `generalized sweep metric certificate ${overlapCoupling}`);
  near(Math.max(...result.residuals), 0, 1e-10, `generalized sweep equation certificate ${overlapCoupling}`);
}
assert(!models.generalizedEigen2([[1, 0], [0, 2]], [[1, 1], [1, 1]]).valid, 'singular overlap rejected');
assert(!models.generalizedEigen2([[1, 0], [0, 2]], [[1, 1.1], [1.1, 1]]).valid, 'indefinite overlap rejected');

// One-spin AO density projector and nonorthogonal closure.
const fMetric = [[-1, 0.2], [0.2, 0.5]];
const sMetric = [[1, 0.2], [0.2, 1]];
const canonical = models.generalizedEigen2(fMetric, sMetric);
const density = models.densityProjector(canonical.coefficients, [0]);
const audit = models.auditDensity(density, sMetric, 1);
assert(audit.valid, 'density audit valid');
near(audit.electrons, 1, 1e-11, 'Tr(DS)=Nocc');
near(audit.closureResidual, 0, 1e-11, 'DSD=D projector closure');
const spinSummed = density.map(row => row.map(value => 2 * value));
const pspMinus2p = matSub(matMul(spinSummed, matMul(sMetric, spinSummed)), spinSummed.map(row => row.map(value => 2 * value)));
near(frobenius(pspMinus2p), 0, 1e-10, 'spin-summed RHF closure PSP=2P');
assert(!models.auditDensity([[1, 0], [0, 0.4]], [[1, 0], [0, 1]], 1).idempotent, 'fractional density is not a one-determinant projector');
let duplicateOccupiedRejected = false;
try { models.densityProjector([[1, 0], [0, 1]], [0, 0]); } catch (_error) { duplicateOccupiedRejected = true; }
assert(duplicateOccupiedRejected, 'duplicate occupied-orbital indices are rejected');

// Any unitary rotation wholly inside the occupied subspace preserves its density projector.
const occupiedReference = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const occupiedAngle = 0.417;
const occupiedRotated = [
  [Math.cos(occupiedAngle), -Math.sin(occupiedAngle), 0],
  [Math.sin(occupiedAngle), Math.cos(occupiedAngle), 0],
  [0, 0, 1]
];
const occupiedDensity = models.densityProjector(occupiedReference, [0, 1]);
const rotatedOccupiedDensity = models.densityProjector(occupiedRotated, [0, 1]);
for (let p = 0; p < 3; p += 1) for (let q = 0; q < 3; q += 1) near(rotatedOccupiedDensity[p][q], occupiedDensity[p][q], 1e-14, `occupied-subspace rotation invariance D${p}${q}`);

// Coulomb/exchange pair logic and self-interaction cancellation.
near(models.coulombExchange(0.8, 0.3, true).total, 0.5, 1e-14, 'same-spin J-K pair');
near(models.coulombExchange(0.8, 0.3, false).total, 0.8, 1e-14, 'opposite-spin has no exchange term');
near(models.coulombExchange(0.7, 0.7, true).total, 0, 1e-14, 'same spin-orbital self J-K cancellation');
assert(!models.coulombExchange(-0.1, 0.2, true).valid, 'negative supplied Coulomb integral rejected');

// Full occupation-one spin-orbital 1-RDM: symmetry-complete two-electron Fock and energy oracle.
const h = [[-1, 0], [0, -0.8]];
const dSpinOrbital = [[1, 0], [0, 1]];
const g = zeros4(2);
g[0][1][0][1] = 0.4;
g[1][0][0][1] = -0.4;
g[0][1][1][0] = -0.4;
g[1][0][1][0] = 0.4;
let independentIntegralResidual = 0;
for (let p = 0; p < 2; p += 1) for (let r = 0; r < 2; r += 1) for (let q = 0; q < 2; q += 1) for (let s = 0; s < 2; s += 1) {
  independentIntegralResidual = Math.max(independentIntegralResidual, Math.abs(g[p][r][q][s] + g[r][p][q][s]), Math.abs(g[p][r][q][s] + g[p][r][s][q]), Math.abs(g[p][r][q][s] - g[q][s][p][r]));
}
near(independentIntegralResidual, 0, 1e-14, 'independent antisymmetrized-integral permutation audit');
near(models.antisymmetrizedIntegralResidual(g), 0, 1e-14, 'production antisymmetrized-integral permutation audit');
const fock = models.buildFock(h, dSpinOrbital, g);
near(fock[0][0], -0.6, 1e-14, 'two-electron F00');
near(fock[0][1], 0, 1e-14, 'two-electron F01');
near(fock[1][0], 0, 1e-14, 'two-electron F10');
near(fock[1][1], -0.4, 1e-14, 'two-electron F11');
near(models.hfEnergy(h, fock, dSpinOrbital), -1.4, 1e-14, 'full spin-orbital two-electron HF functional');
const oneElectronFock = models.buildFock(h, [[1, 0], [0, 0]], g);
near(oneElectronFock[0][0], h[0][0], 1e-14, 'occupied spin orbital has no self-interaction contribution');
const malformedG = zeros4(2);
malformedG[0][0][1][0] = 0.05;
assert(models.antisymmetrizedIntegralResidual(malformedG) > 0.09, 'malformed antisymmetrized tensor is rejected by permutation residual');
const acceptedFockDossier = models.evaluateFockMission('fock-a', 'hermitian-density-dependent');
assert(acceptedFockDossier.correct && acceptedFockDossier.integralResidual <= 1e-14, 'accepted Fock dossier is symmetry-complete');
const rejectedFockDossier = models.evaluateFockMission('fock-b', 'reject-nonhermitian-build');
assert(rejectedFockDossier.correct && rejectedFockDossier.integralResidual > 0.1 && rejectedFockDossier.symmetryResidual > 0.06, 'malformed Fock dossier is visibly and tensorially rejected');
const stationaryResidual = models.commutatorResidual([[-1, 0], [0, 0.4]], [[1, 0], [0, 0]], [[1, 0], [0, 1]]);
near(stationaryResidual.norm, 0, 1e-14, 'commuting F and D stationary residual');
const nonstationaryFock = [[-1, 0.2], [0.2, 0.4]];
assert(models.commutatorResidual(nonstationaryFock, [[1, 0], [0, 0]], [[1, 0], [0, 1]]).norm > 0.2, 'occupied-virtual Fock coupling produces residual');

// Exact one-angle orbital-rotation slice and independent finite differences.
const slice = models.rotationSlice([[-1, 0.2], [0.2, 0.5]], 0);
near(slice.energy, -1, 1e-14, 'rotation slice E(0)');
near(slice.derivative, 0.4, 1e-14, 'rotation derivative 2Aov');
near(slice.curvature, 3, 1e-14, 'rotation curvature');
const step = 1e-6;
const plus = models.rotationSlice([[-1, 0.2], [0.2, 0.5]], step).energy;
const minus = models.rotationSlice([[-1, 0.2], [0.2, 0.5]], -step).energy;
near((plus - minus) / (2 * step), slice.derivative, 2e-10, 'rotation derivative finite difference');
const stationaryMin = models.classifyStationarity([[-1, 0], [0, 0.5]], 0);
assert(stationaryMin.stationary && stationaryMin.kind === 'local-minimum-slice', 'positive-curvature stationary slice');
const stationaryMax = models.classifyStationarity([[1, 0], [0, -0.5]], 0);
assert(stationaryMax.stationary && stationaryMax.kind === 'local-maximum-slice', 'negative-curvature stationary slice');
assert(!models.classifyStationarity([[-1, 0.2], [0.2, 0.5]], 0).stationary, 'nonzero occupied-virtual derivative is not stationary');

// Declared two-level nonlinear SCF map and fixed-point evidence.
const params = { delta: 1, interaction: 0.2, coupling: 0.3 };
const rawAtZero = models.twoLevelScfOutput(0, params);
near(rawAtZero, 1 / Math.sqrt(1 + 0.36), 1e-13, 'two-level map at x=0');
const convergedHistory = models.iterateTwoLevelScf(0, params, 80, 0);
assert(convergedHistory.length === 80, 'SCF history length');
assert(convergedHistory.at(-1).residual < 1e-10, 'stable two-level map converges');
const finalOutput = models.twoLevelScfOutput(convergedHistory.at(-1).input, params);
near(finalOutput - convergedHistory.at(-1).input, convergedHistory.at(-1).signedResidual, 1e-14, 'SCF residual is output minus input');
const oscillatoryHistory = models.iterateTwoLevelScf(0.4, { delta: 0, interaction: 1.2, coupling: 0.2 }, 12, 0);
assert(oscillatoryHistory.slice(-6).every((entry, i, array) => i === 0 || Math.sign(entry.input) !== Math.sign(array[i - 1].input)), 'strong map alternates signs');
const dampedHistory = models.iterateTwoLevelScf(0.4, { delta: 0, interaction: 1.2, coupling: 0.2 }, 80, 0.8);
assert(dampedHistory.at(-1).residual < oscillatoryHistory.at(-1).residual, 'damping reduces the oscillatory-map residual');
near(models.dampValue(0.2, 0.8, 0.75), 0.35, 1e-14, 'old-density-weight damping convention');

// Convergence triage must not accept an energy-only plateau.
const logs = {
  converged: { energy: [-1, -1.1, -1.10000000001], densityResidual: [0.2, 1e-4, 1e-9], density: [0.2, 0.3, 0.300000001] },
  plateau: { energy: [-1, -1.000000000001, -1.000000000002], densityResidual: [0.3, 0.28, 0.27], density: [0.5, -0.5, 0.5] },
  oscillatory: { energy: [-1, -0.9, -1, -0.9, -1], densityResidual: [0.4, 0.4, 0.4, 0.4, 0.4], density: [0.6, -0.6, 0.6, -0.6, 0.6] },
  divergent: { energy: [-1, -0.8, -0.4, 0.5], densityResidual: [0.1, 0.2, 0.5, 1.1], density: [0.1, 0.3, 0.7, 1.5] }
};
for (const [name, log] of Object.entries(logs)) equal(models.classifyScfLog(log).kind, name === 'plateau' ? 'false-plateau' : name, `SCF log ${name}`);

// Orthogonal-basis virtual level shift leaves occupied block unchanged.
const shifted = models.levelShiftFock([[-1, 0.2], [0.2, 0.5]], [[1, 0], [0, 0]], 0.7);
near(shifted[0][0], -1, 1e-14, 'occupied level unshifted');
near(shifted[1][1], 1.2, 1e-14, 'virtual level shifted upward');
near(shifted[0][1], 0.2, 1e-14, 'off-diagonal unchanged for diagonal projector');

// Stabilization dossiers must expose intervention-specific finite evidence, not a generic smoothed path.
const dampingEvidence = models.evaluateStabilizationMission('stabilize-a', 'density-damping');
assert(dampingEvidence.correct, 'oscillatory dossier selects density damping');
near(dampingEvidence.beforeStep, 1.2, 1e-14, 'raw oscillatory maximum update step');
near(dampingEvidence.afterStep, 0.3, 1e-14, 'old-weight damping contracts the displayed update step');
const shiftEvidence = models.evaluateStabilizationMission('stabilize-b', 'virtual-level-shift');
assert(shiftEvidence.correct, 'small-gap dossier selects a temporary virtual level shift');
near(shiftEvidence.beforeGap, 0.03, 1e-14, 'orthonormal occupied-virtual gap before shift');
near(shiftEvidence.afterGap, 0.53, 1e-14, 'orthonormal occupied-virtual gap after shift');
const noInterventionEvidence = models.evaluateStabilizationMission('stabilize-c', 'no-intervention');
assert(noInterventionEvidence.correct, 'already converged dossier rejects gratuitous intervention');
near(noInterventionEvidence.finalResidual, 1e-9, 1e-20, 'no-intervention density residual evidence');
near(noInterventionEvidence.finalDeltaEnergy, 1.000000082740371e-11, 1e-20, 'no-intervention energy-change evidence');

// DIIS constrained residual minimization, independently checked for two vectors.
const residuals = [[1, 0], [0, 2]];
const coefficients = models.diisCoefficients(residuals);
assert(coefficients.valid, 'independent DIIS residuals valid');
near(coefficients.coefficients[0], 0.8, 1e-12, 'DIIS coefficient c1');
near(coefficients.coefficients[1], 0.2, 1e-12, 'DIIS coefficient c2');
near(coefficients.coefficients.reduce((sum, value) => sum + value, 0), 1, 1e-12, 'DIIS coefficients sum to one');
const mixedResidual = models.diisMix(residuals, coefficients.coefficients);
near(dot(mixedResidual, mixedResidual), 0.8, 1e-12, 'DIIS residual norm squared');
let bruteBest = Infinity;
for (let i = -2000; i <= 3000; i += 1) {
  const c = i / 1000;
  const candidate = [c, 2 * (1 - c)];
  bruteBest = Math.min(bruteBest, dot(candidate, candidate));
}
near(dot(mixedResidual, mixedResidual), bruteBest, 1e-12, 'DIIS agrees with independent dense coefficient scan');
assert(!models.diisCoefficients([[1, 0], [1, 0]]).valid, 'linearly dependent DIIS history rejected');

// UHF spin expectation and contamination convention, Nalpha >= Nbeta.
let spin = models.uhfSpinS2(1, 1, [[1]]);
near(spin.s2, 0, 1e-14, 'identical alpha/beta orbital closed-shell singlet');
near(spin.contamination, 0, 1e-14, 'pure singlet contamination');
spin = models.uhfSpinS2(1, 1, [[0]]);
near(spin.s2, 1, 1e-14, 'orthogonal alpha/beta broken-symmetry Ms=0 determinant');
near(spin.contamination, 1, 1e-14, 'broken-symmetry singlet contamination');
spin = models.uhfSpinS2(2, 1, [[1], [0]]);
near(spin.s2, 0.75, 1e-14, 'pure doublet UHF determinant');
spin = models.uhfSpinS2(2, 1, [[0.8], [0]]);
near(spin.s2, 1.11, 1e-14, 'partially overlapping doublet orbitals');
near(spin.contamination, 0.36, 1e-14, 'doublet spin contamination');
assert(!models.uhfSpinS2(1, 2, [[1, 0]]).valid, 'declared convention rejects Nalpha < Nbeta');
assert(!models.uhfSpinS2(1, 1, [[1.1]]).valid, 'overlap magnitude above unity is rejected');
assert(!models.uhfSpinS2(2, 2, [[0.8, 0.8], [0, 0]]).valid, 'noncontractive occupied-overlap row is rejected');

// Mission and boss classifiers must derive from neutral scientific dossiers.
for (const [evaluator, ids] of [
  [models.evaluateVariationMission, ['variation-a', 'variation-b', 'variation-c']],
  [models.evaluateCoulombMission, ['coulomb-a', 'coulomb-b', 'coulomb-c']],
  [models.evaluateFockMission, ['fock-a', 'fock-b']],
  [models.evaluateRoothaanMission, ['roothaan-a', 'roothaan-b']],
  [models.evaluateDensityMission, ['density-a', 'density-b']],
  [models.evaluateStationarityMission, ['stationarity-a', 'stationarity-b', 'stationarity-c']],
  [models.evaluateFixedPointMission, ['fixed-a', 'fixed-b']],
  [models.evaluatePathologyMission, ['pathology-a', 'pathology-b', 'pathology-c', 'pathology-d']],
  [models.evaluateStabilizationMission, ['stabilize-a', 'stabilize-b', 'stabilize-c']],
  [models.evaluateDiisMission, ['diis-a', 'diis-b']],
  [models.evaluateReferenceMission, ['reference-a', 'reference-b', 'reference-c']]
]) {
  for (const id of ids) {
    const invalid = evaluator(id, '__invalid_choice__');
    assert(invalid.valid && !invalid.correct, `${id} rejects an invalid decision without returning an expected answer`);
    assert(!('expected' in invalid) && !('route' in invalid), `${id} verdict does not leak expected/route`);
  }
}
for (const id of ['hf-boss-a', 'hf-boss-b', 'hf-boss-c']) {
  for (let stage = 0; stage < 3; stage += 1) {
    const invalid = models.evaluateHfCase(id, stage, '__invalid_choice__');
    assert(invalid.valid && !invalid.correct && !('expected' in invalid) && !('route' in invalid), `${id} stage ${stage} remains answer-free`);
  }
  assert(!models.evaluateHfCase(id, 3, '__invalid_choice__').valid, `${id} rejects out-of-range boss stage`);
}

console.log('Project XC Hartree-Fock and SCF model tests OK');
console.log(`- deterministic assertions: ${checks}`);
console.log('- variational slices, J/K, Fock builds, Roothaan-Hall metrics, density closure, SCF maps, DIIS, spin diagnostics, and neutral mission dossiers: OK');
